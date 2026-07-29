import { toDisplay } from './fixed';
import type { RatesConfig } from './content-schemas';
import { BAR_IDS, type Bars } from './types';

/** Health = weighted mean of the four bars (SPEC §6.4); weights are validated content. */
export function healthDisplay(bars: Bars, cfg: RatesConfig): number {
  let sum = 0;
  let wsum = 0;
  for (const id of BAR_IDS) {
    const w = cfg.weights[id];
    if (w === undefined) throw new Error(`missing weight for bar "${id}"`);
    sum += toDisplay(bars[id]) * w;
    wsum += w;
  }
  return sum / wsum;
}

/**
 * Duration divisor — Energy only (SPEC §6.5). SampledAtStart naming is deliberate:
 * consumers capture these once when an activity/travel leg starts (SPEC §6.6).
 */
export const mSpeedAtStart = (bars: Bars): number => 0.5 + toDisplay(bars.energy) / 100;

/** Output multiplier — Health (SPEC §6.6): Practice points, later pay/GP/Love. Never Connection. */
export const mOutAtStart = (bars: Bars, cfg: RatesConfig): number => 0.5 + healthDisplay(bars, cfg) / 100;

/** Well-fed (SPEC §6.5): Nutrition ≥ threshold at start → workout/practice outputs get the bonus. */
export const isWellFedAtStart = (bars: Bars, cfg: RatesConfig): boolean =>
  toDisplay(bars.nutrition) >= cfg.wellFed.threshold;

/** Walk speed (SPEC §6.5): Movement 0 → 2.25 tiles/min, 100 → 3.75. */
export const walkTilesPerMinute = (bars: Bars): number => 3 * (0.75 + toDisplay(bars.movement) / 200);
