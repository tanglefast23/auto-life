import { ForecastCache } from '../forecast-cache';
import { GameLoop } from '../loop';
import { content } from '../../sim/content';
import type { ForecastResult } from '../../sim/forecast';
import { PrngStreams } from '../../sim/prng';
import { newGameState, type SimState } from '../../sim/state';
import { newSession } from '../../game/session';

const fresh = (): SimState =>
  newGameState('baseline', content.rates, 1234, content.perks);

const emptyForecast = (): ForecastResult => ({
  horizonTicks: 0,
  starts: [],
  annotations: [],
  conflicts: [],
  wakeConflicts: [],
  barsAtHorizon: { energy: 100, nutrition: 100, movement: 100, hygiene: 100 },
});

test('the forecast cache invalidates only for schedule, commitment, or game-hour changes', () => {
  let calls = 0;
  const cache = new ForecastCache(() => {
    calls += 1;
    return emptyForecast();
  });
  const s = fresh();
  s.clock.absoluteMinute = 601;

  const first = cache.read(s, content, 0);
  expect(calls).toBe(1);

  // Ordinary bar/progress/time movement inside the same hour is not a refresh trigger.
  const ordinaryTick = JSON.parse(JSON.stringify(s)) as SimState;
  ordinaryTick.clock.absoluteMinute = 602;
  ordinaryTick.bars.energy -= 500;
  expect(cache.read(ordinaryTick, content, 0)).toBe(first);
  expect(calls).toBe(1);

  // Queue/schedule revision.
  const queueEdit = JSON.parse(JSON.stringify(ordinaryTick)) as SimState;
  queueEdit.queue.push({
    id: 'p1',
    activityId: 'practice',
    owner: 'PINNED',
    urgent: false,
    source: 'player',
    enqueuedTick: 602,
  });
  const afterQueue = cache.read(queueEdit, content, 0);
  expect(afterQueue).not.toBe(first);
  expect(calls).toBe(2);

  // Accepted commitment change (materialization is later, invalidation is T3).
  const afterCommitment = cache.read(queueEdit, content, 1);
  expect(afterCommitment).not.toBe(afterQueue);
  expect(calls).toBe(3);

  // Top of the next game-hour.
  const nextHour = JSON.parse(JSON.stringify(queueEdit)) as SimState;
  nextHour.clock.absoluteMinute = 660;
  const afterHour = cache.read(nextHour, content, 1);
  expect(afterHour).not.toBe(afterCommitment);
  expect(calls).toBe(4);

  cache.reset();
  expect(cache.read(nextHour, content, 1).revision).toBe(1);
  expect(calls).toBe(5);
});

test('application publishes queue cards already joined to forecast annotations by card id', () => {
  const loop = new GameLoop(fresh(), content);
  const snapshot = loop.runOneTick();

  expect(snapshot.queue).toHaveLength(5);
  for (const card of snapshot.queue) {
    expect(card.forecast.cardId).toBe(card.id);
    expect(card.forecast.targetObjectId.length).toBeGreaterThan(0);
  }
  // The bounded lookahead may discover later planner cards too; every card that is
  // live *now* must be present, but the result is allowed to know more than the strip.
  expect(snapshot.forecast.annotations.map((a) => a.cardId)).toEqual(
    expect.arrayContaining(snapshot.queue.map((card) => card.id)),
  );
  expect(Object.isFrozen(snapshot.queue)).toBe(true);
  expect(snapshot.queue.every(Object.isFrozen)).toBe(true);
});

test('the live loop reuses a cached forecast through ordinary ticks', () => {
  const loop = new GameLoop(fresh(), content);
  loop.runOneTick(); // empty → wake block: the schedule revision legitimately refreshes
  const stable = loop.snapshot.forecast;

  loop.runOneTick(); // travel/progress only, same queue and same game-hour
  expect(loop.snapshot.forecast).toBe(stable);
});

test('an accepted commitment change refreshes and republishes immediately', () => {
  const published: number[] = [];
  const loop = new GameLoop(fresh(), content, {
    onSnapshot: (snapshot) => published.push(snapshot.forecastRevision),
  });
  const before = loop.snapshot.forecastRevision;

  const refreshed = loop.notifyCommitmentsChanged();

  expect(refreshed.forecastRevision).toBe(before + 1);
  expect(published).toEqual([before + 1]);
});

test('reset clears the forecast cache, pending commands, loop counters, and session state', () => {
  const baseline = new GameLoop(fresh(), content);
  const loop = new GameLoop(fresh(), content);

  loop.enqueue({ type: 'insertPlayer', activityId: 'practice' });
  loop.runOneTick();
  loop.advance(125);
  loop.enqueue({ type: 'insertPlayer', activityId: 'practice' }); // must not survive reset

  loop.reset();

  expect(loop.peekState()).toEqual(fresh());
  expect(loop.session).toEqual(newSession());
  expect(loop.stats).toEqual({ ticksRun: 0, droppedFrames: 0, accumulatorMs: 0 });
  expect(loop.snapshot).toEqual(baseline.snapshot);
  expect(loop.snapshot.forecastRevision).toBe(1);

  loop.runOneTick();
  expect(loop.peekState().queue.filter((c) => c.source === 'player')).toEqual([]);
});
