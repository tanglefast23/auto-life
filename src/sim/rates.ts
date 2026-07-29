import { ratePerMinuteFixed } from './fixed';
import type { RatesConfig } from './content-schemas';
import { BAR_IDS, type BarId } from './types';
import type { BarContribution } from './bar-deltas';

/**
 * Body modes (SPEC §6.1 single-writer rule, resolved through the contribution seam):
 * - awake:        all awake passive rates apply
 * - asleep:       Energy passive is ZERO (Sleep's own contribution is its sole writer);
 *                 other bars use asleep rates
 * - effectiveNap: Energy passive is ZERO while the nap is effective; other bars keep
 *                 AWAKE decay (a nap is not a night)
 */
export type BodyMode = 'awake' | 'asleep' | 'effectiveNap';

export function passiveContribution(mode: BodyMode, cfg: RatesConfig): BarContribution {
  const deltas: Partial<Record<BarId, number>> = {};
  for (const id of BAR_IDS) {
    const rate =
      mode === 'asleep'
        ? cfg.rates[id].asleep
        : cfg.rates[id].awake;
    const suppressed = id === 'energy' && (mode === 'asleep' || mode === 'effectiveNap');
    const perMinute = suppressed ? 0 : ratePerMinuteFixed(rate);
    if (perMinute !== 0) deltas[id] = -perMinute;
  }
  return { source: `passive:${mode}`, deltas };
}
