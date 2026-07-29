import { applyBarContributions, type BarContribution } from './bar-deltas';
import { passiveContribution, type BodyMode } from './rates';
import {
  crossedWakeBoundary,
  napEligibility,
  progressTimedActivity,
  sleepContribution,
  startTimedActivity,
  type ActiveTimedActivity,
} from './activities';
import { anchorsToEnqueue, isMissed, resolveBlock } from './planner/anchors';
import { evaluateReactive } from './planner/reactive';
import { sortReactivesAroundBlocks } from './planner';
import { autoCleanup, hasAutoCardFor, insertPlayerCard, isSuppressed, objectClick, removeCard, type QueueCard } from './queue';
import { buildWalkGrid, findPath, travelTicks } from './travel';
import { dayNumber, minuteOfDay, morningCheckMinute, targetsFor } from './clock';
import { healthDisplay, isWellFedAtStart, mOutAtStart, mSpeedAtStart } from './bars';
import { toDisplay, toFixed } from './fixed';
import { activityById, objectForActivity, type ContentRegistry } from './content';
import type { SimState } from './state';
import { type BarId } from './types';

export type Command =
  | { type: 'insertPlayer'; activityId: string }
  | { type: 'removeCard'; cardId: string }
  | { type: 'stopCurrent' }
  | { type: 'objectClick'; activityId: string };

export interface DomainEvent {
  type: 'anchorMissed' | 'urgent' | 'activityCompleted' | 'practiceAwarded' | 'wakeBoundary' | 'slept';
  detail: string;
  atMinute: number;
}

export interface SimSnapshot {
  minuteOfDay: number;
  day: number;
  health: number;
  bars: Record<BarId, number>;
  queueIds: string[];
  currentLabel: string;
  practicePoints: number;
}

const STOP_SUPPRESSION_MIN = 60;

/** §7.4: new AUTO cards enter the EARLIEST run — immediately after the leading PINNED prefix. */
function insertIntoEarliestRun(queue: QueueCard[], card: QueueCard): QueueCard[] {
  const firstAuto = queue.findIndex((c) => c.owner === 'AUTO');
  const at = firstAuto === -1 ? queue.length : firstAuto;
  return [...queue.slice(0, at), card, ...queue.slice(at)];
}

/** The activity id currently running (travel counts as its target card's activity). */
function currentActivityId(s: SimState): string | null {
  if (!s.current) return null;
  if (s.current.type === 'activity') return s.current.dto.activityId;
  if (s.current.type === 'sleep') return 'sleep';
  const card = s.queue.find((c) => c.id === (s.current as { cardId: string }).cardId);
  return card?.activityId ?? null;
}

/** The card id currently being executed or traveled toward. */
function currentCardId(s: SimState): string | null {
  if (!s.current) return null;
  return s.current.type === 'sleep' ? s.current.cardId : s.current.cardId;
}

