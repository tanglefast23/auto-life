import { step, type Command } from '../step';
import { newGameState, type SimState } from '../state';
import { PrngStreams } from '../prng';
import { evaluateReactive } from '../planner/reactive';
import { toDisplay, toFixed } from '../fixed';
import { content, objectForActivity } from '../content';
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

/** Park every anchor as consumed today so constructed scenarios stay isolated. */
const consumeAnchors = (s: SimState): void => {
  const d = dayNumber(s.clock.absoluteMinute);
  for (const a of content.anchors.anchors) s.anchorsConsumedOnDay[a.id] = d;
};

const healthyBars = () => ({ energy: toFixed(80), nutrition: toFixed(80), movement: toFixed(80), hygiene: toFixed(80) });

// ---- adjacency pairs previously certified but never executed (round-2 plan finding) ----

test('warmed-up halves the shower duration when it starts within 30 min of a workout end', () => {
  const run = (lastActivity: string, isWorkout: boolean) => {
    const s = fresh();
    consumeAnchors(s);
    s.clock.absoluteMinute = 420 + 200;
    s.bars = healthyBars();
    s.position = at('shower');
    s.lastCompletion = { activityId: lastActivity, isWorkout, atMinute: s.clock.absoluteMinute - 10 };
    // PINNED: a reactive shower card at healthy hygiene would auto-clean before starting.
    s.queue = [card({ id: 'sh', activityId: 'shower', owner: 'PINNED', source: 'player' })];
    const r = step(s, [], content);
    if (r.next.current?.type !== 'activity') throw new Error('shower did not start');
    return r.next.current.dto.durationTicks;
  };
  const control = run('toilet', false);
  const warmed = run('weights', true);
  expect(warmed).toBe(Math.ceil(control / 2));
});

test('cramp applies its exact fixed-point movement penalty when a workout starts within 30 min of a meal', () => {
  const run = (lastActivity: string) => {
    const s = fresh();
    consumeAnchors(s);
    s.clock.absoluteMinute = 420 + 200;
    s.bars = healthyBars();
    s.position = at('weights');
    s.lastCompletion = { activityId: lastActivity, isWorkout: false, atMinute: s.clock.absoluteMinute - 10 };
    s.queue = [card({ id: 'w', activityId: 'weights' })];
    return step(s, [], content).next.bars.movement;
  };
  const control = run('snack');
  const cramped = run('meal');
  expect(control - cramped).toBe(toFixed(10)); // −10 display, exactly −60000 fixed
});

test('fresh-mind multiplies the practice award sample by exactly 1.2 after a recent shower', () => {
  const run = (lastActivity: string) => {
    const s = fresh();
    consumeAnchors(s);
    s.clock.absoluteMinute = 420 + 200;
    s.bars = healthyBars();
    s.position = at('practice');
    s.lastCompletion = { activityId: lastActivity, isWorkout: false, atMinute: s.clock.absoluteMinute - 10 };
    s.queue = [card({ id: 'p', activityId: 'practice', owner: 'PINNED', source: 'player' })];
    const r = step(s, [], content);
    if (r.next.current?.type !== 'activity') throw new Error('practice did not start');
    return r.next.current.dto.sampled.pointsMultiplier ?? 1;
  };
  const ratio = run('shower') / run('toilet');
  expect(ratio).toBeCloseTo(1.2, 10);
});

// ---- §6.7 lifecycle: stopping either activity early cancels the bonus ----

test('stopping the meal early revokes the it-sticks modifier it banked at start', () => {
  const setup = () => {
    const s = fresh();
    consumeAnchors(s);
    s.clock.absoluteMinute = 420 + 200;
    s.bars = healthyBars();
    s.position = at('meal');
    s.lastCompletion = { activityId: 'weights', isWorkout: true, atMinute: s.clock.absoluteMinute - 10 };
    // PINNED: a reactive meal card at healthy nutrition would auto-clean before starting.
    s.queue = [card({ id: 'm', activityId: 'meal', owner: 'PINNED', source: 'player' })];
    return step(s, [], content).next;
  };
  const started = setup();
  expect(started.decayModifiers.some((m) => m.source === 'adjacency:it-sticks')).toBe(true);
  const stopped = step(started, [{ type: 'stopCurrent' }], content).next;
  expect(stopped.decayModifiers.some((m) => m.source === 'adjacency:it-sticks')).toBe(false);
  const kept = step(setup(), [], content).next; // control: no stop, modifier persists
  expect(kept.decayModifiers.some((m) => m.source === 'adjacency:it-sticks')).toBe(true);
});

