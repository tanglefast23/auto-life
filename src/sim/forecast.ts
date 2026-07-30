import { adjacencyMatches, step } from './step';
import { restoreSimState, type SimState } from './state';
import { toDisplay } from './fixed';
import { minuteOfDay, targetsFor, TICKS_PER_DAY } from './clock';
import {
  activityByIdIn,
  objectForActivityIn,
  type ContentRegistry,
} from './content';
import type { QueueCard, QueueReason } from './queue';
import type { BarId } from './types';

export interface ForecastEntry {
  cardId: string;
  activityId: string;
  predictedStartMinute: number;
}

export interface ForecastAnnotation {
  cardId: string;
  activityId: string;
  /** Null means the card sits beyond the bounded forecast horizon. */
  predictedStartMinute: number | null;
  reason: QueueReason | null;
  targetObjectId: string;
  /** Start-sampled positive and negative totals in display units. */
  effects: Partial<Record<BarId, number>>;
  /** Positive effect that would exceed 100, based on projected bars at start. */
  capWaste: Partial<Record<BarId, number>>;
  /** Bonuses sampled by the real start path, attached to the card that earns them. */
  bonuses: ForecastBonus[];
}

type AdjacencyEffect =
  ContentRegistry['adjacency']['pairs'][number]['effect'];

export type ForecastBonus =
  | {
      kind: 'adjacency';
      pairId: string;
      effect: AdjacencyEffect;
    }
  | {
      kind: 'practiceBlock';
      blockFactor: number;
      scatteredFactor: number;
    };

export interface ForecastConflict {
  bar: BarId;
  atMinute: number;
  /** Cards consuming time on the crossing tick; empty only when genuinely idle. */
  responsibleCardIds: string[];
}

export interface ForecastWakeConflict {
  wakeMinute: number;
  /** The contiguous PINNED chain that will stand ahead of the wake routine. */
  responsibleCardIds: string[];
}

export interface ForecastResult {
  horizonTicks: number;
  starts: ForecastEntry[];
  annotations: ForecastAnnotation[];
  conflicts: ForecastConflict[];
  wakeConflicts: ForecastWakeConflict[];
  barsAtHorizon: Record<BarId, number>;
}

function emptyAnnotation(card: QueueCard, content: ContentRegistry): ForecastAnnotation {
  return {
    cardId: card.id,
    activityId: card.activityId,
    predictedStartMinute: null,
    reason: card.reason === undefined ? null : { ...card.reason },
    targetObjectId: objectForActivityIn(content, card.activityId).id,
    effects: {},
    capWaste: {},
    bonuses: [],
  };
}

function cloneAdjacencyEffect(effect: AdjacencyEffect): AdjacencyEffect {
  if (effect.kind === 'barDelta') {
    return { ...effect, deltas: { ...effect.deltas } };
  }
  return { ...effect };
}

function freezeForecast(result: ForecastResult): ForecastResult {
  for (const start of result.starts) Object.freeze(start);
  Object.freeze(result.starts);
  for (const annotation of result.annotations) {
    if (annotation.reason !== null) Object.freeze(annotation.reason);
    Object.freeze(annotation.effects);
    Object.freeze(annotation.capWaste);
    for (const bonus of annotation.bonuses) {
      if (bonus.kind === 'adjacency') {
        if (bonus.effect.kind === 'barDelta') Object.freeze(bonus.effect.deltas);
        Object.freeze(bonus.effect);
      }
      Object.freeze(bonus);
    }
    Object.freeze(annotation.bonuses);
    Object.freeze(annotation);
  }
  Object.freeze(result.annotations);
  for (const conflict of result.conflicts) {
    Object.freeze(conflict.responsibleCardIds);
    Object.freeze(conflict);
  }
  Object.freeze(result.conflicts);
  for (const conflict of result.wakeConflicts) {
    Object.freeze(conflict.responsibleCardIds);
    Object.freeze(conflict);
  }
  Object.freeze(result.wakeConflicts);
  Object.freeze(result.barsAtHorizon);
  return Object.freeze(result);
}