/** One game-minute. `state.clock.absoluteMinute` is the minute ABOUT TO RUN. */
export function step(
  state: SimState,
  commands: readonly Command[],
  content: ContentRegistry,
): { next: SimState; events: DomainEvent[]; snapshot: SimSnapshot } {
  const s: SimState = JSON.parse(JSON.stringify(state)) as SimState;
  const events: DomainEvent[] = [];
  const now = s.clock.absoluteMinute;
  const wakeTarget = targetsFor(s.chronotype, content.rates).wake;
  const today = dayNumber(now);
  const emit = (type: DomainEvent['type'], detail: string) => events.push({ type, detail, atMinute: now });

  // ---- stage 1: commands at the minute boundary ----
  for (const cmd of commands) {
    if (cmd.type === 'insertPlayer') {
      s.queue = insertPlayerCard(s.queue, { id: `c${s.nextCardSeq++}`, activityId: cmd.activityId, enqueuedTick: now, blockId: undefined });
    } else if (cmd.type === 'objectClick') {
      s.queue = objectClick(s.queue, cmd.activityId, `c${s.nextCardSeq++}`, now);
    } else if (cmd.type === 'removeCard') {
      const card = s.queue.find((c) => c.id === cmd.cardId);
      if (card?.blockId) s.anchorsConsumedOnDay[card.blockId.split('#')[0] ?? ''] = today; // Q4
      const r = removeCard(s.queue, cmd.cardId, now, s.suppression);
      s.queue = r.queue;
      s.suppression = r.suppression;
    } else if (cmd.type === 'stopCurrent' && s.current) {
      const stoppedId = currentCardId(s);
      const stoppedCard = s.queue.find((c) => c.id === stoppedId);
      // §7.4: stop suppresses the TYPE for 1h only when the stopped card is AUTO —
      // stopping your own pinned card suppresses nothing; travel-toward-AUTO counts.
      if (stoppedCard?.owner === 'AUTO') {
        s.suppression[stoppedCard.activityId] = now + STOP_SUPPRESSION_MIN;
      }
      if (stoppedId !== null) s.queue = s.queue.filter((c) => c.id !== stoppedId);
      s.current = null;
    }
  }

  // ---- stage 2: windows and triggers for the displayed minute ----
  const anchorCtx = {
    absoluteMinute: now,
    wakeTarget,
    bars: s.bars,
    lastMealCompletedAt: s.lastMealCompletedAt,
    anchorsConsumedOnDay: s.anchorsConsumedOnDay,
    preferredWorkout: s.preferredWorkout,
  };
  // Missed windows (Q3): unstarted blocks whose window closed are removed + consumed.
  for (const anchor of content.anchors.anchors) {
    const blockId = `${anchor.id}#${today}`;
    const queued = s.queue.some((c) => c.blockId === blockId);
    const started = s.anchorsConsumedOnDay[anchor.id] === today;
    if (queued && !started && isMissed(anchor, anchorCtx, false)) {
      s.queue = s.queue.filter((c) => !(c.blockId === blockId && c.owner === 'AUTO'));
      s.anchorsConsumedOnDay[anchor.id] = today;
      s.events.anchorsMissed += 1;
      emit('anchorMissed', anchor.id);
    }
  }
  // Enqueue open anchors whose block is not queued and not consumed.
  for (const anchor of anchorsToEnqueue(content.anchors, anchorCtx).enqueue) {
    const blockId = `${anchor.id}#${today}`;
    if (s.queue.some((c) => c.blockId === blockId)) continue;
    const steps = resolveBlock(anchor, anchorCtx);
    for (const activityId of [...steps].reverse()) {
      s.queue = insertIntoEarliestRun(s.queue, { id: `c${s.nextCardSeq++}`, activityId, owner: 'AUTO', urgent: false, source: 'anchor', blockId, enqueuedTick: now });
    }
  }
  // Reactive rules.
  const runningCardId = currentCardId(s);
  const runningActivity = currentActivityId(s);
  const decision = evaluateReactive(content.reactive, { absoluteMinute: now, wakeTarget, bars: s.bars }, s.queue, s.suppression, runningActivity);
  const evictable = decision.evict.filter((id) => id !== runningCardId);
  if (evictable.length > 0) s.queue = s.queue.filter((c) => !evictable.includes(c.id));
  for (const a of decision.add) {
    if (hasAutoCardFor(s.queue, a.activityId) || a.activityId === runningActivity) continue;
    if (a.activityId === 'nap') {
      const def = activityById('nap');
      if (def.kind !== 'timed' || !napEligibility(def, s.bars, minuteOfDay(now), wakeTarget, s.napEffectiveUsesToday).canStart) continue;
    }
    s.queue = insertIntoEarliestRun(s.queue, { id: `c${s.nextCardSeq++}`, activityId: a.activityId, owner: 'AUTO', urgent: a.urgent, source: 'reactive', enqueuedTick: now });
    if (a.urgent) {
      s.events.urgentCount += 1;
      emit('urgent', a.activityId);
    }
  }
  // Auto-cleanup at trigger+10, then order the runs.
  s.queue = autoCleanup(s.queue, (card) => {
    if (card.id === runningCardId) return false; // §7.4: only UNSTARTED cards poof
    const rule = content.reactive.rules.find((r) => r.activity === card.activityId || r.supersededBelow?.activity === card.activityId);
    if (!rule) return false;
    return toDisplay(s.bars[rule.bar]) > rule.below + 10;
  });
  s.queue = sortReactivesAroundBlocks(s.queue, s.bars, content.reactive);

  // ---- stage 3: start the next unit if idle ----
  if (s.current === null && s.queue.length > 0) {
    const card = s.queue[0]!;
    const def = activityById(card.activityId);
    const object = objectForActivity(card.activityId);
    const [ix, iy] = object.interactPoint;
    if (s.position.x !== ix || s.position.y !== iy) {
      const walk = buildWalkGrid(content.homeMap, content.objects);
      const path = findPath(walk, s.position, { x: ix, y: iy });
      if (path === null) throw new Error(`no path from (${s.position.x},${s.position.y}) to ${object.id}`);
      const ticks = travelTicks(path.length - 1, s.bars);
      if (ticks > 0) {
        s.current = { type: 'travel', cardId: card.id, path, totalTicks: ticks, elapsedTicks: 0 };
      } else {
        s.position = { x: ix, y: iy };
      }
    }
    if (s.current === null) {
      s.current = beginCard(s, card, content, emit);
    }
  }

  // ---- stage 4: collect named signed deltas ----
  const contributions: BarContribution[] = [];
  let mode: BodyMode = 'awake';
  if (s.current?.type === 'sleep') mode = 'asleep';
  else if (s.current?.type === 'activity' && s.current.dto.suppressPassiveEnergy) mode = 'effectiveNap';
  const passive = passiveContribution(mode, content.rates);
  // it-sticks: active decay modifiers scale the passive delta (integer-exact by construction).
  for (const mod of s.decayModifiers) {
    if (now >= mod.untilMinute) continue;
    const d = passive.deltas[mod.bar];
    if (d !== undefined) {
      const scaled = d * mod.factor;
      if (!Number.isInteger(scaled)) throw new Error(`decay modifier "${mod.source}" produced a non-integer delta`);
      passive.deltas[mod.bar] = scaled;
    }
  }
  s.decayModifiers = s.decayModifiers.filter((m) => now < m.untilMinute);
  contributions.push(passive);
  if (s.pendingInstantDeltas.length > 0) {
    contributions.push(...s.pendingInstantDeltas);
    s.pendingInstantDeltas = [];
  }

  if (s.current?.type === 'sleep') {
    contributions.push(sleepContribution(content.rates));
  } else if (s.current?.type === 'travel') {
    const t = s.current;
    t.elapsedTicks += 1;
    const idx = Math.min(t.path.length - 1, Math.floor((t.path.length * t.elapsedTicks) / t.totalTicks));
    const pos = t.path[idx]!;
    s.position = { x: pos.x, y: pos.y };
    if (t.elapsedTicks >= t.totalTicks) {
      const card = s.queue.find((c) => c.id === t.cardId);
      const last = t.path[t.path.length - 1]!;
      s.position = { x: last.x, y: last.y };
      s.current = card ? beginCard(s, card, content, emit) : null;
    }
  } else if (s.current?.type === 'activity') {
    const r = progressTimedActivity(s.current.dto);
    contributions.push(r.contribution);
    if (r.completed) {
      completeActivity(s, s.current.cardId, s.current.dto, content, emit, now, wakeTarget);
      s.current = null;
    } else {
      s.current = { ...s.current, dto: r.next as ActiveTimedActivity };
    }
  }

  // Single-writer assertion (master §4): passive Energy must be absent while asleep/napping.
  if ((mode === 'asleep' || mode === 'effectiveNap') && passive.deltas.energy !== undefined) {
    throw new Error('single-writer violation: passive Energy delta while sleep/nap is the writer');
  }

  // ---- stage 5: one reducer commit ----
  s.bars = applyBarContributions(s.bars, contributions);

  // Sleep end: at wakeTarget always; urgent sleep may end early at Energy ≥80 outside the night window.
  if (s.current?.type === 'sleep') {
    const offset = minuteOfDay(now + 1) === wakeTarget;
    const energyDisplay = toDisplay(s.bars.energy);
    const o = minuteOfDay(now + 1) - wakeTarget;
    const night = o >= 930 || o < 0; // bedtime opens at wake+930 (22:30 baseline)
    if (offset) {
      endSleep(s, content, emit);
    } else if (energyDisplay >= 80 && !night) {
      endSleep(s, content, emit); // daytime urgent sleep ends at 80 (§7.2); night continues to wake (§7.1)
    }
  }

  // ---- stage 6: advance and emit ----
  const prevMinute = now;
  s.clock.absoluteMinute = now + 1;
  if (crossedWakeBoundary(prevMinute, s.clock.absoluteMinute, wakeTarget)) {
    s.napEffectiveUsesToday = 0;
    s.practice.sessionsCountedToday = 0;
    s.practice.mintyPaidToday = false;
    emit('wakeBoundary', String(dayNumber(s.clock.absoluteMinute)));
    // prune stale anchor consumption records
    const d = dayNumber(s.clock.absoluteMinute);
    for (const key of Object.keys(s.anchorsConsumedOnDay)) {
      if ((s.anchorsConsumedOnDay[key] ?? 0) < d - 1) delete s.anchorsConsumedOnDay[key];
    }
  }
  // Minty arming expires after the morning check.
  if (s.practice.mintyArmed && minuteOfDay(s.clock.absoluteMinute) === morningCheckMinute(s.chronotype, content.rates)) {
    s.practice.mintyArmed = false;
  }

  const snapshot: SimSnapshot = {
    minuteOfDay: minuteOfDay(s.clock.absoluteMinute),
    day: dayNumber(s.clock.absoluteMinute),
    health: healthDisplay(s.bars, content.rates),
    bars: {
      energy: toDisplay(s.bars.energy),
      nutrition: toDisplay(s.bars.nutrition),
      movement: toDisplay(s.bars.movement),
      hygiene: toDisplay(s.bars.hygiene),
    },
    queueIds: s.queue.map((c) => c.id),
    currentLabel: s.current === null ? 'idle' : s.current.type === 'activity' ? s.current.dto.activityId : s.current.type,
    practicePoints: s.practice.points100 / 100,
  };
  return { next: s, events, snapshot };
}

