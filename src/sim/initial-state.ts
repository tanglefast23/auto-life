import { toFixed } from './fixed';
import { targetsFor } from './clock';
import type { RatesConfig } from './content-schemas';
import type { Bars, Chronotype } from './types';

/**
 * Canonical Day-1 start (SPEC §6.1): the game begins at the sim's own wakeTarget.
 * Energy 100 is load-bearing (verified: 90 fires urgent sleep before the first
 * bedtime); the other three carry the deliberately-imperfect tutorial beat.
 */
export const DAY_ONE_BARS_DISPLAY = { energy: 100, nutrition: 70, hygiene: 70, movement: 60 } as const;

export function initialBars(): Bars {
  return {
    energy: toFixed(DAY_ONE_BARS_DISPLAY.energy),
    nutrition: toFixed(DAY_ONE_BARS_DISPLAY.nutrition),
    movement: toFixed(DAY_ONE_BARS_DISPLAY.movement),
    hygiene: toFixed(DAY_ONE_BARS_DISPLAY.hygiene),
  };
}

/** Day 1 begins at the chronotype's wake target (absolute minute, Day 1 = minutes 0–1439). */
export function initialAbsoluteMinute(c: Chronotype, cfg: Pick<RatesConfig, 'chronotype'>): number {
  return targetsFor(c, cfg).wake;
}
