import { step, type Command } from '../step';
import { newGameState, type SimState } from '../state';
import { PrngStreams } from '../prng';
import { playerCardCount } from '../queue';
import { toDisplay, toFixed } from '../fixed';
import { content, objectForActivity } from '../content';
import { dayNumber, minuteOfDay } from '../clock';
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

// ---- audit-2 #1: the stale sweep never touches a PINNED sibling ----

test('retiring a stale block spares a player-pinned sibling card', () => {
  const s = fresh();
  const wakeMin = 3 * 1440 + 419;
  s.clock.absoluteMinute = wakeMin;
  s.bars = { energy: toFixed(95), nutrition: toFixed(60), movement: toFixed(60), hygiene: toFixed(60) };
  const staleDay = dayNumber(wakeMin) - 1;
  s.queue = [
    card({ id: 'u1', activityId: 'sleep', urgent: true, enqueuedTick: 5 }),
    // The player moved (detached+pinned) the stale block's brush — it is THEIRS.
    card({ id: 'pb', activityId: 'brush', owner: 'PINNED', source: 'anchor', blockId: `bedtime#${staleDay}`, enqueuedTick: 6 }),
    card({ id: 'sb', activityId: 'sleep', source: 'anchor', blockId: `bedtime#${staleDay}`, enqueuedTick: 6 }),
  ];
  s.current = { type: 'sleep', cardId: 'u1' };
  const r = step(s, [], content); // endSleep at wakeTarget retires the stale block
  expect(r.next.queue.find((c) => c.id === 'sb')).toBeUndefined(); // AUTO member retired
  expect(r.next.queue.find((c) => c.id === 'pb')).toBeDefined(); // PINNED sibling survives
});

// ---- audit-2 #2: consumption is monotonic ----

test('a stale prior-day card starting late never moves the consumption marker backward', () => {
  const s = fresh();
  consumeAnchors(s);
  const d = dayNumber(2 * 1440 + 420 + 200);
  s.clock.absoluteMinute = 2 * 1440 + 420 + 200;
  s.bars = healthyBars();
  s.position = at('toilet');
  s.anchorsConsumedOnDay['wake'] = d; // today's wake already consumed
  // A detached, player-pinned survivor from YESTERDAY's wake block starts now.
  s.queue = [card({ id: 'old', activityId: 'toilet', owner: 'PINNED', source: 'anchor', blockId: `wake#${d - 1}` })];
  const r = step(s, [], content);
  expect(r.next.anchorsConsumedOnDay['wake']).toBe(d); // NOT d-1 — no resurrected duplicate
  expect(r.next.queue.filter((c) => c.blockId === `wake#${d}`)).toEqual([]); // no second wake block
});

// ---- audit-2 #4: the continue clause boundary is exactly 23:00 ----

test('urgent sleep at Energy ≥80 ends at 22:59 but continues from 23:00', () => {
  const mk = (minuteBefore: number): SimState => {
    const s = fresh();
    consumeAnchors(s);
    s.clock.absoluteMinute = 2 * 1440 + minuteBefore;
    s.bars = { energy: toFixed(85), nutrition: toFixed(60), movement: toFixed(60), hygiene: toFixed(60) };
    s.queue = [card({ id: 'u', activityId: 'sleep', urgent: true })];
    s.current = { type: 'sleep', cardId: 'u' };
    return s;
  };
  const before = step(mk(1378), [], content).next; // now+1 = 22:59 — not night
  expect(before.current).toBeNull();
  const after = step(mk(1379), [], content).next; // now+1 = 23:00 — night begins
  expect(after.current?.type).toBe('sleep');
});

// ---- audit-2 #5: practice block status resets at wake ----

test('the consecutive-practice curve does not survive the wake boundary', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 2 * 1440 + 419; // 06:59
  s.bars = healthyBars();
  s.practice.prevCompletionWasPractice = true; // an all-night chain just ended
  const r = step(s, [], content); // crosses 07:00
  expect(r.next.practice.prevCompletionWasPractice).toBe(false);
});

// ---- audit-2 #6: cap counts only INSERTED cards; provenance never rewritten ----

test('promoting an anchor card via objectClick pins it without consuming the player cap', () => {
  const s = fresh();
  consumeAnchors(s);
  s.bars = healthyBars();
  const d = dayNumber(s.clock.absoluteMinute);
  s.queue = [card({ id: 'a1', activityId: 'shower', source: 'anchor', blockId: `wake#${d}` })];
  const fill: Command[] = Array.from({ length: 10 }, () => ({ type: 'insertPlayer', activityId: 'practice' }) as Command);
  const r1 = step(s, fill, content);
  expect(playerCardCount(r1.next.queue)).toBe(10); // cap full
  const r2 = step(r1.next, [{ type: 'objectClick', activityId: 'shower' }], content);
  const promoted = r2.next.queue.find((c) => c.activityId === 'shower');
  expect(promoted?.owner).toBe('PINNED');
  expect(promoted?.source).toBe('anchor'); // provenance preserved
  expect(playerCardCount(r2.next.queue)).toBe(10); // promotion cost nothing
});

