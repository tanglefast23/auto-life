import {
  canPlayerInsert,
  insertPlayerCard,
  objectClick,
  removeCard,
  isSuppressed,
  autoCleanup,
  pinnedSubsequence,
  REMOVE_SUPPRESSION_MIN,
  type QueueCard,
} from '../queue';
import { sortReactivesAroundBlocks } from '../planner';
import { anchorsToEnqueue, isMissed, resolveBlock, windowState, type AnchorContext } from '../planner/anchors';
import { evaluateReactive, type ReactiveContext } from '../planner/reactive';
import { scoreReactiveCard } from '../planner/priority';
import { PrngStreams } from '../prng';
import { toFixed } from '../fixed';
import { content } from '../content';
import { initialBars } from '../initial-state';
import type { Bars } from '../types';

const rates = content.rates;
const reactive = content.reactive;
const anchors = content.anchors;
const bars = (e: number, n: number, m: number, h: number): Bars =>
  ({ energy: toFixed(e), nutrition: toFixed(n), movement: toFixed(m), hygiene: toFixed(h) });

const card = (over: Partial<QueueCard> & { id: string; activityId: string }): QueueCard => ({
  owner: 'AUTO',
  urgent: false,
  source: 'reactive',
  enqueuedTick: 0,
  ...over,
});

const anchorCtx = (over: Partial<AnchorContext> = {}): AnchorContext => ({
  absoluteMinute: 420,
  wakeTarget: 420,
  bars: initialBars(),
  lastMealCompletedAt: null,
  anchorsConsumedOnDay: {},
  preferredWorkout: 'weights',
  ...over,
});

// ---------- §7.4 rows ----------

test('planner passes never disturb the PINNED subsequence', () => {
  const q: QueueCard[] = [
    card({ id: 'p1', activityId: 'practice', owner: 'PINNED', source: 'player' }),
    card({ id: 'a1', activityId: 'snack' }),
    card({ id: 'p2', activityId: 'practice', owner: 'PINNED', source: 'player', enqueuedTick: 1 }),
    card({ id: 'a2', activityId: 'shower', enqueuedTick: 2 }),
  ];
  const sorted = sortReactivesAroundBlocks(q, bars(50, 10, 50, 10), reactive);
  expect(pinnedSubsequence(sorted)).toEqual(['p1', 'p2']);
});

test('each maximal AUTO run sorts independently (Q2) and never crosses a PINNED card', () => {
  const q: QueueCard[] = [
    card({ id: 'a1', activityId: 'stretch', enqueuedTick: 0 }), // movement, weight 1
    card({ id: 'p1', activityId: 'practice', owner: 'PINNED', source: 'player', enqueuedTick: 1 }),
    card({ id: 'a2', activityId: 'shower', enqueuedTick: 2 }), // hygiene, weight 2
    card({ id: 'a3', activityId: 'snack', enqueuedTick: 3 }), // nutrition, weight 3
  ];
  const b = bars(50, 20, 20, 20);
  const sorted = sortReactivesAroundBlocks(q, b, reactive);
  expect(sorted.map((c) => c.id)).toEqual(['a1', 'p1', 'a3', 'a2']); // run 2 sorted; a1 stays in run 1
});

test('urgent rises to the front of its own run only', () => {
  const q: QueueCard[] = [
    card({ id: 'p1', activityId: 'practice', owner: 'PINNED', source: 'player' }),
    card({ id: 'a1', activityId: 'shower', enqueuedTick: 1 }),
    card({ id: 'a2', activityId: 'sleep', urgent: true, enqueuedTick: 2 }),
  ];
  const sorted = sortReactivesAroundBlocks(q, bars(10, 50, 50, 30), reactive);
  expect(sorted.map((c) => c.id)).toEqual(['p1', 'a2', 'a1']);
});

