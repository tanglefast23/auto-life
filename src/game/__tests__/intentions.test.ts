import { content } from '../../sim/content';
import type { GameObservation } from '../session';
import { newSession } from '../session';
import { advanceGame } from '../tick';

function observation(
  absoluteMinute: number,
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    day: Math.floor(absoluteMinute / 1440) + 1,
    absoluteMinute,
    minuteOfDay: absoluteMinute % 1440,
    isMidnight: false,
    isMorningCheck: false,
    bars: {
      energy: 420_000,
      nutrition: 420_000,
      movement: 420_000,
      hygiene: 420_000,
    },
    currentActivityId: null,
    urgentCount: 0,
    ...overrides,
  };
}

test('one deliberate intention locks for the day and records its boundary', () => {
  const first = advanceGame(
    newSession(),
    [],
    [{
      type: 'intentionSelected',
      intentionId: 'get-moving',
      day: 1,
      deliberate: true,
    }],
    [],
    observation(501),
    content,
  ).session;

  const second = advanceGame(
    first,
    [],
    [{
      type: 'intentionSelected',
      intentionId: 'eat-properly',
      day: 1,
      deliberate: true,
    }],
    [],
    observation(520),
    content,
  ).session;

  expect(second.intentions.today).toEqual({
    day: 1,
    intentionId: 'get-moving',
    deliberate: true,
    selectedAtMinute: 500,
    biasTargetCompletedAtMinute: null,
  });
});

test('Goal 5 counts only a matching completion after the deliberate choice', () => {
  const earlierCompletion = advanceGame(
    newSession(),
    [{ type: 'activityCompleted', detail: 'treadmill', atMinute: 500 }],
    [{
      type: 'intentionSelected',
      intentionId: 'get-moving',
      day: 1,
      deliberate: true,
    }],
    [],
    observation(501),
    content,
  ).session;
  expect(
    earlierCompletion.intentions.today?.biasTargetCompletedAtMinute,
  ).toBeNull();

  const wrongTarget = advanceGame(
    earlierCompletion,
    [{ type: 'activityCompleted', detail: 'meal', atMinute: 520 }],
    [],
    [],
    observation(521),
    content,
  ).session;
  expect(
    wrongTarget.intentions.today?.biasTargetCompletedAtMinute,
  ).toBeNull();

  const matched = advanceGame(
    wrongTarget,
    [{ type: 'activityCompleted', detail: 'weights', atMinute: 530 }],
    [],
    [],
    observation(531),
    content,
  ).session;
  expect(
    matched.intentions.today?.biasTargetCompletedAtMinute,
  ).toBe(530);
  expect(matched.goals['find-the-rhythm']).toEqual({
    status: 'rewarded',
    counters: { intentionBiasDays: 1 },
  });
  expect(matched.decorations.grantedIds).toContain(
    'practice-poster',
  );
});

test('an automatic or absent choice cannot accidentally complete Goal 5', () => {
  const automatic = advanceGame(
    newSession(),
    [],
    [{
      type: 'intentionSelected',
      intentionId: 'balanced',
      day: 1,
      deliberate: false,
    }],
    [],
    observation(451),
    content,
  ).session;
  const completed = advanceGame(
    automatic,
    [{ type: 'activityCompleted', detail: 'meal', atMinute: 470 }],
    [],
    [],
    observation(471),
    content,
  ).session;

  expect(completed.goals['find-the-rhythm']?.status).toBe('active');
  expect(
    completed.intentions.today?.biasTargetCompletedAtMinute,
  ).toBeNull();
});

test('the wake boundary archives exactly one intention and opens the next day', () => {
  const selected = advanceGame(
    newSession(),
    [],
    [{
      type: 'intentionSelected',
      intentionId: 'balanced',
      day: 1,
      deliberate: true,
    }],
    [],
    observation(451),
    content,
  ).session;
  const dayTwo = advanceGame(
    selected,
    [{ type: 'wakeBoundary', detail: '2', atMinute: 1890 }],
    [],
    [],
    observation(1891),
    content,
  ).session;
  const duplicateBoundary = advanceGame(
    dayTwo,
    [{ type: 'wakeBoundary', detail: '2', atMinute: 1890 }],
    [],
    [],
    observation(1891),
    content,
  ).session;

  expect(duplicateBoundary.intentions.today).toBeNull();
  expect(duplicateBoundary.intentions.history).toEqual([
    selected.intentions.today,
  ]);
});