// ---- audit-2 #7: removing the running card stops it ----

test('removeCard aimed at the running activity stops it (suppression + bonus revocation included)', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = healthyBars();
  // N=18: below the meal-supersession threshold so the queued AUTO meal IS the
  // group winner (at 25 the evaluator would evict it for a snack; at 80 cleanup
  // would poof it), and above 15 so no urgent machinery muddies the assertions.
  s.bars = { energy: toFixed(80), nutrition: toFixed(18), movement: toFixed(80), hygiene: toFixed(80) };
  s.position = at('meal');
  s.lastCompletion = { activityId: 'weights', isWorkout: true, atMinute: s.clock.absoluteMinute - 10 };
  s.queue = [card({ id: 'm', activityId: 'meal' })];
  const started = step(s, [], content).next;
  expect(started.current?.type).toBe('activity');
  expect(started.decayModifiers.some((m) => m.source === 'adjacency:it-sticks')).toBe(true);
  const removed = step(started, [{ type: 'removeCard', cardId: 'm' }], content).next;
  expect(removed.current).toBeNull(); // stopped, not continuing invisibly
  expect(removed.queue.find((c) => c.id === 'm')).toBeUndefined();
  expect(removed.decayModifiers.some((m) => m.source === 'adjacency:it-sticks')).toBe(false); // §6.7 revoked
  expect(removed.suppression['meal']).toBeDefined(); // AUTO stop suppresses the type
});

// ---- audit-2 #3: travel measurement is arrival-inclusive ----

test('snapshot.processed counts every travel tick including arrival, and a one-tile journey counts 1', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = healthyBars();
  const target = at('practice');
  s.position = { x: target.x - 1, y: target.y }; // one tile away
  s.queue = [card({ id: 'p', activityId: 'practice', owner: 'PINNED', source: 'player' })];
  const r1 = step(s, [], content);
  expect(r1.snapshot.processed).toBe('travel'); // the one-tick journey IS a travel minute
  expect(r1.next.current?.type).toBe('activity'); // post-step already shows the activity (why the old count missed it)
  const r2 = step(r1.next, [], content);
  expect(r2.snapshot.processed).toBe('activity');
});

// ---- audit-1: anchors fire at their target, not window-open ----

test('lunch enqueues at its 13:00 target, not the 12:00 window-open', () => {
  const mk = (offsetMin: number): SimState => {
    const s = fresh();
    const base = 2 * 1440 + 420;
    s.clock.absoluteMinute = base + offsetMin;
    s.bars = { energy: toFixed(80), nutrition: toFixed(60), movement: toFixed(80), hygiene: toFixed(80) };
    consumeAnchors(s);
    delete s.anchorsConsumedOnDay['lunch'];
    s.lastMealCompletedAt = s.clock.absoluteMinute - 400; // meal long ago — gate passes
    return s;
  };
  const atOpen = step(mk(300), [], content).next; // 12:00 — window open, before target
  expect(atOpen.queue.filter((c) => c.blockId?.startsWith('lunch#'))).toEqual([]);
  const atTarget = step(mk(360), [], content).next; // 13:00 — target reached
  expect(atTarget.queue.filter((c) => c.blockId?.startsWith('lunch#')).length).toBeGreaterThan(0);
});

test('a day-5 steady-state trace runs on TARGET times (lunch 13:00, workout 17:30, dinner 19:00, bed 23:00)', () => {
  let s = fresh();
  const starts: Array<{ min: number; what: string }> = [];
  for (let t = 0; t < 5 * 1440; t++) {
    const day = dayNumber(s.clock.absoluteMinute);
    const preMin = minuteOfDay(s.clock.absoluteMinute);
    const preCur = s.current;
    const r = step(s, [], content);
    const cur = r.next.current;
    if (day === 5 && cur !== null && (preCur === null || preCur.type === 'travel') && cur.type !== 'travel') {
      starts.push({ min: preMin, what: cur.type === 'activity' ? cur.dto.activityId : cur.type });
    }
    s = r.next;
  }
  const firstAfter = (what: string, minMin: number) => starts.find((x) => x.what === what && x.min >= minMin)?.min;
  const lunch = firstAfter('meal', 700); // ≥11:40
  const dinner = firstAfter('meal', 1100); // ≥18:20
  const workout = firstAfter('weights', 900);
  const sleep = starts.find((x) => x.what === 'sleep')?.min;
  expect(lunch).toBeGreaterThanOrEqual(780); // 13:00+ (travel shifts start slightly later)
  expect(lunch).toBeLessThanOrEqual(790);
  expect(workout).toBeGreaterThanOrEqual(1050); // 17:30+
  expect(workout).toBeLessThanOrEqual(1060);
  expect(dinner).toBeGreaterThanOrEqual(1140); // 19:00+
  expect(dinner).toBeLessThanOrEqual(1150);
  expect(sleep).toBeGreaterThanOrEqual(1355); // brush at 22:30 target, sleep just after
  expect(sleep).toBeLessThanOrEqual(1380);
});
