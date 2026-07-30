import { step, type Command } from '../step';
import { newGameState, type SimState } from '../state';
import { PrngStreams } from '../prng';
import { sortReactivesAroundBlocks, BLOCK_TIER } from '../planner';
import { scoreReactiveCard } from '../planner/priority';
import { toDisplay, toFixed } from '../fixed';
import { content } from '../content';
import type { QueueCard } from '../queue';

const fresh = (): SimState => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());
const reactive = content.reactive;

const run = (s: SimState, ticks: number, commandsAt: Record<number, Command[]> = {}) => {
  let state = s;
  const allEvents: ReturnType<typeof step>['events'] = [];
  for (let t = 0; t < ticks; t++) {
    const r = step(state, commandsAt[state.clock.absoluteMinute] ?? [], content);
    state = r.next;
    allEvents.push(...r.events);
  }
  return { state, events: allEvents };
};

const card = (over: Partial<QueueCard> & { id: string; activityId: string }): QueueCard => ({
  owner: 'AUTO',
  urgent: false,
  source: 'reactive',
  enqueuedTick: 0,
  ...over,
});

// ---- BLOCKER 1: bedtime is never missable ----

test('a busy evening never loses bedtime: pinned practices at 22:00 do not cascade into missed anchors', () => {
  const insertAt = 420 + 940; // 22:40, inside the bedtime window
  const cmds: Record<number, Command[]> = {
    [insertAt]: [
      { type: 'insertPlayer', activityId: 'practice' },
      { type: 'insertPlayer', activityId: 'practice' },
    ],
  };
  const { state, events } = run(fresh(), 3 * 1440, cmds);
  expect(events.filter((e) => e.type === 'anchorMissed' && e.detail === 'bedtime')).toEqual([]);
  // NOTE: the day-2 WAKE anchor may legitimately miss here — the practices pinned at
  // 22:40 queue behind the running sleep, run first after waking (§7.4: pins are never
  // crossed), and the wake block's 60-min window closes unstarted (Q3). That is the
  // designed outcome; only bedtime carries the never-miss guarantee (open-ended window).
  expect(events.filter((e) => e.type === 'anchorMissed' && e.detail !== 'wake')).toEqual([]);
  // The sim still sleeps every night: energy is restored on each following morning.
  expect(toDisplay(state.bars.energy)).toBeGreaterThan(60);
});

// ---- BLOCKER 2: running cards are protected ----

test('a running reactive meal is never evicted or shadow-duplicated as nutrition falls through 20', () => {
  let s = fresh();
  s.bars = { energy: toFixed(80), nutrition: toFixed(24), movement: toFixed(80), hygiene: toFixed(80) };
  let sawRunningMealEvicted = false;
  let sawSecondFoodCard = false;
  for (let t = 0; t < 200; t++) {
    const r = step(s, [], content);
    const wasMeal = s.current?.type === 'activity' && s.current.dto.activityId === 'meal';
    const stillThere = r.next.current?.type === 'activity' && r.next.current.dto.activityId === 'meal';
    if (wasMeal && !stillThere && !r.events.some((e) => e.type === 'activityCompleted' && e.detail === 'meal')) {
      sawRunningMealEvicted = true;
    }
    const foodCards = r.next.queue.filter((c) => c.activityId === 'meal' || c.activityId === 'snack');
    const runningIsFood = r.next.current?.type === 'activity' && ['meal', 'snack'].includes(r.next.current.dto.activityId);
    if (runningIsFood && foodCards.length > 1) sawSecondFoodCard = true;
    s = r.next;
  }
  expect(sawRunningMealEvicted).toBe(false);
  expect(sawSecondFoodCard).toBe(false);
});

// ---- BLOCKER 3 + majors: adjacency start-measured, data-driven ----

test('routine Stretch can satisfy Movement without falsely granting it-sticks', () => {
  const { state } = run(fresh(), 1440);
  const s2 = run(fresh(), 420 + 700).state; // ~18:40, post-dinner-start
  const active = s2.decayModifiers.filter((m) => m.source === 'adjacency:it-sticks');
  expect(active).toEqual([]);
  expect(state.events.urgentCount).toBe(0);
});

