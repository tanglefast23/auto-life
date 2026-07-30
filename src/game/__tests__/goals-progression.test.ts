import { content } from '../../sim/content';
import { toFixed } from '../../sim/fixed';
import { practiceLevel } from '../../sim/practice-level';
import type {
  GameObservation,
  SessionState,
} from '../session';
import { newSession, restoreSession } from '../session';
import { advanceGame } from '../tick';

const fullRoutine = {
  autonomy: 'full-routine' as const,
  practicePoints100: 0,
};

function observation(
  day: number,
  kind: 'ordinary' | 'midnight' | 'morning',
  barValue = 70,
): GameObservation {
  const minuteOfDay =
    kind === 'midnight' ? 0 : kind === 'morning' ? 540 : 600;
  return {
    day,
    absoluteMinute: (day - 1) * 1440 + minuteOfDay,
    minuteOfDay,
    isMidnight: kind === 'midnight',
    isMorningCheck: kind === 'morning',
    bars: {
      energy: toFixed(barValue),
      nutrition: toFixed(barValue),
      movement: toFixed(barValue),
      hygiene: toFixed(barValue),
    },
    currentActivityId: null,
    urgentCount: 0,
  };
}

function sampledDay(
  session: SessionState,
  day: number,
  options: {
    practices?: number;
    urgent?: number;
    barValue?: number;
    autonomy?: 'full-routine' | 'essentials-only';
  } = {},
): SessionState {
  const practices = options.practices ?? 2;
  const urgent = options.urgent ?? 0;
  const existing = session.calendarLedger.days.filter(
    (entry) => entry.day !== day,
  );
  const prepared: SessionState = {
    ...session,
    calendarLedger: {
      days: [
        ...existing,
        {
          day,
          midnight: null,
          morningCheck: null,
          practiceSessions: practices,
          urgentEvents: urgent,
          resolvedWrinkleId: null,
          firstReactiveCompletionPositions: {
            shower: 0,
            snack: 1,
          },
        },
      ],
    },
  };
  const context = {
    autonomy: options.autonomy ?? ('full-routine' as const),
    practicePoints100: 0,
  };
  const midnight = advanceGame(
    prepared,
    [],
    [],
    [],
    observation(day + 1, 'midnight'),
    content,
    context,
  ).session;
  return advanceGame(
    midnight,
    [],
    [],
    [],
    observation(day + 1, 'morning', options.barValue ?? 70),
    content,
    context,
  ).session;
}

test('Practice levels use cumulative integer x100 points at exact thresholds', () => {
  expect(practiceLevel(9_999, content.practice.levels)).toBe(0);
  expect(practiceLevel(10_000, content.practice.levels)).toBe(1);
  expect(practiceLevel(29_999, content.practice.levels)).toBe(1);
  expect(practiceLevel(30_000, content.practice.levels)).toBe(2);
  expect(practiceLevel(69_999, content.practice.levels)).toBe(2);
  expect(practiceLevel(70_000, content.practice.levels)).toBe(3);
});

test('Goal 4 banks its idle reward exactly once across a completion-boundary reload', () => {
  const crossed = advanceGame(
    newSession(),
    [],
    [],
    [],
    observation(2, 'ordinary'),
    content,
    { ...fullRoutine, practicePoints100: 10_000 },
  ).session;
  const restored = restoreSession(
    JSON.parse(JSON.stringify(crossed)),
  );
  const repeated = advanceGame(
    restored,
    [],
    [],
    [],
    observation(2, 'ordinary'),
    content,
    { ...fullRoutine, practicePoints100: 10_000 },
  ).session;

  expect(repeated.goals['first-chord']).toEqual({
    status: 'rewarded',
    counters: { practiceLevel: 1 },
  });
  expect(repeated.recap.rewardIds).toEqual(['air-guitar']);
});

