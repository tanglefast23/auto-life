import { healthDisplay, mSpeedAtStart, mOutAtStart, isWellFedAtStart, walkTilesPerMinute } from '../bars';
import { toFixed } from '../fixed';
import { initialBars } from '../initial-state';
import { content } from '../content';
import type { Bars } from '../types';

const rates = content.rates;
const bars = (e: number, n: number, m: number, h: number): Bars =>
  ({ energy: toFixed(e), nutrition: toFixed(n), movement: toFixed(m), hygiene: toFixed(h) });

test('Day-1 Health is exactly 75', () => {
  expect(healthDisplay(initialBars(), rates)).toBe(75);
});

test('Health bounds', () => {
  expect(healthDisplay(bars(0, 0, 0, 0), rates)).toBe(0);
  expect(healthDisplay(bars(100, 100, 100, 100), rates)).toBe(100);
});

test('m_speed anchors (Energy only)', () => {
  expect(mSpeedAtStart(bars(0, 100, 100, 100))).toBe(0.5);
  expect(mSpeedAtStart(bars(50, 0, 0, 0))).toBe(1.0);
  expect(mSpeedAtStart(bars(100, 0, 0, 0))).toBe(1.5);
});

test('m_out anchors (Health)', () => {
  expect(mOutAtStart(bars(0, 0, 0, 0), rates)).toBe(0.5);
  expect(mOutAtStart(bars(50, 50, 50, 50), rates)).toBe(1.0);
  expect(mOutAtStart(bars(100, 100, 100, 100), rates)).toBe(1.5);
});

test('Well-fed boundary at the threshold, exact to one fixed unit', () => {
  expect(isWellFedAtStart(bars(0, 70, 0, 0), rates)).toBe(true);
  const justBelow = bars(0, 70, 0, 0);
  justBelow.nutrition -= 1; // one ×6000 unit below the threshold
  expect(isWellFedAtStart(justBelow, rates)).toBe(false);
});

test('walk speed anchors', () => {
  expect(walkTilesPerMinute(bars(0, 0, 0, 0))).toBe(2.25);
  expect(walkTilesPerMinute(bars(0, 0, 100, 0))).toBe(3.75);
});

test('a missing weight throws rather than silently defaulting', () => {
  const broken = { ...rates, weights: { energy: 1, nutrition: 1, movement: 1 } } as unknown as typeof rates;
  expect(() => healthDisplay(initialBars(), broken)).toThrow(/hygiene/);
});