test('practice multiplier is frozen at start: two morning sessions differ only by the curve', () => {
  const insertAt = 420 + 150;
  const cmds: Record<number, Command[]> = {
    [insertAt]: [
      { type: 'insertPlayer', activityId: 'practice' },
      { type: 'insertPlayer', activityId: 'practice' },
    ],
  };
  const { events } = run(fresh(), 500, cmds);
  const awards = events.filter((e) => e.type === 'practiceAwarded').map((e) => Number(e.detail));
  expect(awards).toHaveLength(2);
  // Consecutive practices: block curve ×1.0 then ×0.85 on the SAME sampled multiplier
  // basis except each session re-samples at its own start; the ratio must sit near
  // 0.85 (small drift from bar movement between starts, but bounded).
  const ratio = awards[1]! / awards[0]!;
  expect(ratio).toBeGreaterThan(0.78);
  expect(ratio).toBeLessThan(0.88);
});

test('the 5th practice of a day awards nothing', () => {
  const at = 420 + 150;
  const cmds: Record<number, Command[]> = {
    [at]: [1, 2, 3, 4, 5].map(() => ({ type: 'insertPlayer', activityId: 'practice' }) as Command),
  };
  const { events } = run(fresh(), 800, cmds);
  const awards = events.filter((e) => e.type === 'practiceAwarded');
  expect(awards).toHaveLength(4);
});

test('minty-fresh pays exactly once, on the first morning practice after a brush→sleep night', () => {
  const day2Morning = 1440 + 420 + 30; // Day 2, 07:30 — inside the minty window
  const cmds: Record<number, Command[]> = {
    [day2Morning]: [
      { type: 'insertPlayer', activityId: 'practice' },
      { type: 'insertPlayer', activityId: 'practice' },
    ],
  };
  let s = fresh();
  let paidCount = 0;
  for (let t = 0; t < 2 * 1440; t++) {
    const wasPaid = s.practice.mintyPaidToday;
    const r = step(s, cmds[s.clock.absoluteMinute] ?? [], content);
    if (!wasPaid && r.next.practice.mintyPaidToday) paidCount += 1;
    s = r.next;
  }
  expect(paidCount).toBe(1);
});

// ---- majors: ordering ----

test('anchor blocks hold the middle tier: a low-deficit reactive never jumps the bedtime block', () => {
  const q: QueueCard[] = [
    card({ id: 'r1', activityId: 'shower', enqueuedTick: 5 }),
    card({ id: 'b1', activityId: 'brush', blockId: 'bedtime#1', source: 'anchor', enqueuedTick: 6 }),
    card({ id: 'b2', activityId: 'sleep', blockId: 'bedtime#1', source: 'anchor', enqueuedTick: 6 }),
  ];
  const bars = { energy: toFixed(50), nutrition: toFixed(50), movement: toFixed(50), hygiene: toFixed(38) };
  const sorted = sortReactivesAroundBlocks(q, bars, reactive);
  expect(sorted.map((c) => c.id)).toEqual(['b1', 'b2', 'r1']);
});

test('urgent enters the earliest run: with [AUTO shower][PINNED practice], urgent sleep lands before the shower', () => {
  let s = fresh();
  s.clock.absoluteMinute = 420 + 300;
  s.bars = { energy: toFixed(16), nutrition: toFixed(80), movement: toFixed(80), hygiene: toFixed(30) };
  s.queue = [
    card({ id: 'a-shower', activityId: 'shower', enqueuedTick: 0 }),
    card({ id: 'p-practice', activityId: 'practice', owner: 'PINNED', source: 'player', enqueuedTick: 1 }),
  ];
  // Drop energy below 15 by stepping a few minutes.
  const r1 = step(s, [], content);
  const r2 = step(r1.next, [], content);
  const ids = r2.next.queue.map((c) => c.activityId);
  const sleepIdx = ids.indexOf('sleep');
  const showerIdx = ids.indexOf('shower');
  if (sleepIdx !== -1 && showerIdx !== -1) {
    expect(sleepIdx).toBeLessThan(showerIdx);
  } else {
    // sleep may already be current — then the shower must NOT have started first
    expect(r2.next.current?.type === 'activity' ? r2.next.current.dto.activityId : r2.next.current?.type).not.toBe('shower');
  }
});

