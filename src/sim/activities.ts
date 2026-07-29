import { fillDelta, ratePerMinuteFixed, toFixed, toDisplay } from './fixed';
import { isWellFedAtStart, mSpeedAtStart } from './bars';
import type { ActivityDef, RatesConfig, TimedActivityDef } from './content-schemas';
import type { BarContribution } from './bar-deltas';
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
  const below = Object.entries(def.startBelow ?? {}).every(
    ([bar, threshold]) => toDisplay(bars[bar as BarId]) < (threshold as number),
  );
  const w = def.effectiveWindow;
  const offset = minuteOfDayValue - wakeTarget;
  const inWindow = w !== undefined && offset >= w.wakeOffsetStart && offset <= w.wakeOffsetEnd;
  const budget = (def.effectiveUsesPerDay ?? 0) > effectiveUsesToday;
  return { canStart: below, effective: below && inWindow && budget };
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
  const effectiveUse = options.effectiveUse ?? true;
  const mSpeed = mSpeedAtStart(bars);
  const wellFed = isWellFedAtStart(bars, cfg);
  const durationTicks = Math.max(1, Math.ceil(def.baseMin / mSpeed));

  // Explicit rounding rule: floor((ticks*frac*10 + 5) / 10) — decimal round-half-up,
  // immune to binary-float artifacts like 31.499999999999996; ≥1 fill tick guaranteed.
  const frac = def.fillStartsAfterFraction ?? 0;
  const fillStartTick = Math.min(
    durationTicks - 1,
    Math.floor((durationTicks * frac * 10 + 5) / 10),
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
