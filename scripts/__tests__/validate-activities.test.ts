import { ActivitiesSchema } from '../../src/sim/content-schemas';
import rawActivities from '../../content/activities.json';

const cloned = (): { activities: Array<Record<string, unknown>> } =>
  JSON.parse(JSON.stringify(rawActivities));

test('the real activities.json parses', () => {
  expect(() => ActivitiesSchema.parse(rawActivities)).not.toThrow();
});

test('duplicate ids fail', () => {
  const bad = cloned();
  bad.activities.push({ ...bad.activities[0] } as Record<string, unknown>);
  expect(() => ActivitiesSchema.parse(bad)).toThrow(/duplicate/);
});

test('unknown keys fail (strict objects)', () => {
  const bad = cloned();
  bad.activities[1]!.surprise = true;
  expect(() => ActivitiesSchema.parse(bad)).toThrow();
});

test('effect maps reject unknown bars, accept signed finite values', () => {
  const bad = cloned();
  (bad.activities.find((a) => a.id === 'snack')!.effects as Record<string, number>).charisma = 5;
  expect(() => ActivitiesSchema.parse(bad)).toThrow();

  const signed = cloned();
  (signed.activities.find((a) => a.id === 'snack')!.effects as Record<string, number>).energy = -2;
  expect(() => ActivitiesSchema.parse(signed)).not.toThrow();

  const inf = cloned();
  (inf.activities.find((a) => a.id === 'snack')!.effects as Record<string, number>).nutrition = Infinity;
  expect(() => ActivitiesSchema.parse(inf)).toThrow();
});

test('timed baseMin must be a positive integer', () => {
  const bad = cloned();
  bad.activities.find((a) => a.id === 'brush')!.baseMin = 0;
  expect(() => ActivitiesSchema.parse(bad)).toThrow();
  const frac = cloned();
  frac.activities.find((a) => a.id === 'brush')!.baseMin = 4.5;
  expect(() => ActivitiesSchema.parse(frac)).toThrow();
});

test('fillStartsAfterFraction must be in [0, 1)', () => {
  const bad = cloned();
  bad.activities.find((a) => a.id === 'meal')!.fillStartsAfterFraction = 1;
  expect(() => ActivitiesSchema.parse(bad)).toThrow();
});

test('sleepWindow/idle cannot masquerade as timed activities', () => {
  const bad = cloned();
  bad.activities.find((a) => a.id === 'sleep')!.baseMin = 1;
  expect(() => ActivitiesSchema.parse(bad)).toThrow();
  const bad2 = cloned();
  bad2.activities.find((a) => a.id === 'idle')!.effects = { energy: 1 };
  expect(() => ActivitiesSchema.parse(bad2)).toThrow();
});

test("nap's effective-use fields form one coherent rule, both directions", () => {
  const noWindow = cloned();
  delete noWindow.activities.find((a) => a.id === 'nap')!.effectiveWindow;
  expect(() => ActivitiesSchema.parse(noWindow)).toThrow();

  const windowOnly = cloned();
  const stretch = windowOnly.activities.find((a) => a.id === 'stretch')!;
  stretch.effectiveWindow = { wakeOffsetStart: 0, wakeOffsetEnd: 100 };
  expect(() => ActivitiesSchema.parse(windowOnly)).toThrow(/together/);

  const budgetOnly = cloned();
  budgetOnly.activities.find((a) => a.id === 'stretch')!.effectiveUsesPerDay = 1;
  expect(() => ActivitiesSchema.parse(budgetOnly)).toThrow(/together/);
});

test('fraction, threshold, and magnitude refines reject out-of-grid content', () => {
  const threeDecimals = cloned();
  threeDecimals.activities.find((a) => a.id === 'meal')!.fillStartsAfterFraction = 0.333;
  expect(() => ActivitiesSchema.parse(threeDecimals)).toThrow(/two decimals/);

  const nearOne = cloned();
  nearOne.activities.find((a) => a.id === 'meal')!.fillStartsAfterFraction = 0.9999999999995;
  expect(() => ActivitiesSchema.parse(nearOne)).toThrow(/0\.99/);

  const bigThreshold = cloned();
  (bigThreshold.activities.find((a) => a.id === 'nap')!.startBelow as Record<string, number>).energy = 150;
  expect(() => ActivitiesSchema.parse(bigThreshold)).toThrow();

  const negThreshold = cloned();
  (negThreshold.activities.find((a) => a.id === 'nap')!.startBelow as Record<string, number>).energy = -5;
  expect(() => ActivitiesSchema.parse(negThreshold)).toThrow();

  const hugeEffect = cloned();
  (hugeEffect.activities.find((a) => a.id === 'snack')!.effects as Record<string, number>).nutrition = 1e300;
  expect(() => ActivitiesSchema.parse(hugeEffect)).toThrow(/magnitude/);

  const marathon = cloned();
  marathon.activities.find((a) => a.id === 'weights')!.baseMin = 1441; // beyond the one-day cap
  expect(() => ActivitiesSchema.parse(marathon)).toThrow();
});

test('quick-option invariant holds in the shipped content (SPEC §6.2)', () => {
  const parsed = ActivitiesSchema.parse(rawActivities);
  const perHour = (id: string, bar: string): number => {
    const a = parsed.activities.find((x) => x.id === id);
    if (!a || a.kind !== 'timed') throw new Error(`no timed activity ${id}`);
    const amount = (a.effects as Record<string, number>)[bar] ?? 0;
    return (amount / a.baseMin) * 60;
  };
  expect(perHour('stretch', 'movement')).toBeLessThan(perHour('weights', 'movement'));   // 32 < 50
  expect(perHour('snack', 'nutrition')).toBeLessThan(perHour('meal', 'nutrition'));      // 60 < 70
  expect(perHour('quickwash', 'hygiene')).toBeLessThan(perHour('shower', 'hygiene'));    // 112.5 < 120
  // Nap is the declared exception: bounded to exactly one effective use per day.
  const nap = parsed.activities.find((x) => x.id === 'nap');
  expect(nap?.kind === 'timed' && nap.effectiveUsesPerDay).toBe(1);
});
