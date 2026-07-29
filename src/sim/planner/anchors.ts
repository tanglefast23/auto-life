import { minuteOfDay, dayNumber } from '../clock';
import { toDisplay } from '../fixed';
import type { AnchorDef, AnchorsConfig } from '../content-schemas';
import type { Bars } from '../types';

export interface AnchorContext {
  absoluteMinute: number;
  wakeTarget: number;
  bars: Bars;
  lastMealCompletedAt: number | null; // meals only — snacks never satisfy the clause (§7.1)
  anchorsConsumedOnDay: Record<string, number>; // anchorId -> dayNumber consumed (fired OR deleted, Q4)
  preferredWorkout: 'weights' | 'treadmill';
}

/** The wake-relative window, evaluated on the sim's own targets (§7.1/§9.2). */
export function windowState(anchor: AnchorDef, ctx: AnchorContext): 'before' | 'open' | 'after' {
  const offset = minuteOfDay(ctx.absoluteMinute) - ctx.wakeTarget;
  if (offset < anchor.opensAt) return 'before';
  if (offset > anchor.closesAt) return 'after';
  return 'open';
}

export function gatePasses(anchor: AnchorDef, ctx: AnchorContext): boolean {
  if (!anchor.gate) return true;
  if (toDisplay(ctx.bars[anchor.gate.bar]) >= anchor.gate.below) return false;
  if (anchor.gate.noMealWithinMin !== undefined && ctx.lastMealCompletedAt !== null) {
    if (ctx.absoluteMinute - ctx.lastMealCompletedAt < anchor.gate.noMealWithinMin) return false;
  }
  return true;
}

/** An anchor fires at most once per day; deletion counts as the firing (Q4). */
export function alreadyConsumedToday(anchor: AnchorDef, ctx: AnchorContext): boolean {
  return ctx.anchorsConsumedOnDay[anchor.id] === dayNumber(ctx.absoluteMinute);
}

export interface AnchorDecision {
  enqueue: AnchorDef[];
}

/** Which anchors should enqueue their blocks at this minute. */
export function anchorsToEnqueue(cfg: AnchorsConfig, ctx: AnchorContext): AnchorDecision {
  const enqueue: AnchorDef[] = [];
  for (const anchor of cfg.anchors) {
    if (alreadyConsumedToday(anchor, ctx)) continue;
    if (windowState(anchor, ctx) !== 'open') continue;
    if (!gatePasses(anchor, ctx)) continue;
    enqueue.push(anchor);
  }
  return { enqueue };
}

/** Resolve the block's activity list against the sim's workout preference (§9.2). */
export function resolveBlock(anchor: AnchorDef, ctx: AnchorContext): string[] {
  return anchor.block.map((step) => (step === '__preferredWorkout' ? ctx.preferredWorkout : step));
}

/**
 * Missed-window rule (Q3): missed = the block has NOT STARTED by window close.
 * The caller (T12) removes the unstarted cards, marks the anchor consumed, and
 * emits `anchorMissed`; a running block always finishes.
 */
export function isMissed(anchor: AnchorDef, ctx: AnchorContext, blockStarted: boolean): boolean {
  return windowState(anchor, ctx) === 'after' && !blockStarted && !alreadyConsumedToday(anchor, ctx);
}