function bonusesAtStart(
  before: SimState,
  after: NonNullable<SimState['current']>,
  now: number,
  content: ContentRegistry,
): ForecastBonus[] {
  if (after.type !== 'activity') return [];
  const def = activityByIdIn(content, after.dto.activityId);
  const bonuses: ForecastBonus[] = [];
  const seen = new Set<string>();
  const addPair = (
    pair: ContentRegistry['adjacency']['pairs'][number],
  ): void => {
    if (seen.has(pair.id)) return;
    seen.add(pair.id);
    bonuses.push({
      kind: 'adjacency',
      pairId: pair.id,
      effect: cloneAdjacencyEffect(pair.effect),
    });
  };

  const last = before.lastCompletion;
  if (last !== null) {
    const lastDef = activityByIdIn(content, last.activityId);
    for (const pair of content.adjacency.pairs) {
      if (
        now - last.atMinute > pair.gapMaxMin ||
        !adjacencyMatches(pair, lastDef, def)
      ) {
        continue;
      }
      if (
        def.kind === 'practice'
          ? pair.effect.kind === 'scalePoints' &&
            pair.effect.appliesTo === 'thatPractice'
          : pair.effect.kind !== 'scalePoints'
      ) {
        addPair(pair);
      }
    }
  }

  // Minty is armed on Sleep but earned only when this exact Practice consumes it.
  // Reading the real DTO keeps the chip off Brush and Sleep, including stopped/retried
  // edge cases.
  if (after.dto.consumedMinty === true) {
    const minty = content.adjacency.pairs.find(
      (pair) =>
        pair.effect.kind === 'scalePoints' &&
        pair.effect.appliesTo === 'firstPracticeBeforeMorningCheck',
    );
    if (minty !== undefined) addPair(minty);
  }

  if (def.kind === 'practice' && before.practice.prevCompletionWasPractice) {
    const index = before.practice.sessionsCountedToday;
    const blockFactor = content.practice.blockCurve[index];
    const scatteredFactor = content.practice.scatteredCurve[index];
    if (
      blockFactor !== undefined &&
      scatteredFactor !== undefined &&
      blockFactor > scatteredFactor
    ) {
      bonuses.push({
        kind: 'practiceBlock',
        blockFactor,
        scatteredFactor,
      });
    }
  }

  return bonuses;
}

function pinnedWakeChain(state: SimState): string[] {
  const currentId = state.current?.cardId ?? null;
  if (currentId !== null) {
    const at = state.queue.findIndex((card) => card.id === currentId);
    if (at === -1 || state.queue[at]?.owner !== 'PINNED') return [];
    const ids: string[] = [];
    for (let i = at; i < state.queue.length; i++) {
      const card = state.queue[i]!;
      if (card.owner !== 'PINNED') break;
      ids.push(card.id);
    }
    return ids;
  }

  const ids: string[] = [];
  for (const card of state.queue) {
    if (card.owner !== 'PINNED') break;
    ids.push(card.id);
  }
  return ids;
}

/**
 * The headless lookahead (SPEC §7.5): CLONES plain state and runs the SAME step()
 * path — a second tick implementation would drift, and the drift would surface as
 * the forecast lying to the player. PRNG state is cloned with the state (never the
 * live streams), so a forecast can never advance or spoil the real run's draws;
 * undealt wrinkles (P5) are absent by construction.
 */
