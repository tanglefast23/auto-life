import { z } from 'zod';
import { fillDelta, ratePerMinuteFixed, toFixed, toDisplay } from './fixed';
import { isWellFedAtStart, mSpeedAtStart } from './bars';
import { BarIdSchema, type ActivityDef, type RatesConfig, type TimedActivityDef } from './content-schemas';
import { assertValidBars, type BarContribution } from './bar-deltas';
import { type BarId, type Bars } from './types';

/**
 * Plain-JSON runtime DTO (master plan §4): no content object, closure, accumulator
 * instance, or redundant completed flag. Definitions are looked up by id; completion
 * is the transition where elapsedTicks reaches durationTicks.
 */
export interface ActiveTimedActivity {
  activityId: string;
  durationTicks: number;
  elapsedTicks: number;
  fillStartTick: number;
  effectTotalsFixed: Partial<Record<BarId, number>>;
  suppressPassiveEnergy: boolean;
  sampled: {
    mSpeed: number;
    wellFed: boolean;
    effectiveUse: boolean;
  };
}

export interface NapEligibility {
  canStart: boolean;
  effective: boolean;
}

/**
 * Nap policy (SPEC §6.2/§7.2): startable only below the startBelow thresholds and,
 * for the EFFECTIVE use, inside the chronotype-shifted window with budget remaining.
 * Later naps run flavor-only (zero restore, ordinary awake decay) — the caller resets
 * effectiveUsesToday at the wake boundary, not midnight.
 */
export function napEligibility(
  def: TimedActivityDef,
  bars: Bars,
  minuteOfDayValue: number,
  wakeTarget: number,
  effectiveUsesToday: number,
): NapEligibility {
  // Only defined for budget-bearing activities — a window-less def would be
  // permanently unstartable here, which is a caller bug, not an answer.
  if (def.effectiveUsesPerDay === undefined || def.effectiveWindow === undefined) {
    throw new Error(`napEligibility is only defined for budget-bearing activities; "${def.id}" has no effective-use rule`);
  }
  const below = Object.entries(def.startBelow ?? {}).every(
    ([bar, threshold]) => toDisplay(bars[bar as BarId]) < (threshold as number),
  );
  const w = def.effectiveWindow;
  const offset = minuteOfDayValue - wakeTarget;
  const inWindow = w !== undefined && offset >= w.wakeOffsetStart && offset <= w.wakeOffsetEnd;
  const budget = (def.effectiveUsesPerDay ?? 0) > effectiveUsesToday;
  // SPEC §6.2: the window bounds STARTABILITY, not just effectiveness — no 23:00 naps.
  const canStart = below && inWindow;
  return { canStart, effective: canStart && budget };
}

/**
 * Wake-boundary predicate: the daily effective-use counter (and any per-day state)
 * resets when the clock crosses the sim's wakeTarget — never at arbitrary midnight.
 * P2's engine calls this each tick with the minute just simulated and the next one.
 */
export function crossedWakeBoundary(
  prevAbsoluteMinute: number,
  nextAbsoluteMinute: number,
  wakeTarget: number,
): boolean {
  if (
    !Number.isInteger(prevAbsoluteMinute) ||
    !Number.isInteger(nextAbsoluteMinute) ||
    prevAbsoluteMinute < 0 ||
    nextAbsoluteMinute < prevAbsoluteMinute
  ) {
    throw new Error('invalid minute range');
  }
  if (!Number.isInteger(wakeTarget) || wakeTarget < 0 || wakeTarget > 1439) {
    throw new Error(`invalid wakeTarget: ${wakeTarget}`);
  }
  const wakesUpTo = (m: number) => Math.floor((m - wakeTarget) / 1440);
  return wakesUpTo(nextAbsoluteMinute) > wakesUpTo(prevAbsoluteMinute);
}

export interface StartOptions {
  /** Whether this start counts as an effective use (nap rule); default true. */
  effectiveUse?: boolean;
}

