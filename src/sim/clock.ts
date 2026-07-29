import type { RatesConfig } from './content-schemas';
import type { Chronotype } from './types';

export const TICKS_PER_DAY = 1440;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/**
 * `absoluteMinute` names the game-minute ABOUT TO BE simulated (master plan §4):
 * triggers evaluate this value; advancement happens after the tick's deltas apply.
 * Tick 0 is Day 1 · Monday · 00:00.
 */
function assertAbsoluteMinute(absoluteMinute: number): void {
  if (!Number.isInteger(absoluteMinute) || absoluteMinute < 0) {
    throw new Error(`invalid absoluteMinute: ${absoluteMinute}`);
  }
}

export function minuteOfDay(absoluteMinute: number): number {
  assertAbsoluteMinute(absoluteMinute);
  return absoluteMinute % TICKS_PER_DAY;
}

export function dayNumber(absoluteMinute: number): number {
  assertAbsoluteMinute(absoluteMinute);
  return Math.floor(absoluteMinute / TICKS_PER_DAY) + 1;
}

export function weekday(absoluteMinute: number): Weekday {
  const w = WEEKDAYS[(dayNumber(absoluteMinute) - 1) % 7];
  if (!w) throw new Error('unreachable: weekday index out of range');
  return w;
}

export const targetsFor = (c: Chronotype, cfg: Pick<RatesConfig, 'chronotype'>) => cfg.chronotype[c];

export const morningCheckMinute = (c: Chronotype, cfg: Pick<RatesConfig, 'chronotype'>): number =>
  targetsFor(c, cfg).wake + 120;
