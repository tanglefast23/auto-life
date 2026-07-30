import { newSession } from '../session';
import { advanceGame } from '../tick';

test('a completed activity accumulates into the day recap', () => {
  const r = advanceGame(newSession(), [{ type: 'activityCompleted', detail: 'breakfast', atMinute: 480 }]);
  expect(r.session.recap.completedActivityIds).toEqual(['breakfast']);
});

test('a missed anchor is named in the recap', () => {
  const r = advanceGame(newSession(), [{ type: 'anchorMissed', detail: 'morning-routine', atMinute: 600 }]);
  expect(r.session.recap.missedAnchorIds).toEqual(['morning-routine']);
});

test('opening a why-line is recorded — SPEC §12 Goal 1 needs it and no sim event carries it', () => {
  const r = advanceGame(newSession(), [], [{ type: 'whyLineOpened', cardId: 'card-1' }]);
  expect(r.session.observations.whyLineOpened).toBe(true);
});

test('observing a forecast change is recorded — SPEC §12 Goal 2 needs it', () => {
  const r = advanceGame(newSession(), [], [{ type: 'forecastChangeObserved' }]);
  expect(r.session.observations.forecastChangeObserved).toBe(true);
});

test('observations survive the day boundary — goals span the run, the recap does not', () => {
  const seen = advanceGame(newSession(), [], [{ type: 'whyLineOpened', cardId: 'card-1' }]).session;
  const nextDay = advanceGame(seen, [{ type: 'wakeBoundary', detail: '2', atMinute: 0 }]).session;
  expect(nextDay.observations.whyLineOpened).toBe(true);
});

test('crossing the wake boundary starts a fresh recap for the new day', () => {
  const dayOne = advanceGame(newSession(), [
    { type: 'activityCompleted', detail: 'breakfast', atMinute: 480 },
    { type: 'anchorMissed', detail: 'morning-routine', atMinute: 600 },
  ]).session;

  const dayTwo = advanceGame(dayOne, [{ type: 'wakeBoundary', detail: '2', atMinute: 0 }]).session;

  expect(dayTwo.recap).toEqual({
    forDay: 2,
    completedActivityIds: [],
    missedAnchorIds: [],
    practicePoints100: 0,
  });
  expect(dayTwo.morningRecap).toEqual({
    forDay: 1,
    completedActivityIds: ['breakfast'],
    missedAnchorIds: ['morning-routine'],
    practicePoints100: 0,
  });
});

test('Goal 1 completes after three watched activities and one opened why-line', () => {
  const completed = advanceGame(
    newSession(),
    [
      { type: 'activityCompleted', detail: 'toilet', atMinute: 430 },
      { type: 'activityCompleted', detail: 'brush', atMinute: 440 },
      { type: 'activityCompleted', detail: 'shower', atMinute: 460 },
    ],
    [{ type: 'whyLineOpened', cardId: 'wake-shower' }],
  ).session;

  expect(completed.goals['meet-you']).toEqual({
    status: 'complete',
    counters: {
      activitiesCompleted: 3,
      whyLineOpened: 1,
    },
  });
  expect(completed.unlocks.journal).toBe(true);
});

test('Goal 2 completes only after a player edit and an observed forecast change', () => {
  const editOnly = advanceGame(
    newSession(),
    [],
    [],
    [{ type: 'insertPlayer', status: 'accepted', cardId: 'c1' }],
  ).session;
  expect(editOnly.goals['change-of-plans']?.status).toBe('active');
  expect(editOnly.decorations.grantedIds).not.toContain('goal-plant');

  const completed = advanceGame(
    editOnly,
    [],
    [{ type: 'forecastChangeObserved' }],
  ).session;
  expect(completed.goals['change-of-plans']).toEqual({
    status: 'complete',
    counters: {
      queueEdits: 1,
      forecastChangesSeen: 1,
    },
  });
  expect(completed.decorations.grantedIds).toContain('goal-plant');
});

test('the completed Day-1 package opens exactly one decoration choice', () => {
  const fired = advanceGame(
    newSession(),
    [],
    [],
    [{
      type: 'insertWrinkle',
      status: 'accepted',
      cardId: 'c1',
      wrinkleId: 'package-delivery',
      disposition: 'queued',
    }],
  ).session;
  const opened = advanceGame(fired, [
    { type: 'activityCompleted', detail: 'package', atMinute: 620 },
  ]).session;

  expect(opened.wrinkles).toMatchObject({
    pendingId: 'package-delivery',
    choiceReadyId: 'package-delivery',
    resolvedIds: [],
  });

  const chosen = advanceGame(opened, [], [{
    type: 'decorationChosen',
    wrinkleId: 'package-delivery',
    decorationId: 'leafy-plant',
  }]).session;
  expect(chosen.wrinkles).toMatchObject({
    pendingId: null,
    choiceReadyId: null,
    resolvedIds: ['package-delivery'],
  });
  expect(chosen.decorations.grantedIds).toEqual(['leafy-plant']);

  const duplicate = advanceGame(chosen, [], [{
    type: 'decorationChosen',
    wrinkleId: 'package-delivery',
    decorationId: 'sunny-vase',
  }]).session;
  expect(duplicate).toBe(chosen);
});

test('Practice earned during the day is retained in the morning recap', () => {
  const earned = advanceGame(newSession(), [
    { type: 'activityCompleted', detail: 'practice', atMinute: 500 },
    { type: 'practiceAwarded', detail: '3125', atMinute: 500 },
  ]).session;
  const morning = advanceGame(earned, [
    { type: 'wakeBoundary', detail: '2', atMinute: 1860 },
  ]).session;

  expect(morning.morningRecap?.practicePoints100).toBe(3125);
});
