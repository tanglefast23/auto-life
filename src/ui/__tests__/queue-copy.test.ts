import { whyLine } from '../queue-copy';

test('routine maintenance explains the need and threshold plainly', () => {
  expect(
    whyLine({
      kind: 'routinePlan',
      bar: 'nutrition',
      threshold: 80,
      atMinute: 600,
    }),
  ).toBe('Added: Nutrition is below 80.');
});

test('productive free time explains repeated reading plainly', () => {
  expect(
    whyLine({
      kind: 'routinePlan',
      bar: null,
      threshold: 80,
      atMinute: 600,
    }),
  ).toBe('Added: Needs covered. Time to read.');
});
