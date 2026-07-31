import { SCALE, toFixed, toDisplay, ratePerMinuteFixed, fillDelta } from '../fixed';
import { ENGINE_VERSION } from '../version';

test('scale constants and roundtrip', () => {
  expect(SCALE).toBe(6000);
  expect(toFixed(100)).toBe(600_000);
  expect(toDisplay(toFixed(72.5))).toBe(72.5);
  expect(() => toFixed(Infinity)).toThrow();
  expect(() => toFixed(NaN)).toThrow();
});

test('every SPEC rate is an exact integer per minute', () => {
  expect(ratePerMinuteFixed(5)).toBe(500);
  expect(ratePerMinuteFixed(4)).toBe(400);
  expect(ratePerMinuteFixed(3)).toBe(300);
  expect(ratePerMinuteFixed(2)).toBe(200);
  expect(ratePerMinuteFixed(1)).toBe(100);
  expect(ratePerMinuteFixed(10)).toBe(1000);
  expect(ratePerMinuteFixed(0.4)).toBe(40);
  expect(ratePerMinuteFixed(0.29)).toBe(29); // binary-float edge: 0.29*100 !== 29 exactly
});

test('invalid rates throw', () => {
  expect(() => ratePerMinuteFixed(5.001)).toThrow();
  expect(() => ratePerMinuteFixed(-1)).toThrow();
  expect(() => ratePerMinuteFixed(Infinity)).toThrow();
});

test('fillDelta sums exactly across a Meal fill (positive)', () => {
  const total = toFixed(35);
  let sum = 0;
  for (let t = 1; t <= 18; t++) sum += fillDelta(total, 18, t);
  expect(sum).toBe(total);
});

test('fillDelta sums exactly with a negative total (signed cross-effect)', () => {
  const total = toFixed(-5);
  let sum = 0;
  for (let t = 1; t <= 40; t++) sum += fillDelta(total, 40, t);
  expect(sum).toBe(total);
});

test('fillDelta rejects invalid inputs', () => {
  expect(() => fillDelta(0.5, 10, 1)).toThrow();
  expect(() => fillDelta(toFixed(10), 0, 1)).toThrow();
  expect(() => fillDelta(toFixed(10), 10, 0)).toThrow();
  expect(() => fillDelta(toFixed(10), 10, 11)).toThrow();
});

test('engine version is pinned (bumped to 10 by the P6 audit routine-suppression fix)', () => {
  expect(ENGINE_VERSION).toBe(10);
});