export function forecast(state: SimState, content: ContentRegistry): ForecastResult {
  // Deep-clone through the validator: guarantees we run on plain data, not aliases.
  let sim = restoreSimState(JSON.parse(JSON.stringify(state)));
  const wakeTarget = targetsFor(sim.chronotype, content.rates).wake;
  const nowOffset = (minuteOfDay(sim.clock.absoluteMinute) - wakeTarget + TICKS_PER_DAY) % TICKS_PER_DAY;
  const ticksToWake = TICKS_PER_DAY - nowOffset;
  const horizonTicks = Math.min(ticksToWake, 720); // next wake or 12h, whichever is sooner

  const starts: ForecastEntry[] = [];
  const seenStarted = new Set<string>();
  const conflicts: ForecastResult['conflicts'] = [];
  const conflictSeen = new Set<string>();
  const annotations = new Map<string, ForecastAnnotation>();
  const ensureAnnotation = (card: QueueCard): ForecastAnnotation => {
    const existing = annotations.get(card.id);
    if (existing !== undefined) return existing;
    const created = emptyAnnotation(card, content);
    annotations.set(card.id, created);
    return created;
  };
  for (const card of sim.queue) ensureAnnotation(card);

  for (let t = 0; t < horizonTicks; t++) {
    // The minute ABOUT TO RUN — snapshot.minuteOfDay is post-advance, one late
    // for a start that happens THIS tick (round-2 math finding).
    const tickMinute = minuteOfDay(sim.clock.absoluteMinute);
    const barsAtStart = { ...sim.bars };
    const stateAtStart = sim;
    for (const card of sim.queue) ensureAnnotation(card);
    const before = sim.current;
    const r = step(sim, [], content);
    sim = r.next;
    for (const card of sim.queue) ensureAnnotation(card);
    const after = sim.current;
    const startedCard =
      after && (after.type === 'activity' || after.type === 'sleep')
        ? (after.type === 'activity' ? after.cardId : after.cardId ?? null)
        : null;
    const beforeCard =
      before && (before.type === 'activity' || before.type === 'sleep')
        ? (before.type === 'activity' ? before.cardId : before.cardId ?? null)
        : null;
    if (startedCard && startedCard !== beforeCard && !seenStarted.has(startedCard)) {
      seenStarted.add(startedCard);
      const activityId = after!.type === 'activity' ? after!.dto.activityId : 'sleep';
      starts.push({ cardId: startedCard, activityId, predictedStartMinute: tickMinute });
      const card = sim.queue.find((candidate) => candidate.id === startedCard);
      if (card !== undefined) {
        const prior = ensureAnnotation(card);
        const effects: Partial<Record<BarId, number>> = {};
        const capWaste: Partial<Record<BarId, number>> = {};
        if (after?.type === 'activity') {
          for (const [bar, fixedTotal] of Object.entries(after.dto.effectTotalsFixed)) {
            const barId = bar as BarId;
            const effect = toDisplay(fixedTotal as number);
            if (effect !== 0) effects[barId] = effect;
            if (effect > 0) {
              const waste = Math.max(0, toDisplay(barsAtStart[barId]) + effect - 100);
              if (waste > 0) capWaste[barId] = waste;
            }
          }
        }
        annotations.set(startedCard, {
          ...prior,
          predictedStartMinute: tickMinute,
          effects,
          capWaste,
          bonuses: bonusesAtStart(stateAtStart, after!, tickMinute, content),
        });
      }
    }
    for (const bar of ['energy', 'nutrition', 'movement', 'hygiene'] as const) {
      if (r.snapshot.bars[bar] < 15 && !conflictSeen.has(bar)) {
        conflictSeen.add(bar);
        const responsibleCardId = before?.cardId ?? after?.cardId ?? null;
        conflicts.push({
          bar,
          atMinute: tickMinute,
          responsibleCardIds: responsibleCardId === null ? [] : [responsibleCardId],
        });
      }
    }
  }

  // §0aa Q7 is deliberately separate from low-bar conflicts. Continue the same
  // deterministic clone only as far as the next wake boundary, publish none of its
  // extra starts/bars, and inspect the PINNED barrier waiting there.
  const simAtHorizon = sim;
  let atWake = sim;
  for (let t = horizonTicks; t < ticksToWake; t++) {
    atWake = step(atWake, [], content).next;
  }
  const wakeResponsibleCardIds = pinnedWakeChain(atWake);
  const wakeConflicts: ForecastWakeConflict[] =
    wakeResponsibleCardIds.length === 0
      ? []
      : [
          {
            wakeMinute: wakeTarget,
            responsibleCardIds: wakeResponsibleCardIds,
          },
        ];

  // Bars exactly AT the horizon — an extra step here previously overshot by one tick.
  return freezeForecast({
    horizonTicks,
    starts,
    annotations: [...annotations.values()],
    conflicts,
    wakeConflicts,
    barsAtHorizon: {
      energy: toDisplay(simAtHorizon.bars.energy),
      nutrition: toDisplay(simAtHorizon.bars.nutrition),
      movement: toDisplay(simAtHorizon.bars.movement),
      hygiene: toDisplay(simAtHorizon.bars.hygiene),
    },
  });
}