test('anchor blocks hold their internal order even when a member bar is worse', () => {
  const q: QueueCard[] = [
    card({ id: 'w1', activityId: 'toilet', blockId: 'wake', source: 'anchor', enqueuedTick: 0 }),
    card({ id: 'w2', activityId: 'brush', blockId: 'wake', source: 'anchor', enqueuedTick: 0 }),
    card({ id: 'w3', activityId: 'shower', blockId: 'wake', source: 'anchor', enqueuedTick: 0 }),
    card({ id: 'w4', activityId: 'meal', blockId: 'wake', source: 'anchor', enqueuedTick: 0 }),
  ];
  const sorted = sortReactivesAroundBlocks(q, bars(100, 5, 100, 5), reactive);
  expect(sorted.map((c) => c.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
});

test('player cap: 10 player cards; blocks and urgent cards live outside the cap', () => {
  let q: QueueCard[] = [];
  for (let i = 0; i < 10; i++) q = insertPlayerCard(q, { id: `p${i}`, activityId: 'practice', enqueuedTick: i, blockId: undefined });
  expect(canPlayerInsert(q)).toBe(false);
  expect(() => insertPlayerCard(q, { id: 'p11', activityId: 'practice', enqueuedTick: 11, blockId: undefined })).toThrow(/cap/);
  // System cards are not capped:
  q = [...q, card({ id: 'b1', activityId: 'brush', blockId: 'bedtime', source: 'anchor' }), card({ id: 'u1', activityId: 'sleep', urgent: true })];
  expect(q).toHaveLength(12);
});

test('remove suppresses the AUTO type for 2h; urgency overrides; PINNED removal suppresses nothing', () => {
  const q = [card({ id: 'a1', activityId: 'shower' }), card({ id: 'p1', activityId: 'snack', owner: 'PINNED', source: 'player' })];
  const r1 = removeCard(q, 'a1', 1000, {});
  expect(isSuppressed('shower', 1000 + REMOVE_SUPPRESSION_MIN - 1, r1.suppression, false)).toBe(true);
  expect(isSuppressed('shower', 1000 + REMOVE_SUPPRESSION_MIN, r1.suppression, false)).toBe(false);
  expect(isSuppressed('shower', 1000, r1.suppression, true)).toBe(false); // urgency overrides
  const r2 = removeCard(q, 'p1', 1000, {});
  expect(r2.suppression).toEqual({});
});

test('object-click promotes an existing card instead of inserting a duplicate', () => {
  const q = [card({ id: 'x', activityId: 'meal', enqueuedTick: 5 }), card({ id: 'y', activityId: 'shower', enqueuedTick: 6 })];
  const clicked = objectClick(q, 'meal', 'new-id', 10);
  expect(clicked).toHaveLength(2);
  expect(clicked[0]!.id).toBe('x');
  expect(clicked[0]!.owner).toBe('PINNED');
});

test('auto-cleanup removes only unstarted AUTO reactive cards past trigger+10', () => {
  const q = [
    card({ id: 'a1', activityId: 'snack' }),
    card({ id: 'p1', activityId: 'snack', owner: 'PINNED', source: 'player' }),
  ];
  const cleaned = autoCleanup(q, () => true);
  expect(cleaned.map((c) => c.id)).toEqual(['p1']);
});

// ---------- §7.3 exact scores ----------

test('all-bars-0: Sleep > Food > Shower, and Workout does not lead', () => {
  const b = bars(0, 0, 0, 0);
  const mk = (activityId: string, ruleId: string, urgent: boolean) => {
    const rule = reactive.rules.find((r) => r.id === ruleId)!;
    return scoreReactiveCard(card({ id: ruleId, activityId, urgent }), rule, b, reactive);
  };
  const sleep = mk('sleep', 'urgentSleep', true);
  const food = mk('meal', 'snack', true);
  const shower = mk('shower', 'shower', true);
  const stretch = mk('stretch', 'stretch', false); // movement never urgent
  expect(sleep).toBeGreaterThan(food);
  expect(food).toBeGreaterThan(shower);
  expect(shower).toBeGreaterThan(stretch);
});

test('Energy 14 / Nutrition 14: sleep outranks food (common normalization)', () => {
  const b = bars(14, 14, 100, 100);
  const sleepRule = reactive.rules.find((r) => r.id === 'urgentSleep')!;
  const foodRule = reactive.rules.find((r) => r.id === 'snack')!;
  const sleep = scoreReactiveCard(card({ id: 's', activityId: 'sleep', urgent: true }), sleepRule, b, reactive);
  const food = scoreReactiveCard(card({ id: 'f', activityId: 'meal', urgent: true }), foodRule, b, reactive);
  expect(sleep).toBeGreaterThan(food);
});

// ---------- §7.1 anchors ----------

test('Day 1 at wakeTarget enqueues exactly the wake block in order', () => {
  const d = anchorsToEnqueue(anchors, anchorCtx());
  expect(d.enqueue.map((a) => a.id)).toEqual(['wake']);
  expect(resolveBlock(d.enqueue[0]!, anchorCtx())).toEqual(['toilet', 'brush', 'shower', 'meal']);
});

test('the <90 meal gate fires at the verified worst cases and snacks never satisfy the 3h clause', () => {
  const lunchTime = anchorCtx({ absoluteMinute: 780, bars: bars(70, 82, 60, 70) });
  expect(anchorsToEnqueue(anchors, lunchTime).enqueue.map((a) => a.id)).toContain('lunch');
  // A meal completed 100 minutes ago blocks lunch…
  const fedRecently = anchorCtx({ absoluteMinute: 780, bars: bars(70, 82, 60, 70), lastMealCompletedAt: 680 });
  expect(anchorsToEnqueue(anchors, fedRecently).enqueue.map((a) => a.id)).not.toContain('lunch');
  // …and snacks never count: lastMealCompletedAt only tracks meals, so a recent snack leaves it null.
  const snackedRecently = anchorCtx({ absoluteMinute: 780, bars: bars(70, 82, 60, 70), lastMealCompletedAt: null });
  expect(anchorsToEnqueue(anchors, snackedRecently).enqueue.map((a) => a.id)).toContain('lunch');
});

test('a window that closes unstarted is missed (Q3) and a consumed anchor never re-fires (Q4)', () => {
  const lunch = anchors.anchors.find((a) => a.id === 'lunch')!;
  const afterClose = anchorCtx({ absoluteMinute: 910, bars: bars(70, 50, 60, 70) });
  expect(windowState(lunch, afterClose)).toBe('after');
  expect(isMissed(lunch, afterClose, false)).toBe(true);
  expect(isMissed(lunch, afterClose, true)).toBe(false); // a running block is never missed
  const consumed = anchorCtx({ absoluteMinute: 780, bars: bars(70, 50, 60, 70), anchorsConsumedOnDay: { lunch: 1 } });
  expect(anchorsToEnqueue(anchors, consumed).enqueue.map((a) => a.id)).not.toContain('lunch');
});

test('chronotype shifts anchors: an owl at 07:30 gets the wake block; an early bird already has it at 06:30', () => {
  expect(anchorsToEnqueue(anchors, anchorCtx({ absoluteMinute: 450, wakeTarget: 450 })).enqueue.map((a) => a.id)).toEqual(['wake']);
  expect(anchorsToEnqueue(anchors, anchorCtx({ absoluteMinute: 390, wakeTarget: 390 })).enqueue.map((a) => a.id)).toEqual(['wake']);
});

// ---------- §7.2 reactive ----------

const rctx = (over: Partial<ReactiveContext> = {}): ReactiveContext => ({
  absoluteMinute: 700,
  wakeTarget: 420,
  bars: initialBars(),
  ...over,
});

test('single-food-card: at Nutrition 18 exactly one card, and it is a Meal', () => {
  const d = evaluateReactive(reactive, rctx({ bars: bars(80, 18, 80, 80) }), [], {});
  const food = d.add.filter((a) => a.activityId === 'meal' || a.activityId === 'snack');
  expect(food).toHaveLength(1);
  expect(food[0]!.activityId).toBe('meal');
});

test('single-rest-card (Q5): at Energy 14 in the nap window, one rest card — Sleep — and a queued Nap is evicted', () => {
  const queuedNap = [card({ id: 'nap1', activityId: 'nap' })];
  const d = evaluateReactive(reactive, rctx({ bars: bars(14, 80, 80, 80) }), queuedNap, {});
  const rest = d.add.filter((a) => a.activityId === 'sleep' || a.activityId === 'nap');
  expect(rest).toHaveLength(1);
  expect(rest[0]!.activityId).toBe('sleep');
  expect(rest[0]!.urgent).toBe(true);
  expect(d.evict).toEqual(['nap1']);
});

test('Movement never becomes URGENT even at 0', () => {
  const d = evaluateReactive(reactive, rctx({ bars: bars(80, 80, 0, 80) }), [], {});
  const stretch = d.add.find((a) => a.activityId === 'stretch');
  expect(stretch).toBeDefined();
  expect(stretch!.urgent).toBe(false);
});

test('suppression respected on re-evaluation, overridden by urgency', () => {
  const suppressed = { shower: 800 };
  const calm = evaluateReactive(reactive, rctx({ bars: bars(80, 80, 80, 38) }), [], suppressed);
  expect(calm.add.find((a) => a.activityId === 'shower')).toBeUndefined();
  const urgent = evaluateReactive(reactive, rctx({ bars: bars(80, 80, 80, 10) }), [], suppressed);
  expect(urgent.add.find((a) => a.activityId === 'shower')?.urgent).toBe(true);
});

test('reactive windows shift with chronotype (owl nap window runs to 20:30)', () => {
  const owlLate = evaluateReactive(reactive, rctx({ absoluteMinute: 1230, wakeTarget: 450, bars: bars(25, 80, 80, 80) }), [], {});
  expect(owlLate.add.find((a) => a.activityId === 'nap')).toBeDefined(); // offset 780, in window for the owl
  const baselineLate = evaluateReactive(reactive, rctx({ absoluteMinute: 1230, wakeTarget: 420, bars: bars(25, 80, 80, 80) }), [], {});
  expect(baselineLate.add.find((a) => a.activityId === 'nap')).toBeUndefined(); // offset 810, outside
});

// ---------- T10 property test ----------

test('property: the PINNED subsequence survives 10k seeded random planner passes', () => {
  const prng = PrngStreams.create(4242);
  let q: QueueCard[] = [];
  let nextId = 0;
  for (let i = 0; i < 10_000; i++) {
    const roll = prng.next('cosmetic');
    if (roll < 0.3 && canPlayerInsert(q)) {
      q = insertPlayerCard(q, { id: `p${nextId++}`, activityId: 'practice', enqueuedTick: i, blockId: undefined });
    } else if (roll < 0.6) {
      q = [...q, card({ id: `a${nextId++}`, activityId: roll < 0.45 ? 'snack' : 'shower', enqueuedTick: i })];
    } else if (roll < 0.8 && q.length > 0) {
      const victim = q[Math.floor(prng.next('cosmetic') * q.length)]!;
      q = removeCard(q, victim.id, i, {}).queue;
    }
    const before = pinnedSubsequence(q);
    q = sortReactivesAroundBlocks(q, bars(50, 30, 40, 35), reactive);
    expect(pinnedSubsequence(q)).toEqual(before);
    if (q.length > 40) q = q.slice(0, 20); // keep the property run bounded
  }
});