test('stopping a sleep that armed minty disarms it; a completed arming is untouched', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 940; // 22:40, inside the bedtime window
  // E below 80: pre-23:00 a sleep at E≥80 would legitimately end the same tick (§7.1).
  s.bars = { energy: toFixed(60), nutrition: toFixed(80), movement: toFixed(80), hygiene: toFixed(80) };
  s.position = at('sleep');
  s.lastCompletion = { activityId: 'brush', isWorkout: false, atMinute: s.clock.absoluteMinute - 5 };
  s.queue = [card({ id: 'sl', activityId: 'sleep', source: 'anchor', blockId: `bedtime#${dayNumber(s.clock.absoluteMinute)}` })];
  const started = step(s, [], content).next;
  expect(started.practice.mintyArmed).toBe(true);
  expect(started.current?.type).toBe('sleep');
  const stopped = step(started, [{ type: 'stopCurrent' }], content).next;
  expect(stopped.practice.mintyArmed).toBe(false);
});

// ---- §7.2 row 6: urgency is live ----

test('a queued non-urgent meal card is PROMOTED when nutrition crosses below 15 and outranks the wake block', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = { energy: toFixed(80), nutrition: toFixed(14), movement: toFixed(80), hygiene: toFixed(80) };
  s.position = at('meal');
  const d = dayNumber(s.clock.absoluteMinute);
  s.queue = [
    card({ id: 'b1', activityId: 'toilet', source: 'anchor', blockId: `wake#${d}`, enqueuedTick: 1 }),
    card({ id: 'b2', activityId: 'shower', source: 'anchor', blockId: `wake#${d}`, enqueuedTick: 1 }),
    card({ id: 'rm', activityId: 'meal', urgent: false, enqueuedTick: 2 }), // added back at N≈19, never urgent
  ];
  const r = step(s, [], content);
  expect(r.events.some((e) => e.type === 'urgent' && e.detail === 'nutrition')).toBe(true);
  expect(r.next.events.urgentCount).toBe(1);
  // The promoted meal starts immediately — grooming never precedes eating at N<15.
  expect(r.next.current?.type === 'activity' && r.next.current.dto.activityId).toBe('meal');
});

test('urgentCount is crossing-based: deleting and re-adding cards during one crisis counts once', () => {
  let s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = { energy: toFixed(80), nutrition: toFixed(14), movement: toFixed(80), hygiene: toFixed(80) };
  s.position = { x: 4, y: 2 }; // away from the microwave — the card travels, so we can delete it
  for (let t = 0; t < 6; t++) {
    const foodCard = s.queue.find((c) => c.activityId === 'meal' || c.activityId === 'snack');
    const cmds: Command[] = foodCard ? [{ type: 'removeCard', cardId: foodCard.id }] : [];
    const r = step(s, cmds, content);
    // hold nutrition in-crisis so the same crossing persists
    r.next.bars.nutrition = toFixed(14);
    s = r.next;
  }
  expect(s.events.urgentCount).toBe(1);
});

test('recovery DEMOTES: a promoted card returns to stage-2 when its bar recovers above 15', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = { energy: toFixed(80), nutrition: toFixed(14), movement: toFixed(80), hygiene: toFixed(80) };
  s.position = { x: 4, y: 2 };
  const r1 = step(s, [], content);
  const promoted = r1.next.queue.find((c) => c.activityId === 'meal');
  expect(promoted?.urgent).toBe(true);
  r1.next.bars.nutrition = toFixed(22); // recovered above 15, still below the meal creation threshold + 10
  const r2 = step(r1.next, [], content);
  const demoted = r2.next.queue.find((c) => c.activityId === 'meal');
  expect(demoted?.urgent).toBe(false);
  expect(r2.next.urgentActive.nutrition).toBe(false);
});

// ---- nap budget: the planner never books flavor rest ----

test('after the effective nap budget is spent, the reactive tier stops offering naps', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 300;
  s.bars = { energy: toFixed(25), nutrition: toFixed(80), movement: toFixed(80), hygiene: toFixed(80) };
  s.napEffectiveUsesToday = 1; // budget (1/day) spent
  const r = step(s, [], content);
  expect(r.next.queue.find((c) => c.activityId === 'nap')).toBeUndefined();
});

test('a player-pinned nap after budget exhaustion still runs — as flavor, restoring nothing', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 300;
  s.bars = { energy: toFixed(25), nutrition: toFixed(80), movement: toFixed(80), hygiene: toFixed(80) };
  s.napEffectiveUsesToday = 1;
  s.position = at('nap');
  s.queue = [card({ id: 'pn', activityId: 'nap', owner: 'PINNED', source: 'player' })];
  const r = step(s, [], content);
  expect(r.next.current?.type === 'activity' && r.next.current.dto.sampled.effectiveUse).toBe(false);
});

// ---- phantom bedtime: stale blocks retire at sleep end, consumption keys the block's day ----