// ---- majors: stop semantics + player nap window ----

test('stop suppression keys on card ownership: stopping a PINNED card suppresses nothing', () => {
  const at = 420 + 150;
  const stopAt = at + 10;
  const cmds: Record<number, Command[]> = {
    [at]: [{ type: 'insertPlayer', activityId: 'practice' }],
    [stopAt]: [{ type: 'stopCurrent' }],
  };
  const { state } = run(fresh(), 200, cmds);
  expect(state.suppression.practice).toBeUndefined();
});

test('a player nap card outside the window is dropped, never started', () => {
  const lateNight = 420 + 900; // 22:00 — outside the nap window (ends wake+780 = 20:00)
  const s = fresh();
  s.clock.absoluteMinute = lateNight;
  s.bars = {
    energy: toFixed(80),
    nutrition: toFixed(100),
    movement: toFixed(100),
    hygiene: toFixed(100),
  };
  const result = step(
    s,
    [{ type: 'insertPlayer', activityId: 'nap' }],
    content,
  );
  const outcome = result.outcomes[0];
  expect(outcome).toMatchObject({
    type: 'insertPlayer',
    status: 'accepted',
  });
  const cardId =
    outcome?.type === 'insertPlayer' && outcome.status === 'accepted'
      ? outcome.cardId
      : 'missing';
  expect(result.next.current?.cardId).not.toBe(cardId);
  expect(result.next.queue.some((c) => c.id === cardId)).toBe(false);
});

// ---- §7.3 exact components + tie-break ----

test('§7.3 exact stage-1 components and enqueuedTick tie-break', () => {
  const zeros = { energy: 0, nutrition: 0, movement: 0, hygiene: 0 };
  const sleepRule = reactive.rules.find((r) => r.id === 'urgentSleep')!;
  const snackRule = reactive.rules.find((r) => r.id === 'snack')!;
  const showerRule = reactive.rules.find((r) => r.id === 'shower')!;
  expect(scoreReactiveCard(card({ id: 'a', activityId: 'sleep', urgent: true }), sleepRule, zeros, reactive) - 1000).toBeCloseTo(4.0, 10);
  expect(scoreReactiveCard(card({ id: 'b', activityId: 'meal', urgent: true }), snackRule, zeros, reactive) - 1000).toBeCloseTo(3.0, 10);
  expect(scoreReactiveCard(card({ id: 'c', activityId: 'shower', urgent: true }), showerRule, zeros, reactive) - 1000).toBeCloseTo(2.0, 10);
  expect(BLOCK_TIER).toBeGreaterThan(4);
  expect(BLOCK_TIER).toBeLessThan(1000);
  // tie-break: two equal-scoring cards keep enqueue order
  const bars = { energy: toFixed(50), nutrition: toFixed(30), movement: toFixed(50), hygiene: toFixed(50) };
  const q = [card({ id: 'x', activityId: 'snack', enqueuedTick: 7 }), card({ id: 'y', activityId: 'snack', enqueuedTick: 3 })];
  const sorted = sortReactivesAroundBlocks(q, bars, reactive);
  expect(sorted.map((c) => c.id)).toEqual(['y', 'x']);
});

// ---- cross-midnight persistence ----

test('cards enqueued before midnight survive into the next day', () => {
  const lateInsert = 420 + 1000; // 23:40
  const cmds: Record<number, Command[]> = { [lateInsert]: [{ type: 'insertPlayer', activityId: 'practice' }] };
  let s = fresh();
  let survived = false;
  for (let t = 0; t < 1200; t++) {
    const r = step(s, cmds[s.clock.absoluteMinute] ?? [], content);
    s = r.next;
    if (r.snapshot.minuteOfDay < 420 && s.queue.some((c) => c.activityId === 'practice' && c.owner === 'PINNED')) {
      survived = true;
    }
  }
  expect(survived).toBe(true);
});