/** Start = a sampler: everything duration- or bonus-relevant is captured once, here. */
export function startTimedActivity(
  def: ActivityDef,
  bars: Bars,
  cfg: RatesConfig,
  options: StartOptions = {},
): ActiveTimedActivity {
  if (def.kind !== 'timed') {
    throw new Error(`activity "${def.id}" (${def.kind}) cannot start as a timed activity`);
  }
  // The one exploit-adjacent flag must not fail open: activities with a daily
  // effective-use budget require the caller to state the eligibility decision.
  if (def.effectiveUsesPerDay !== undefined && options.effectiveUse === undefined) {
    throw new Error(`activity "${def.id}" has a daily effective-use budget — pass options.effectiveUse from napEligibility`);
  }
  assertValidBars(bars);
  const effectiveUse = options.effectiveUse ?? true;
  const mSpeed = mSpeedAtStart(bars);
  const wellFed = isWellFedAtStart(bars, cfg);
  // Duration derived in INTEGERS (round-2 math adversary: the float form
  // ceil(baseMin / mSpeed) over-counted by +1 in 99 of 79.2M cases — e.g. baseMin 17
  // at Energy 18.00 → 26 instead of 25). mSpeed = (300000 + energyFixed) / 600000,
  // so duration = ceil(baseMin × 600000 / (300000 + energyFixed)), exactly.
  const denom = 300_000 + bars.energy;
  const durationTicks = Math.max(1, Math.floor((def.baseMin * 600_000 + denom - 1) / denom));

  // Explicit rounding rule, computed IN INTEGERS so it is exactly decimal
  // round-half-up (a float form of this comment previously lied: 45×0.7 gave 31,
  // not 32 — caught by the round-1 math adversary). The schema constrains the
  // fraction to two decimals, so frac×100 is integer-representable; ≥1 fill tick
  // is guaranteed by the min() clamp.
  const frac = def.fillStartsAfterFraction ?? 0;
  const frac100 = Math.round(frac * 100);
  const fillStartTick = Math.min(
    durationTicks - 1,
    Math.floor((durationTicks * frac100 + 50) / 100),
  );

  const isWorkout = def.tags?.includes('workout') ?? false;
  const zeroed = def.effectiveUsesPerDay !== undefined && !effectiveUse; // flavor-only later nap
  const effectTotalsFixed: Partial<Record<BarId, number>> = {};
  for (const [bar, amount] of Object.entries(def.effects)) {
    if (zeroed) continue;
    let value = amount as number;
    // Well-fed boosts only the POSITIVE workout output; cross-costs stay unchanged.
    if (isWorkout && wellFed && value > 0) value = value * (1 + cfg.wellFed.outputBonus);
    effectTotalsFixed[bar as BarId] = toFixed(value);
  }

  return {
    activityId: def.id,
    durationTicks,
    elapsedTicks: 0,
    fillStartTick,
    effectTotalsFixed,
    suppressPassiveEnergy: (def.suppressPassiveEnergyWhenEffective ?? false) && effectiveUse,
    sampled: { mSpeed, wellFed, effectiveUse },
  };
}

/** Untrusted-restore validator for the save-bound DTO (mirrors the PRNG snapshot schema). */
export const ActiveTimedActivitySchema = z
  .strictObject({
    activityId: z.string().min(1),
    durationTicks: z.number().int().positive(),
    elapsedTicks: z.number().int().min(0),
    fillStartTick: z.number().int().min(0),
    effectTotalsFixed: z.partialRecord(
      BarIdSchema, // the one bar enum — no drift-prone third copy
      z.number().int().refine(Number.isSafeInteger, 'totals must be safe integers'),
    ),
    suppressPassiveEnergy: z.boolean(),
    sampled: z.strictObject({
      mSpeed: z.number().min(0.5).max(1.5),
      wellFed: z.boolean(),
      effectiveUse: z.boolean(),
    }),
  })
  .refine((a) => a.elapsedTicks < a.durationTicks, 'elapsedTicks must be below durationTicks')
  .refine((a) => a.fillStartTick < a.durationTicks, 'fillStartTick must be below durationTicks');

export function restoreActiveTimedActivity(raw: unknown): ActiveTimedActivity {
  return ActiveTimedActivitySchema.parse(raw);
}

export interface ProgressResult {
  next: ActiveTimedActivity | null;
  contribution: BarContribution;
  completed: boolean;
}

/** Progress = a pure transition; no clamping here — the reducer commits once per tick. */
export function progressTimedActivity(active: ActiveTimedActivity): ProgressResult {
  if (active.elapsedTicks >= active.durationTicks) {
    throw new Error(`activity "${active.activityId}" is already complete`);
  }
  const elapsed = active.elapsedTicks + 1;
  const fillTicks = active.durationTicks - active.fillStartTick;
  const fillIndex = elapsed - active.fillStartTick;
  const deltas: Partial<Record<BarId, number>> = {};
  if (fillIndex >= 1) {
    for (const [bar, total] of Object.entries(active.effectTotalsFixed)) {
      const d = fillDelta(total as number, fillTicks, fillIndex);
      if (d !== 0) deltas[bar as BarId] = d;
    }
  }
  const completed = elapsed === active.durationTicks;
  return {
    next: completed ? null : { ...active, elapsedTicks: elapsed },
    contribution: { source: `activity:${active.activityId}`, deltas },
    completed,
  };
}

/** Sleep's sole-writer restore (SPEC §6.1): +sleepRestorePerHour, never scaled by anything. */
export function sleepContribution(cfg: RatesConfig): BarContribution {
  return { source: 'sleep', deltas: { energy: ratePerMinuteFixed(cfg.sleepRestorePerHour) } };
}