test('a bedtime overtaken by urgent sleep is retired at wake and does NOT consume the new day', () => {
  const s = fresh();
  const wakeMin = 3 * 1440 + 419; // 06:59 on the day whose wake boundary is about to hit
  s.clock.absoluteMinute = wakeMin;
  s.bars = { energy: toFixed(95), nutrition: toFixed(60), movement: toFixed(60), hygiene: toFixed(60) };
  const today = dayNumber(wakeMin);
  const staleDay = today - 1;
  s.queue = [
    card({ id: 'u1', activityId: 'sleep', urgent: true, enqueuedTick: 5 }),
    card({ id: 'sb1', activityId: 'brush', source: 'anchor', blockId: `bedtime#${staleDay}`, enqueuedTick: 6 }),
    card({ id: 'sb2', activityId: 'sleep', source: 'anchor', blockId: `bedtime#${staleDay}`, enqueuedTick: 6 }),
  ];
  s.current = { type: 'sleep', cardId: 'u1' };
  const r = step(s, [], content); // sleep ends at wakeTarget inside this tick
  expect(r.next.queue.filter((c) => c.blockId?.startsWith('bedtime#'))).toEqual([]);
  expect(r.next.anchorsConsumedOnDay['bedtime']).toBe(staleDay);
  expect(r.next.anchorsConsumedOnDay['bedtime']).not.toBe(today);
});

test('a bedtime block starting after midnight consumes ITS OWN day — tonight\'s bedtime is untouched', () => {
  const s = fresh();
  consumeAnchors(s);
  const lateNight = 3 * 1440 + 30; // 00:30
  s.clock.absoluteMinute = lateNight;
  s.bars = { energy: toFixed(40), nutrition: toFixed(80), movement: toFixed(80), hygiene: toFixed(80) };
  s.position = at('brush');
  const blockDay = dayNumber(lateNight) - 1; // yesterday's bedtime, pushed past midnight by pins
  delete s.anchorsConsumedOnDay['bedtime'];
  s.queue = [
    card({ id: 'bb1', activityId: 'brush', source: 'anchor', blockId: `bedtime#${blockDay}`, enqueuedTick: 3 }),
    card({ id: 'bb2', activityId: 'sleep', source: 'anchor', blockId: `bedtime#${blockDay}`, enqueuedTick: 3 }),
  ];
  const r = step(s, [], content);
  expect(r.next.anchorsConsumedOnDay['bedtime']).toBe(blockDay);
  expect(r.next.anchorsConsumedOnDay['bedtime']).not.toBe(dayNumber(lateNight));
});

// ---- command robustness ----

test('the 11th player insert is rejected per-command — the tick never crashes', () => {
  const s = fresh();
  consumeAnchors(s);
  s.bars = healthyBars();
  const cmds: Command[] = Array.from({ length: 11 }, () => ({ type: 'insertPlayer', activityId: 'practice' }) as Command);
  const r = step(s, cmds, content);
  expect(r.next.queue.filter((c) => c.owner === 'PINNED' && c.source === 'player')).toHaveLength(10);
});

test('removing the travel target stops the walk', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = healthyBars();
  s.position = { x: 4, y: 2 }; // at the bed, far from the guitar
  s.queue = [card({ id: 'p1', activityId: 'practice', owner: 'PINNED', source: 'player' })];
  const r1 = step(s, [], content);
  expect(r1.next.current?.type).toBe('travel');
  const r2 = step(r1.next, [{ type: 'removeCard', cardId: 'p1' }], content);
  expect(r2.next.current === null || r2.next.current.type !== 'travel' || r2.next.current.cardId !== 'p1').toBe(true);
  expect(r2.next.queue.find((c) => c.id === 'p1')).toBeUndefined();
});

// ---- §7.4 dedup, stated directly ----

test('dedup: an active rule adds nothing when an AUTO card for its winner already exists', () => {
  const bars = { energy: toFixed(80), nutrition: toFixed(80), movement: toFixed(80), hygiene: toFixed(30) };
  const queue = [card({ id: 'sh', activityId: 'shower' })];
  const decision = evaluateReactive(content.reactive, { absoluteMinute: 420 + 200, wakeTarget: 420, bars }, queue, {});
  expect(decision.add.find((a) => a.activityId === 'shower')).toBeUndefined();
});

// ---- §7.1 continue-sleeping clause ----

test('night sleep continues past Energy 80 and ends exactly at wakeTarget', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 2 * 1440 + 240; // 04:00 — deep night
  s.bars = { energy: toFixed(85), nutrition: toFixed(60), movement: toFixed(60), hygiene: toFixed(60) };
  s.queue = [card({ id: 'sl', activityId: 'sleep', enqueuedTick: 1 })];
  s.current = { type: 'sleep', cardId: 'sl' };
  let cur = s;
  for (let t = 0; t < 60; t++) {
    cur = step(cur, [], content).next;
    expect(cur.current?.type).toBe('sleep'); // 04:00–05:00: still asleep at E>80
  }
  while (cur.current?.type === 'sleep') cur = step(cur, [], content).next;
  expect(cur.clock.absoluteMinute % 1440).toBe(420); // woke exactly at wakeTarget
});