function beginCard(
  s: SimState,
  card: QueueCard,
  content: ContentRegistry,
  emit: (t: DomainEvent['type'], d: string) => void,
): SimState['current'] {
  const def = activityById(card.activityId);
  const now = s.clock.absoluteMinute;
  const wakeTarget = targetsFor(s.chronotype, content.rates).wake;
  // First start of an anchor block consumes the anchor (Q4's counterpart).
  if (card.blockId) {
    const anchorId = card.blockId.split('#')[0] ?? '';
    s.anchorsConsumedOnDay[anchorId] = dayNumber(now);
  }
  if (def.kind === 'sleepWindow') {
    // Minty arms if the previous completion was brush with no intervening completion (§6.7).
    const pair = content.adjacency.pairs.find((p) => p.id === 'minty-fresh')!;
    if (s.lastCompletion?.activityId === 'brush' && now - s.lastCompletion.atMinute <= pair.gapMaxMin) {
      s.practice.mintyArmed = true;
    }
    emit('slept', 'start');
    return { type: 'sleep', cardId: card.id };
  }
  if (def.kind === 'idle') {
    s.queue = s.queue.filter((c) => c.id !== card.id);
    return null;
  }
  if (def.kind === 'practice') {
    const denom = 300_000 + s.bars.energy;
    const durationTicks = Math.max(1, Math.floor((def.baseMin * 600_000 + denom - 1) / denom));
    // §6.6: EVERY award multiplier samples at start. Gaps measure first-END to
    // second-START (§6.7); lastCompletion is the intervener rule by construction.
    const wellFed = isWellFedAtStart(s.bars, content.rates);
    let pointsMultiplier = mOutAtStart(s.bars, content.rates);
    if (wellFed) pointsMultiplier *= 1 + content.rates.wellFed.outputBonus;
    const freshPair = content.adjacency.pairs.find((x) => x.id === 'fresh-mind')!;
    const lastDone = s.lastCompletion;
    if (
      lastDone !== null &&
      lastDone.activityId === freshPair.first &&
      now - lastDone.atMinute <= freshPair.gapMaxMin &&
      freshPair.effect.kind === 'scalePoints'
    ) {
      pointsMultiplier *= freshPair.effect.factor;
    }
    const mintyPair = content.adjacency.pairs.find((x) => x.id === 'minty-fresh')!;
    const beforeMorningCheck =
      minuteOfDay(now) >= wakeTarget && minuteOfDay(now) < morningCheckMinute(s.chronotype, content.rates);
    if (s.practice.mintyArmed && !s.practice.mintyPaidToday && beforeMorningCheck && mintyPair.effect.kind === 'scalePoints') {
      pointsMultiplier *= mintyPair.effect.factor;
      s.practice.mintyPaidToday = true; // paid at start — never twice a day
    }
    const focus = content.practice.hygieneFocus;
    if (toDisplay(s.bars.hygiene) < focus.below) pointsMultiplier *= focus.factor; // §6.5 Hygiene focus
    const dto: ActiveTimedActivity = {
      activityId: def.id,
      durationTicks,
      elapsedTicks: 0,
      fillStartTick: 0,
      effectTotalsFixed: {},
      suppressPassiveEnergy: false,
      sampled: { mSpeed: mSpeedAtStart(s.bars), wellFed, effectiveUse: true, pointsMultiplier },
    };
    return { type: 'activity', cardId: card.id, dto };
  }
  // timed
  // §6.2: player naps obey the same startability window — an ineligible nap card drops.
  if (def.effectiveUsesPerDay !== undefined) {
    const elig = napEligibility(def, s.bars, minuteOfDay(now), wakeTarget, s.napEffectiveUsesToday);
    if (!elig.canStart) {
      s.queue = s.queue.filter((c) => c.id !== card.id);
      return null;
    }
  }
  // Anchor meal gate re-check at START (the enqueue-time gate can go stale behind a
  // running reactive meal): a meal completed within the no-meal clause drops the card.
  if (card.source === 'anchor' && def.id === 'meal' && s.lastMealCompletedAt !== null && now - s.lastMealCompletedAt < 180) {
    s.queue = s.queue.filter((c) => c.id !== card.id);
    return null;
  }
  let effectiveUse = true;
  if (def.effectiveUsesPerDay !== undefined) {
    const elig = napEligibility(def, s.bars, minuteOfDay(now), wakeTarget, s.napEffectiveUsesToday);
    effectiveUse = elig.effective;
    if (effectiveUse) s.napEffectiveUsesToday += 1;
  }
  const dto = startTimedActivity(def, s.bars, content.rates, { effectiveUse });
  // Adjacency at start (§6.7: first-END to second-START, data-driven, lastCompletion = intervener rule).
  const last = s.lastCompletion;
  if (last) {
    const gap = now - last.atMinute;
    const warm = content.adjacency.pairs.find((x) => x.id === 'warmed-up')!;
    if (def.id === warm.second && last.isWorkout && gap <= warm.gapMaxMin && warm.effect.kind === 'halveDuration') {
      dto.durationTicks = Math.max(1, Math.ceil(dto.durationTicks / 2));
      if (dto.fillStartTick >= dto.durationTicks) dto.fillStartTick = dto.durationTicks - 1;
    }
    const cramp = content.adjacency.pairs.find((x) => x.id === 'cramp')!;
    if ((def.tags?.includes('workout') ?? false) && last.activityId === cramp.first && gap <= cramp.gapMaxMin && cramp.effect.kind === 'barDelta') {
      const deltas: Partial<Record<BarId, number>> = {};
      for (const [bar, v] of Object.entries(cramp.effect.deltas)) deltas[bar as BarId] = toFixed(v as number);
      s.pendingInstantDeltas.push({ source: 'adjacency:cramp', deltas });
    }
    const sticks = content.adjacency.pairs.find((x) => x.id === 'it-sticks')!;
    if (def.id === sticks.second && last.isWorkout && gap <= sticks.gapMaxMin && sticks.effect.kind === 'scaleDecay') {
      // Re-trigger REPLACES the old instance (§6.7: a bonus never stacks with itself).
      s.decayModifiers = s.decayModifiers.filter((m) => m.source !== 'adjacency:it-sticks');
      s.decayModifiers.push({ bar: sticks.effect.bar, factor: sticks.effect.factor, untilMinute: now + sticks.effect.durationMin, source: 'adjacency:it-sticks' });
    }
  }
  return { type: 'activity', cardId: card.id, dto };
}

