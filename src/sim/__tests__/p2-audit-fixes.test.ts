import { step, type Command } from '../step';
import { newGameState, type SimState } from '../state';
import { PrngStreams } from '../prng';
import { moveCard } from '../queue';
import { toFixed } from '../fixed';
import { content, objectForActivity, type ContentRegistry } from '../content';
import { dayNumber } from '../clock';
import type { QueueCard } from '../queue';

const fresh = (): SimState => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

const card = (over: Partial<QueueCard> & { id: string; activityId: string }): QueueCard => ({
  owner: 'AUTO',
  urgent: false,
  source: 'reactive',
  enqueuedTick: 0,
  ...over,
});

const at = (activityId: string): { x: number; y: number } => {
  const [x, y] = objectForActivity(activityId).interactPoint;
  return { x, y };
};

const consumeAnchors = (s: SimState): void => {
  const d = dayNumber(s.clock.absoluteMinute);
  for (const a of content.anchors.anchors) s.anchorsConsumedOnDay[a.id] = d;
};

const healthyBars = () => ({ energy: toFixed(80), nutrition: toFixed(80), movement: toFixed(80), hygiene: toFixed(80) });

const cloneContent = (): ContentRegistry => JSON.parse(JSON.stringify(content)) as ContentRegistry;

// ---- audit fix 1: the reorder verb ----

test('moveCard pins the moved AUTO card and the placement survives the sorter across ticks', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = { energy: toFixed(80), nutrition: toFixed(33), movement: toFixed(80), hygiene: toFixed(38) };
  s.position = { x: 4, y: 2 };
  s.queue = [
    card({ id: 'sn', activityId: 'snack', enqueuedTick: 1 }),
    card({ id: 'sh', activityId: 'shower', enqueuedTick: 2 }),
  ];
  const r = step(s, [{ type: 'moveCard', cardId: 'sh', toIndex: 0 }], content);
  const moved = r.next.queue.find((c) => c.id === 'sh');
  expect(moved?.owner).toBe('PINNED');
  expect(r.next.queue.findIndex((c) => c.id === 'sh')).toBeLessThan(r.next.queue.findIndex((c) => c.id === 'sn'));
  const r2 = step(r.next, [], content); // the sorter must not undo a player placement
  const idxSh = r2.next.queue.findIndex((c) => c.id === 'sh');
  const idxSn = r2.next.queue.findIndex((c) => c.id === 'sn');
  if (idxSh !== -1 && idxSn !== -1) expect(idxSh).toBeLessThan(idxSn);
});

test('moveCard clamps out-of-range indices and no-ops on unknown ids', () => {
  const q = [card({ id: 'a', activityId: 'snack' }), card({ id: 'b', activityId: 'shower' })];
  expect(moveCard(q, 'a', 99).map((c) => c.id)).toEqual(['b', 'a']);
  expect(moveCard(q, 'a', -5).map((c) => c.id)).toEqual(['a', 'b']);
  expect(moveCard(q, 'nope', 0).map((c) => c.id)).toEqual(['a', 'b']);
});

test('the §6.9 morning puzzle works: moving the wake-block meal ahead of the shower reorders breakfast', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 100;
  s.bars = healthyBars();
  s.position = at('toilet');
  const d = dayNumber(s.clock.absoluteMinute);
  s.queue = [
    card({ id: 'b1', activityId: 'toilet', source: 'anchor', blockId: `wake#${d}`, enqueuedTick: 1 }),
    card({ id: 'b2', activityId: 'brush', source: 'anchor', blockId: `wake#${d}`, enqueuedTick: 1 }),
    card({ id: 'b3', activityId: 'shower', source: 'anchor', blockId: `wake#${d}`, enqueuedTick: 1 }),
    card({ id: 'b4', activityId: 'meal', source: 'anchor', blockId: `wake#${d}`, enqueuedTick: 1 }),
  ];
  let cur = step(s, [{ type: 'moveCard', cardId: 'b4', toIndex: 2 }], content).next;
  expect(cur.queue.find((c) => c.id === 'b4')?.owner).toBe('PINNED');
  const completions: string[] = [];
  for (let t = 0; t < 180; t++) {
    const r = step(cur, [], content);
    cur = r.next;
    for (const e of r.events) if (e.type === 'activityCompleted') completions.push(e.detail);
  }
  const mealIdx = completions.indexOf('meal');
  const showerIdx = completions.indexOf('shower');
  expect(mealIdx).toBeGreaterThanOrEqual(0);
  expect(showerIdx).toBeGreaterThanOrEqual(0);
  expect(mealIdx).toBeLessThan(showerIdx); // eat-first, by reordering — SPEC §6.9
});

// ---- audit fix 2: the engine reads ONLY the injected registry ----