test('Goal 3 requires a resolved non-urgent wrinkle day and Full routine', () => {
  const dayOne = {
    day: 1,
    midnight: null,
    morningCheck: null,
    practiceSessions: 0,
    urgentEvents: 0,
    resolvedWrinkleId: 'package-delivery',
    firstReactiveCompletionPositions: {},
  };
  const prepared = newSession();
  prepared.calendarLedger.days = [dayOne];

  const completed = advanceGame(
    prepared,
    [],
    [],
    [],
    observation(2, 'midnight'),
    content,
    fullRoutine,
  ).session;
  expect(completed.goals['handle-the-wrinkle']?.status).toBe(
    'complete',
  );

  const chosen = advanceGame(
    completed,
    [],
    [
      {
        type: 'goalRewardChosen',
        goalId: 'handle-the-wrinkle',
        choiceId: 'wrinkle-print',
      },
    ],
    [],
    observation(2, 'ordinary'),
    content,
    fullRoutine,
  ).session;
  const duplicate = advanceGame(
    chosen,
    [],
    [
      {
        type: 'goalRewardChosen',
        goalId: 'handle-the-wrinkle',
        choiceId: 'wrinkle-keepsake',
      },
    ],
    [],
    observation(2, 'ordinary'),
    content,
    fullRoutine,
  ).session;
  expect(duplicate.goals['handle-the-wrinkle']?.status).toBe(
    'rewarded',
  );
  expect(duplicate.decorations.grantedIds).toEqual([
    'wrinkle-print',
  ]);
  expect(duplicate.recap.rewardIds).toEqual([
    'wrinkle-decoration',
  ]);

  const quiet = newSession();
  quiet.calendarLedger.days = [
    { ...dayOne, resolvedWrinkleId: null },
  ];
  expect(
    advanceGame(
      quiet,
      [],
      [],
      [],
      observation(2, 'midnight'),
      content,
      fullRoutine,
    ).session.goals['handle-the-wrinkle']?.status,
  ).toBe('active');
  expect(
    advanceGame(
      prepared,
      [],
      [],
      [],
      observation(2, 'midnight'),
      content,
      {
        autonomy: 'essentials-only',
        practicePoints100: 0,
      },
    ).session.goals['handle-the-wrinkle']?.status,
  ).toBe('active');
});

test('Goal 6 samples the prior day at wake plus two hours and unlocks bounded Routine memory', () => {
  let session = newSession();
  session = sampledDay(session, 1);
  session = sampledDay(session, 2);
  session = sampledDay(session, 3);

  expect(session.goals['balanced-week']).toEqual({
    status: 'rewarded',
    counters: { consecutiveBalancedDays: 3 },
  });
  expect(session.unlocks.routineMemory).toBe(true);
  expect(
    session.routineMemory.completedDays.map((entry) => entry.day),
  ).toEqual([1, 2, 3]);
  expect(session.recap.rewardIds).toContain('routine-memory');

  const duplicateSample = advanceGame(
    session,
    [],
    [],
    [],
    observation(4, 'morning'),
    content,
    fullRoutine,
  ).session;
  expect(
    duplicateSample.goals['balanced-week']?.counters
      .consecutiveBalancedDays,
  ).toBe(3);
});

test('Goal 6 resets on a bad sample and never progresses below Full routine', () => {
  let reset = sampledDay(newSession(), 1);
  reset = sampledDay(reset, 2, { barValue: 64 });
  reset = sampledDay(reset, 3);
  expect(
    reset.goals['balanced-week']?.counters
      .consecutiveBalancedDays,
  ).toBe(1);

  let restricted = newSession();
  restricted = sampledDay(restricted, 1, {
    autonomy: 'essentials-only',
  });
  restricted = sampledDay(restricted, 2, {
    autonomy: 'essentials-only',
  });
  restricted = sampledDay(restricted, 3, {
    autonomy: 'essentials-only',
  });
  expect(
    restricted.goals['balanced-week']?.counters
      .consecutiveBalancedDays,
  ).toBe(0);
  expect(restricted.unlocks.routineMemory).toBe(false);
});