function completeActivity(
  s: SimState,
  cardId: string,
  dto: ActiveTimedActivity,
  content: ContentRegistry,
  emit: (t: DomainEvent['type'], d: string) => void,
  now: number,
  wakeTarget: number,
): void {
  const def = activityById(dto.activityId);
  s.queue = s.queue.filter((c) => c.id !== cardId);
  emit('activityCompleted', def.id);

  if (def.id === 'meal') s.lastMealCompletedAt = now;

  if (def.kind === 'practice') {
    const p = content.practice;
    const idx = s.practice.sessionsCountedToday;
    const curve = s.practice.prevCompletionWasPractice ? p.blockCurve : p.scatteredCurve;
    const factor = idx < p.maxCountedSessionsPerDay ? (curve[idx] ?? 0) : 0;
    const mult = dto.sampled.pointsMultiplier ?? 1; // frozen at start (§6.6)
    if (factor > 0) {
      const award = Math.round(p.basePoints * factor * mult * 100); // one round per award (SPEC §8)
      s.practice.points100 += award;
      s.practice.sessionsCountedToday += 1;
      emit('practiceAwarded', String(award));
    }
  }

  s.practice.prevCompletionWasPractice = def.kind === 'practice';
  s.lastCompletion = { activityId: def.id, isWorkout: def.kind === 'timed' && (def.tags?.includes('workout') ?? false), atMinute: now };
}

function endSleep(s: SimState, content: ContentRegistry, emit: (t: DomainEvent['type'], d: string) => void): void {
  if (s.current?.type === 'sleep' && s.current.cardId) {
    const id = s.current.cardId;
    s.queue = s.queue.filter((c) => c.id !== id);
  }
  s.lastCompletion = { activityId: 'sleep', isWorkout: false, atMinute: s.clock.absoluteMinute };
  s.practice.prevCompletionWasPractice = false;
  s.current = null;
  emit('slept', 'end');
}