test('a swapped content registry actually changes behavior (no module-global shadowing)', () => {
  const modified = cloneContent();
  const shower = modified.activities.activities.find((a) => a.id === 'shower');
  if (shower === undefined || shower.kind !== 'timed') throw new Error('shower def missing');
  shower.baseMin = 40; // doubled from 20
  const run = (registry: ContentRegistry) => {
    const s = fresh();
    consumeAnchors(s);
    s.clock.absoluteMinute = 420 + 200;
    s.bars = healthyBars();
    s.position = at('shower');
    s.queue = [card({ id: 'sh', activityId: 'shower', owner: 'PINNED', source: 'player' })];
    const r = step(s, [], registry);
    if (r.next.current?.type !== 'activity') throw new Error('shower did not start');
    return r.next.current.dto.durationTicks;
  };
  // Exact integer durations at E=80 (denom 780000): 20 min → 16 ticks, 40 min → 31.
  // Before the fix both runs returned 16 — the global registry shadowed the argument.
  expect(run(content)).toBe(16);
  expect(run(modified)).toBe(31);
});

// ---- audit fix 3: adjacency is data-driven ----

test('a synthetic pair authored ONLY in content fires with zero engine knowledge of its id', () => {
  const modified = cloneContent();
  modified.adjacency.pairs.push({
    id: 'synthetic-audit-pair',
    first: 'stretch',
    second: 'snack',
    gapMaxMin: 30,
    effect: { kind: 'barDelta', deltas: { hygiene: -5 } },
  } as ContentRegistry['adjacency']['pairs'][number]);
  const run = (registry: ContentRegistry) => {
    const s = fresh();
    consumeAnchors(s);
    s.clock.absoluteMinute = 420 + 200;
    s.bars = healthyBars();
    s.position = at('snack');
    s.lastCompletion = { activityId: 'stretch', isWorkout: false, atMinute: s.clock.absoluteMinute - 10 };
    s.queue = [card({ id: 'sn', activityId: 'snack', owner: 'PINNED', source: 'player' })];
    return step(s, [], registry).next.bars.hygiene;
  };
  expect(run(content) - run(modified)).toBe(toFixed(5)); // exactly −5 display from the authored pair
});

// ---- audit fix 4: minty refund on stopped practice ----

test('stopping a minty-consuming practice refunds the payment; the next practice re-earns it', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 30; // before the morning check
  s.bars = healthyBars();
  s.position = at('practice');
  s.practice.mintyArmed = true;
  s.queue = [card({ id: 'p1', activityId: 'practice', owner: 'PINNED', source: 'player' })];
  const started = step(s, [], content).next;
  expect(started.practice.mintyPaidToday).toBe(true);
  expect(started.current?.type === 'activity' && started.current.dto.consumedMinty).toBe(true);
  const stopped = step(started, [{ type: 'stopCurrent' }], content).next;
  expect(stopped.practice.mintyPaidToday).toBe(false); // §6.7: no payout, no burn
  expect(stopped.practice.mintyArmed).toBe(true); // arming survives for the retry
  // §7.4 handed the freed slot to the routine tail on the stop tick. This scenario is
  // the player re-queueing Practice instead, so it replaces both the queue and the slot.
  stopped.current = null;
  stopped.queue = [card({ id: 'p2', activityId: 'practice', owner: 'PINNED', source: 'player', enqueuedTick: 5 })];
  const retried = step(stopped, [], content).next;
  expect(retried.practice.mintyPaidToday).toBe(true); // re-earned by the retry
});

// ---- audit fix 6: stale blocks retire at the wake boundary too ----

test('an all-nighter (no sleep end) still retires yesterday\'s bedtime at the wake boundary', () => {
  const s = fresh();
  const preWake = 2 * 1440 + 415; // 06:55 — awake, mid-practice, no endSleep coming
  s.clock.absoluteMinute = preWake;
  s.bars = { energy: toFixed(40), nutrition: toFixed(60), movement: toFixed(60), hygiene: toFixed(60) };
  s.position = at('practice');
  consumeAnchors(s);
  const today = dayNumber(preWake);
  const staleDay = today - 1;
  delete s.anchorsConsumedOnDay['bedtime'];
  s.queue = [
    card({ id: 'pp', activityId: 'practice', owner: 'PINNED', source: 'player', enqueuedTick: 1 }),
    card({ id: 'sb1', activityId: 'brush', source: 'anchor', blockId: `bedtime#${staleDay}`, enqueuedTick: 2 }),
    card({ id: 'sb2', activityId: 'sleep', source: 'anchor', blockId: `bedtime#${staleDay}`, enqueuedTick: 2 }),
  ];
  let cur = s;
  for (let t = 0; t < 10; t++) cur = step(cur, [], content).next; // crosses 07:00 mid-practice
  expect(cur.queue.filter((c) => c.blockId?.startsWith('bedtime#'))).toEqual([]);
  expect(cur.anchorsConsumedOnDay['bedtime']).toBe(staleDay);
});
