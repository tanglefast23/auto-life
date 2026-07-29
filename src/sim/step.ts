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
      if (s.current.type === 'activity') {
        const def = activityById(s.current.dto.activityId);
        if (def.kind === 'timed') s.suppression[def.id] = now + STOP_SUPPRESSION_MIN;
      }
      s.queue = s.queue.filter((c) => c.id !== (s.current?.type === 'travel' || s.current?.type === 'activity' ? s.current.cardId : s.current?.cardId));
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
      s.queue = s.queue.filter((c) => c.blockId !== blockId);
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
    for (const activityId of steps) {
      s.queue.push({ id: `c${s.nextCardSeq++}`, activityId, owner: 'AUTO', urgent: false, source: 'anchor', blockId, enqueuedTick: now });
    }
  }
  // Reactive rules.
  const decision = evaluateReactive(content.reactive, { absoluteMinute: now, wakeTarget, bars: s.bars }, s.queue, s.suppression);
  if (decision.evict.length > 0) s.queue = s.queue.filter((c) => !decision.evict.includes(c.id));
  for (const a of decision.add) {
    if (hasAutoCardFor(s.queue, a.activityId)) continue;
    if (a.activityId === 'nap') {
      const def = activityById('nap');
      if (def.kind !== 'timed' || !napEligibility(def, s.bars, minuteOfDay(now), wakeTarget, s.napEffectiveUsesToday).canStart) continue;
    }
    s.queue.push({ id: `c${s.nextCardSeq++}`, activityId: a.activityId, owner: 'AUTO', urgent: a.urgent, source: 'reactive', enqueuedTick: now });
    if (a.urgent) {
      s.events.urgentCount += 1;
      emit('urgent', a.activityId);
    }
  }
  // Auto-cleanup at trigger+10, then order the runs.
  s.queue = autoCleanup(s.queue, (card) => {
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
    const dto: ActiveTimedActivity = {
      activityId: def.id,
      durationTicks,
      elapsedTicks: 0,
      fillStartTick: 0,
      effectTotalsFixed: {},
      suppressPassiveEnergy: false,
      sampled: { mSpeed: mSpeedAtStart(s.bars), wellFed: isWellFedAtStart(s.bars, content.rates), effectiveUse: true },
    };
    return { type: 'activity', cardId: card.id, dto };
  }
  // timed
  let effectiveUse = true;
  if (def.effectiveUsesPerDay !== undefined) {
    const elig = napEligibility(def, s.bars, minuteOfDay(now), wakeTarget, s.napEffectiveUsesToday);
    effectiveUse = elig.effective;
    if (effectiveUse) s.napEffectiveUsesToday += 1;
  }
  const dto = startTimedActivity(def, s.bars, content.rates, { effectiveUse });
  // Adjacency at start: warmed-up (workout→shower halves duration), cramp (meal→workout −10 Movement).
  const last = s.lastCompletion;
  if (last) {
    const gap = now - last.atMinute;
    if (def.id === 'shower' && last.isWorkout && gap <= 30) {
      dto.durationTicks = Math.max(1, Math.ceil(dto.durationTicks / 2));
      if (dto.fillStartTick >= dto.durationTicks) dto.fillStartTick = dto.durationTicks - 1;
    }
    if ((def.tags?.includes('workout') ?? false) && last.activityId === 'meal' && gap <= 30) {
      s.pendingInstantDeltas.push({ source: 'adjacency:cramp', deltas: { movement: toFixed(-10) } });
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
  if (def.id === 'shower') s.practice.freshMindUntil = now + 60;

  if (def.kind === 'practice') {
    const p = content.practice;
    const idx = s.practice.sessionsCountedToday;
    const curve = s.practice.prevCompletionWasPractice ? p.blockCurve : p.scatteredCurve;
    const factor = idx < p.maxCountedSessionsPerDay ? (curve[idx] ?? 0) : 0;
    let mult = mOutAtStart(s.bars, content.rates);
    if (dto.sampled.wellFed) mult *= 1 + content.rates.wellFed.outputBonus;
    if (s.practice.freshMindUntil !== null && now < s.practice.freshMindUntil) mult *= 1.2;
    const beforeMorningCheck = minuteOfDay(now) < morningCheckMinute(s.chronotype, content.rates) && minuteOfDay(now) >= wakeTarget;
    if (s.practice.mintyArmed && !s.practice.mintyPaidToday && beforeMorningCheck) {
      mult *= 1.15;
      s.practice.mintyPaidToday = true;
    }
    if (factor > 0) {
      const award = Math.round(p.basePoints * factor * mult * 100); // one round per award (SPEC §8)
      s.practice.points100 += award;
      s.practice.sessionsCountedToday += 1;
      emit('practiceAwarded', String(award));
    }
  }

  // it-sticks: meal completed ≤60 min after a workout → movement decay ×0.5 for 12h.
  const last = s.lastCompletion;
  if (def.id === 'meal' && last?.isWorkout && now - last.atMinute <= 60) {
    s.decayModifiers.push({ bar: 'movement', factor: 0.5, untilMinute: now + 720, source: 'adjacency:it-sticks' });
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
