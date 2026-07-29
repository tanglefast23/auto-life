import { applyBarContributions } from '../bar-deltas';
import { passiveContribution } from '../rates';
import { sleepContribution } from '../activities';
import { toFixed } from '../fixed';
import { content } from '../content';
import type { Bars } from '../types';

const rates = content.rates;

/**
 * The exact closure day (SPEC §6.1/§6.8 arithmetic; honestly named — this is NOT the
 * P2 seven-day golden replay). All bars start at 100 to isolate the daily budget.
 */
test('16h awake + 8h asleep closes Energy exactly; fixed integers throughout', () => {
  let bars: Bars = {
    energy: toFixed(100),
    nutrition: toFixed(100),
    movement: toFixed(100),
    hygiene: toFixed(100),
  };
  for (let t = 0; t < 960; t++) {
    bars = applyBarContributions(bars, [passiveContribution('awake', rates)]);
  }
  expect(bars.energy).toBe(toFixed(20)); // bedtime, exact

  for (let t = 0; t < 480; t++) {
    bars = applyBarContributions(bars, [passiveContribution('asleep', rates), sleepContribution(rates)]);
  }
  expect(bars.energy).toBe(toFixed(100)); // wake, exact — the anti-drift guarantee
  expect(bars.nutrition).toBe(toFixed(4)); // 100 − 4×24
  expect(bars.hygiene).toBe(toFixed(44)); // 100 − (3×16 + 1×8)
  expect(bars.movement).toBe(toFixed(52)); // 100 − 2×24
});
