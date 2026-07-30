import { content } from '../content';
import { toFixed } from '../fixed';
import {
  compareRoutineSortKeys,
  scoreBucket,
  sortReactivesAroundBlocks,
  type RoutineSortKey,
} from '../planner';
import type { QueueCard } from '../queue';

const card = (
  id: string,
  activityId: 'shower' | 'stretch',
  enqueuedTick = 10,
): QueueCard => ({
  id,
  activityId,
  owner: 'AUTO',
  urgent: false,
  source: 'reactive',
  enqueuedTick,
});

const equalBucketBars = {
  energy: toFixed(80),
  nutrition: toFixed(80),
  movement: toFixed(17.5),
  hygiene: toFixed(30),
};

test('Routine memory score buckets use exact round(baseScore x 10) boundaries', () => {
  expect(scoreBucket(1.049)).toBe(10);
  expect(scoreBucket(1.05)).toBe(11);
  expect(scoreBucket(0.049)).toBe(0);
  expect(scoreBucket(0.05)).toBe(1);
});

test('Routine rank breaks only a same-bucket non-urgent reactive tie', () => {
  const queue = [
    card('shower-card', 'shower', 1),
    card('stretch-card', 'stretch', 2),
  ];
  expect(
    sortReactivesAroundBlocks(
      queue,
      equalBucketBars,
      content.reactive,
    ).map((entry) => entry.id),
  ).toEqual(['shower-card', 'stretch-card']);
  expect(
    sortReactivesAroundBlocks(
      queue,
      equalBucketBars,
      content.reactive,
      {
        rankByActivity: { shower: 20, stretch: 3 },
        absentRank: 3_000_000,
      },
    ).map((entry) => entry.id),
  ).toEqual(['stretch-card', 'shower-card']);
});

test('the Routine-memory comparator is antisymmetric and transitive', () => {
  const keys: RoutineSortKey[] = [
    {
      scoreBucket: 5,
      routineRank: 2,
      enqueuedTick: 10,
      stableId: 'a',
    },
    {
      scoreBucket: 5,
      routineRank: 3,
      enqueuedTick: 1,
      stableId: 'b',
    },
    {
      scoreBucket: 4,
      routineRank: 0,
      enqueuedTick: 0,
      stableId: 'c',
    },
    {
      scoreBucket: 4,
      routineRank: 0,
      enqueuedTick: 0,
      stableId: 'd',
    },
  ];
  for (const a of keys) {
    for (const b of keys) {
      expect(
        Math.sign(compareRoutineSortKeys(a, b)) +
          Math.sign(compareRoutineSortKeys(b, a)),
      ).toBe(0);
      for (const c of keys) {
        if (
          compareRoutineSortKeys(a, b) <= 0 &&
          compareRoutineSortKeys(b, c) <= 0
        ) {
          expect(compareRoutineSortKeys(a, c)).toBeLessThanOrEqual(
            0,
          );
        }
      }
    }
  }
});

test('every permutation of the same tied run produces one stable order', () => {
  const queue = [
    card('shower-b', 'shower'),
    card('stretch-b', 'stretch'),
    card('shower-a', 'shower'),
    card('stretch-a', 'stretch'),
  ];
  const expected = [
    'stretch-a',
    'stretch-b',
    'shower-a',
    'shower-b',
  ];
  for (const permutation of permutations(queue)) {
    expect(
      sortReactivesAroundBlocks(
        permutation,
        equalBucketBars,
        content.reactive,
        {
          rankByActivity: { shower: 20, stretch: 3 },
          absentRank: 3_000_000,
        },
      ).map((entry) => entry.id),
    ).toEqual(expected);
  }
});

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    permutations([
      ...values.slice(0, index),
      ...values.slice(index + 1),
    ]).map((tail) => [value, ...tail]),
  );
}
