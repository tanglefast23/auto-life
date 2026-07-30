import { content } from '../content';
import { toFixed } from '../fixed';
import {
  ROUTINE_NEED_THRESHOLD,
  ROUTINE_QUEUE_TARGET,
  refillRoutineQueue,
} from '../planner/routine';
import type { QueueCard } from '../queue';
import { PrngStreams } from '../prng';
import { newGameState } from '../state';
import { step } from '../step';
import type { Bars } from '../types';

function bars(
  energy: number,
  nutrition: number,
  movement: number,
  hygiene: number,
): Bars {
  return {
    energy: toFixed(energy),
    nutrition: toFixed(nutrition),
    movement: toFixed(movement),
    hygiene: toFixed(hygiene),
  };
}

function refill(
  queue: readonly QueueCard[],
  currentCardId: string | null,
  currentBars: Bars,
): QueueCard[] {
  let sequence = 1;
  return refillRoutineQueue({
    queue,
    currentCardId,
    bars: currentBars,
    absoluteMinute: 600,
    wakeTarget: 420,
    napEffectiveUsesToday: 0,
    content,
    createCardId: () => `routine-${sequence++}`,
  });
}

test('healthy free time fills all five visible slots with reading', () => {
  const queue = refill([], null, bars(100, 100, 100, 100));

  expect(queue).toHaveLength(ROUTINE_QUEUE_TARGET);
  expect(queue.map((card) => card.activityId)).toEqual([
    'read',
    'read',
    'read',
    'read',
    'read',
  ]);
  expect(queue.every((card) => card.source === 'routine')).toBe(true);
  expect(
    queue.every(
      (card) =>
        card.reason?.kind === 'routinePlan' &&
        card.reason.bar === null,
    ),
  ).toBe(true);
});

test('bars below 80 reserve maintenance slots before productive fillers', () => {
  const queue = refill([], null, bars(100, 70, 60, 70));

  expect(ROUTINE_NEED_THRESHOLD).toBe(80);
  expect(queue.map((card) => card.activityId)).toEqual([
    'snack',
    'quickwash',
    'stretch',
    'read',
    'read',
  ]);
  expect(
    queue.slice(0, 3).map((card) =>
      card.reason?.kind === 'routinePlan'
        ? card.reason.bar
        : null,
    ),
  ).toEqual(['nutrition', 'hygiene', 'movement']);
});

test('a newly hungry sim replaces the next filler without touching the current card', () => {
  const healthy = refill([], null, bars(100, 100, 100, 100));
  const currentId = healthy[0]!.id;
  const hungry = refill(
    healthy,
    currentId,
    bars(100, 79, 100, 100),
  );

  expect(hungry).toHaveLength(ROUTINE_QUEUE_TARGET);
  expect(hungry[0]!.id).toBe(currentId);
  expect(hungry[0]!.activityId).toBe('read');
  expect(hungry[1]!.activityId).toBe('snack');
  expect(hungry.slice(2).map((card) => card.activityId)).toEqual([
    'read',
    'read',
    'read',
  ]);
});

test('the real step path publishes five cards at wake and keeps five after a completion', () => {
  let state = newGameState(
    'baseline',
    content.rates,
    1234,
    PrngStreams.create(1234).serialize(),
  );
  let firstQueue: string[] | null = null;
  let sawCompletion = false;

  for (let tick = 0; tick < 180; tick += 1) {
    const result = step(state, [], content);
    state = result.next;
    if (firstQueue === null) {
      firstQueue = result.snapshot.queue.map((card) => card.activityId);
    }
    expect(result.snapshot.queue).toHaveLength(ROUTINE_QUEUE_TARGET);
    if (result.events.some((event) => event.type === 'activityCompleted')) {
      sawCompletion = true;
      break;
    }
  }

  expect(firstQueue).toEqual([
    'toilet',
    'brush',
    'shower',
    'meal',
    'stretch',
  ]);
  expect(sawCompletion).toBe(true);
});

test('the real step path moves a Snack into the next slot when Nutrition dips below 80', () => {
  let state = newGameState(
    'baseline',
    content.rates,
    1234,
    PrngStreams.create(1234).serialize(),
  );

  for (let tick = 0; tick < 500; tick += 1) {
    state = step(state, [], content).next;
    if (
      state.current?.type === 'activity' &&
      state.current.dto.activityId === 'read'
    ) {
      state.bars.nutrition = toFixed(79);
      const result = step(state, [], content);
      const upcoming = result.snapshot.queue.filter(
        (card) => card.id !== result.snapshot.currentCardId,
      );
      expect(result.snapshot.queue).toHaveLength(ROUTINE_QUEUE_TARGET);
      expect(upcoming[0]?.activityId).toBe('snack');
      return;
    }
  }

  throw new Error('expected the routine to reach productive reading');
});

test('severe hunger upgrades an unstarted routine Snack to the existing reactive Meal', () => {
  const state = newGameState(
    'baseline',
    content.rates,
    1234,
    PrngStreams.create(1234).serialize(),
  );
  state.clock.absoluteMinute = 600;
  state.bars = bars(100, 19, 100, 100);
  state.queue = refill([], null, state.bars);
  state.nextCardSeq = 100;

  const result = step(state, [], content);

  expect(
    result.snapshot.queue.some(
      (card) =>
        card.activityId === 'meal' &&
        card.source === 'reactive',
    ),
  ).toBe(true);
  expect(
    result.snapshot.queue.some(
      (card) => card.activityId === 'snack',
    ),
  ).toBe(false);
});
