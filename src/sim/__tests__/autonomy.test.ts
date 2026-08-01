import { content } from '../content';
import { toFixed } from '../fixed';
import { PrngStreams } from '../prng';
import {
  DEFAULT_SIM_RULES,
  restoreSimRules,
  type AutonomyMode,
} from '../rules';
import { newGameState, type SimState } from '../state';
import { step } from '../step';

function rules(autonomy: AutonomyMode) {
  return restoreSimRules({
    ...DEFAULT_SIM_RULES,
    autonomy,
    key: `test-${autonomy}`,
  });
}

function fresh(): SimState {
  const seed = 1234;
  return newGameState(
    'baseline',
    content.rates,
    seed,
    content.perks,
  );
}

test.each([
  [
    'full-routine',
    ['toilet', 'brush', 'shower', 'meal'],
  ],
  ['essentials-only', ['meal']],
  ['reactive-only', []],
] as const)(
  '%s changes anchor enqueueing exactly',
  (autonomy, expectedWakeActivities) => {
    const next = step(fresh(), [], content, rules(autonomy)).next;
    expect(
      next.queue
        .filter((card) => card.blockId === 'wake#1')
        .map((card) => card.activityId),
    ).toEqual(expectedWakeActivities);
  },
);

test.each([
  'full-routine',
  'essentials-only',
  'reactive-only',
] as const)(
  '%s cannot change night sleep continuation or the wake target',
  (autonomy) => {
    let state = fresh();
    state.clock.absoluteMinute = 23 * 60;
    state.bars.energy = toFixed(79);
    state.queue = [
      {
        id: 'c0',
        activityId: 'sleep',
        owner: 'AUTO',
        urgent: true,
        source: 'reactive',
        reason: {
          kind: 'reactiveTrigger',
          bar: 'energy',
          threshold: 15,
          atMinute: state.clock.absoluteMinute,
        },
        enqueuedTick: state.clock.absoluteMinute,
      },
    ];
    state.current = { type: 'sleep', cardId: 'c0' };

    const events = [];
    while (state.clock.absoluteMinute < 24 * 60 + 7 * 60) {
      const result = step(state, [], content, rules(autonomy));
      state = result.next;
      events.push(...result.events);
    }
    expect(state.clock.absoluteMinute).toBe(24 * 60 + 7 * 60);
    expect(state.current).toBeNull();
    expect(
      events.some(
        (event) =>
          event.type === 'wakeBoundary' && event.detail === '2',
      ),
    ).toBe(true);
  },
);
