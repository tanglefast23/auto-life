import { toFixed } from './fixed';
import { BAR_IDS, type BarId, type Bars } from './types';

/**
 * The one-commit rule (master plan §4): leaf systems calculate NAMED signed deltas;
 * they never mutate Bars. The reducer sums every contribution per bar, then clamps
 * ONCE — so a Meal fill and passive Nutrition decay legally coexist in one tick.
 */
export interface BarContribution {
  source: string;
  deltas: Partial<Record<BarId, number>>; // ×6000 fixed integers
}

const MAX = toFixed(100);

export function applyBarContributions(bars: Bars, contributions: readonly BarContribution[]): Bars {
  const next: Bars = { ...bars };
  for (const id of BAR_IDS) {
    let sum = 0;
    for (const c of contributions) {
      const d = c.deltas[id];
      if (d === undefined) continue;
      if (!Number.isSafeInteger(d)) {
        throw new Error(`contribution "${c.source}" has a non-integer ${id} delta: ${d}`);
      }
      sum += d;
    }
    if (sum !== 0) next[id] = Math.max(0, Math.min(MAX, next[id] + sum));
  }
  return next;
}
