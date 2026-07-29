import { applyBarContributions } from '../bar-deltas';
import { passiveContribution } from '../rates';
import { toFixed } from '../fixed';
import { content } from '../content';
import type { Bars } from '../types';

const rates = content.rates;
const full = (): Bars => ({ energy: toFixed(100), nutrition: toFixed(100), movement: toFixed(100), hygiene: toFixed(100) });

test('one awake minute: exact passive deltas', () => {
  const c = passiveContribution('awake', rates);
  expect(c.deltas).toEqual({ energy: -500, nutrition: -400, hygiene: -300, movement: -200 });
});

test('asleep: no passive Energy; others use asleep rates', () => {
  const c = passiveContribution('asleep', rates);
  expect(c.deltas.energy).toBeUndefined();
  expect(c.deltas.nutrition).toBe(-400);
  expect(c.deltas.hygiene).toBe(-100);
  expect(c.deltas.movement).toBe(-200);
});

test('effective nap: no passive Energy; others keep AWAKE decay', () => {
  const c = passiveContribution('effectiveNap', rates);
  expect(c.deltas.energy).toBeUndefined();
  expect(c.deltas.hygiene).toBe(-300); // awake rate, not asleep
});

test('reducer returns new bars and leaves input unchanged', () => {
  const before = full();
  const after = applyBarContributions(before, [passiveContribution('awake', rates)]);
  expect(before.energy).toBe(toFixed(100));
  expect(after.energy).toBe(toFixed(100) - 500);
  expect(after).not.toBe(before);
});

test('multiple contributions to one bar sum, then clamp once', () => {
  const bars = full();
  bars.nutrition = toFixed(99);
  const after = applyBarContributions(bars, [
    { source: 'meal-fill', deltas: { nutrition: toFixed(2) } },
    { source: 'passive', deltas: { nutrition: -400 } },
  ]);
  // 99 + 2 - 0.0667 = 100.933… → sum first (net +11600 fixed), clamp once at 100
  expect(after.nutrition).toBe(toFixed(100));
});

test('non-integer deltas are rejected with the source named', () => {
  expect(() => applyBarContributions(full(), [{ source: 'bad', deltas: { energy: 0.5 } }])).toThrow(/bad/);
});

test('corrupt input bars surface at the commit point, never flow through as NaN', () => {
  const b = full();
  b.energy = NaN;
  expect(() => applyBarContributions(b, [])).toThrow(/energy/);
});

test('duplicate contribution sources throw — the double-apply tripwire', () => {
  const c = passiveContribution('awake', rates);
  expect(() => applyBarContributions(full(), [c, c])).toThrow(/duplicate/);
});

test('16 awake hours drain Energy exactly 100 -> 20', () => {
  let bars = full();
  for (let t = 0; t < 960; t++) bars = applyBarContributions(bars, [passiveContribution('awake', rates)]);
  expect(bars.energy).toBe(toFixed(20));
});

test('clamps at 0 and 100', () => {
  let bars = full();
  bars.movement = 100; // nearly empty (fixed units)
  bars = applyBarContributions(bars, [{ source: 'drain', deltas: { movement: -500 } }]);
  expect(bars.movement).toBe(0);
  bars = applyBarContributions(bars, [{ source: 'fill', deltas: { movement: toFixed(200) } }]);
  expect(bars.movement).toBe(toFixed(100));
});
