import { content } from '../content';
import { toFixed } from '../fixed';
import { newGameState } from '../state';
import { restoreSimRules, type SimRules } from '../rules';
import { step } from '../step';

function rules(
  policy:
    | NonNullable<SimRules['intention']>['policy']
    | null,
  overrides: Partial<SimRules> = {},
): SimRules {
  return restoreSimRules({
    revision: 1,
    key: `test-${policy?.kind ?? 'none'}`,
    autonomy: 'full-routine',
    intention:
      policy === null
        ? null
        : {
            id: policy.kind === 'balanced' ? 'balanced' : policy.kind,
            selectedDay: 1,
            deliberate: true,
            policy,
            workoutsCompletedToday: 0,
          },
    preferences: {
      foodMood: null,
      idleVariantId: null,
    },
    objectBlocks: [],
    activitySlowdowns: [],
    activityOverrides: [],
    availabilityGates: [],
    anchorOverrides: [],
    wakeModifier: null,
    ...overrides,
  });
}

function freshAt(minute: number) {
  const state = newGameState('baseline', content.rates, 7, content.perks);
  state.clock.absoluteMinute = minute;
  state.queue = [];
  state.current = null;
  state.anchorsConsumedOnDay = {};
  state.anchorMutationGenerations = {};
  return state;
}

function queuedActivityIds(
  result: ReturnType<typeof step>,
): string[] {
  return result.next.queue.map((card) => card.activityId);
}

test('Balanced leaves the existing wake routine untouched', () => {
  const result = step(
    freshAt(420),
    [],
    content,
    rules({ kind: 'balanced' }),
  );
  expect(queuedActivityIds(result)).toEqual([
    'toilet',
    'brush',
    'shower',
    'meal',
    'stretch',
  ]);
});

test('Take it easy suppresses the workout anchor and favors Quick wash', () => {
  const takeItEasy = rules({
    kind: 'take-it-easy',
    suppressAnchorId: 'workout',
    favorQuickVariants: true,
  });
  const wake = step(freshAt(420), [], content, takeItEasy);
  expect(queuedActivityIds(wake)).toEqual([
    'toilet',
    'brush',
    'quickwash',
    'meal',
    'stretch',
  ]);

  const workout = freshAt(1050);
  workout.bars.movement = toFixed(40);
  expect(
    queuedActivityIds(step(workout, [], content, takeItEasy)),
  ).not.toContain('weights');

  const hygiene = freshAt(700);
  hygiene.bars.hygiene = toFixed(39);
  expect(
    queuedActivityIds(step(hygiene, [], content, takeItEasy)),
  ).toContain('quickwash');
});

test('Get moving suggests one Stretch and waives the second workout cost', () => {
  const getMoving = rules({
    kind: 'get-moving',
    suggestActivityId: 'stretch',
    waiveSecondWorkoutCrossCost: true,
  });
  const suggestion = step(freshAt(540), [], content, getMoving);
  expect(queuedActivityIds(suggestion)).toContain('stretch');

  let state = freshAt(700);
  state.position = { x: 8, y: 11 };
  const secondWorkoutRules = restoreSimRules({
    ...getMoving,
    intention: {
      ...getMoving.intention!,
      workoutsCompletedToday: 1,
    },
  });
  const started = step(
    state,
    [{ type: 'insertPlayer', activityId: 'weights' }],
    content,
    secondWorkoutRules,
  );
  expect(started.next.current?.type).toBe('activity');
  if (started.next.current?.type !== 'activity') {
    throw new Error('weights did not start');
  }
  expect(started.next.current.dto.effectTotalsFixed.nutrition).toBe(0);
});

test('Eat properly plans a Meal first and treats Nutrition 60 as well-fed', () => {
  const eatProperly = rules({
    kind: 'eat-properly',
    preferActivityId: 'meal',
    wellFedThreshold: 60,
  });
  const hungry = freshAt(700);
  hungry.bars.nutrition = toFixed(34);
  const planned = queuedActivityIds(
    step(hungry, [], content, eatProperly),
  );
  expect(planned).toContain('meal');
  expect(planned).not.toContain('snack');

  const practice = freshAt(700);
  practice.bars.nutrition = toFixed(65);
  practice.position = { x: 6, y: 9 };
  const started = step(
    practice,
    [{ type: 'insertPlayer', activityId: 'practice' }],
    content,
    eatProperly,
  );
  expect(started.next.current?.type).toBe('activity');
  if (started.next.current?.type !== 'activity') {
    throw new Error('practice did not start');
  }
  expect(started.next.current.dto.sampled.wellFed).toBe(true);
});

test('Practice focus never schedules Practice without player acceptance', () => {
  const result = step(
    freshAt(540),
    [],
    content,
    rules({
      kind: 'practice-focus',
      suggestedActivityId: 'practice',
      protectContiguousBlock: true,
    }),
  );
  expect(queuedActivityIds(result)).not.toContain('practice');
});

test('the active food preference changes only the planner choice', () => {
  const state = freshAt(700);
  state.bars.nutrition = toFixed(34);
  const properMealRules = rules(null, {
    preferences: {
      foodMood: 'proper-meals',
      idleVariantId: null,
    },
  });
  const planned = queuedActivityIds(
    step(state, [], content, properMealRules),
  );
  expect(planned).toContain('meal');
  expect(planned).not.toContain('snack');
});

test.each([
  [
    'take-it-easy',
    rules({
      kind: 'take-it-easy',
      suppressAnchorId: 'workout',
      favorQuickVariants: true,
    }),
  ],
  [
    'get-moving',
    rules({
      kind: 'get-moving',
      suggestActivityId: 'stretch',
      waiveSecondWorkoutCrossCost: true,
    }),
  ],
] as const)(
  '%s completes a deterministic full-day trace without changing clock closure',
  (_name, dayRules) => {
    let state = freshAt(420);
    const completed: string[] = [];
    for (let tick = 0; tick < 1440; tick += 1) {
      const result = step(state, [], content, dayRules);
      state = result.next;
      completed.push(
        ...result.events
          .filter((event) => event.type === 'activityCompleted')
          .map((event) => event.detail),
      );
    }
    expect(state.clock.absoluteMinute).toBe(1860);
    if (dayRules.intention?.policy.kind === 'take-it-easy') {
      expect(completed).not.toContain('weights');
      expect(completed).not.toContain('treadmill');
      expect(completed).toContain('quickwash');
    } else {
      expect(completed).toContain('stretch');
    }
  },
);
