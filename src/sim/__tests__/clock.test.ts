import { TICKS_PER_DAY, minuteOfDay, dayNumber, weekday, targetsFor, morningCheckMinute } from '../clock';
import { initialBars, initialAbsoluteMinute } from '../initial-state';
import { toFixed } from '../fixed';
import { content } from '../content';

const rates = content.rates;

test('day math and boundaries', () => {
  expect(TICKS_PER_DAY).toBe(1440);
  expect(minuteOfDay(0)).toBe(0);
  expect(dayNumber(0)).toBe(1);
  expect(weekday(0)).toBe('Mon');
  expect(minuteOfDay(1439)).toBe(1439);
  expect(dayNumber(1439)).toBe(1);
  expect(dayNumber(1440)).toBe(2);
  expect(weekday(1440 * 5)).toBe('Sat');
  expect(dayNumber(7 * 1440)).toBe(8); // the letter day begins here
});

test('invalid absolute minutes are rejected', () => {
  expect(() => minuteOfDay(-1)).toThrow();
  expect(() => dayNumber(1.5)).toThrow();
});

test('game starts at the chronotype wake target', () => {
  expect(initialAbsoluteMinute('baseline', rates)).toBe(420); // Day 1 Mon 07:00
  expect(initialAbsoluteMinute('early', rates)).toBe(390);
  expect(initialAbsoluteMinute('owl', rates)).toBe(450);
});

test('morning check = wake target + 120', () => {
  expect(morningCheckMinute('baseline', rates)).toBe(540); // 09:00 baseline
  expect(morningCheckMinute('early', rates)).toBe(510);
  expect(targetsFor('owl', rates).bed).toBe(1410);
});

test('Day-1 bars are exactly E100 N70 H70 M60 (fixed integers)', () => {
  const b = initialBars();
  expect(b.energy).toBe(toFixed(100));
  expect(b.nutrition).toBe(toFixed(70));
  expect(b.hygiene).toBe(toFixed(70));
  expect(b.movement).toBe(toFixed(60));
});
