import { GameLoop } from '../loop';
import { newGameState } from '../../sim/state';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newSession } from '../../game/session';

/**
 * P4 T1. `application/` is the composition root (master §4): it owns the top-level tick
 * that advances `sim/` and then folds the resulting events through `game/`. Neither ring
 * knows about the loop, and `game/` never runs before the sim step it is observing.
 */

const fresh = () => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

test('a new loop starts on a fresh session', () => {
  expect(new GameLoop(fresh(), content).session).toEqual(newSession());
});

test('the loop folds sim events into the session', () => {
  let firstCompleted: string | null = null;
  const loop = new GameLoop(fresh(), content, {
    onEvents: (events) => {
      for (const e of events) if (e.type === 'activityCompleted' && firstCompleted === null) firstCompleted = e.detail;
    },
  });

  // Stop at the first completion rather than running a fixed count: a full day crosses
  // the wake boundary, which correctly clears the recap, so a count-based assertion
  // would be testing the rollover instead of the fold.
  for (let i = 0; i < 1440 && firstCompleted === null; i++) loop.runOneTick();

  expect(firstCompleted).not.toBeNull();
  expect(loop.session.recap.completedActivityIds).toContain(firstCompleted);
});

test('a full day rolls the recap over to the next day', () => {
  const loop = new GameLoop(fresh(), content);
  for (let i = 0; i < 1440; i++) loop.runOneTick();

  // Day 1's activities completed and were recapped; crossing the wake boundary starts
  // day 2 clean. Both halves of that are the point.
  expect(loop.session.recap).toMatchObject({
    forDay: 2,
    completedActivityIds: [],
    missedAnchorIds: [],
    practicePoints100: 0,
    practiceSessions: 0,
    mealCount: 0,
  });
});

test('typed wrinkle outcomes reach the game fold instead of being dropped by the loop', () => {
  const loop = new GameLoop(fresh(), content);
  loop.enqueue({
    type: 'insertWrinkle',
    wrinkleId: 'package-delivery',
    activityId: 'practice',
  });

  loop.runOneTick();

  expect(loop.session.wrinkles).toMatchObject({
    firedIds: ['package-delivery'],
    pendingId: 'package-delivery',
    choiceReadyId: null,
    resolvedIds: [],
  });
});

test('UI observations queued by the composition root reach the same ordered game fold', () => {
  const loop = new GameLoop(fresh(), content);
  loop.enqueueAction({ type: 'whyLineOpened', cardId: 'card-1' });
  loop.enqueueAction({ type: 'forecastChangeObserved' });

  loop.runOneTick();

  expect(loop.session.observations).toEqual({
    whyLineOpened: true,
    forecastChangeObserved: true,
  });
});
