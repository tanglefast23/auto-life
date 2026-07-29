import type { RatesConfig } from '../sim/content-schemas';
import type { BarId } from '../sim/types';

/**
 * Display bands (SPEC §11.1, P3 T7).
 *
 * The bands come from `rates.json`, never from code. §11.1 is explicit about why:
 * Energy is *designed* to sit at 20 by bedtime, so the default `<40 = red` band would
 * "cry red every healthy evening" — a verifier finding the SPEC records. Energy
 * therefore carries its own bands (edge tick <30, red <15), and hard-coding the default
 * here would silently re-create the bug.
 *
 * Pure and framework-free so the rule is unit-testable without rendering.
 */

export type BandName = 'normal' | 'tick' | 'alert';

export interface BandStyle {
  band: BandName;
  /** design.md §8: <40 adds a red edge pulse AND an alert-glyph swap. */
  pulse: boolean;
  /** SPEC §11.6 — urgency must be legible without colour. */
  alertGlyph: boolean;
}

/**
 * `displayBands` is a strict object declaring exactly `default` and `energy` — the
 * schema encodes that Energy is the one bar with its own bands, so this reads the
 * override by name rather than by dynamic index. When a second override is added, the
 * schema change makes this a compile error, which is the point: a silent fallback here
 * is precisely how Energy would end up back on the default bands.
 */
function thresholdsFor(bar: BarId, cfg: RatesConfig): { tick: number; alert: number } {
  return bar === 'energy' ? cfg.displayBands.energy : cfg.displayBands.default;
}

export function bandFor(bar: BarId, displayValue: number, cfg: RatesConfig): BandStyle {
  const { tick, alert } = thresholdsFor(bar, cfg);
  if (displayValue < alert) return { band: 'alert', pulse: true, alertGlyph: true };
  if (displayValue < tick) return { band: 'tick', pulse: false, alertGlyph: false };
  return { band: 'normal', pulse: false, alertGlyph: false };
}

/** design.md §9 — per-bar icon identity, with the alert variant as a distinct shape. */
export const BAR_ICON: Record<BarId, { normal: string; alert: string; label: string }> = {
  energy: { normal: '☾', alert: '☾̶', label: 'Energy' },
  nutrition: { normal: '⑃', alert: '◡', label: 'Nutrition' },
  movement: { normal: '⇗', alert: '⇘', label: 'Movement' },
  hygiene: { normal: '◍', alert: '≈', label: 'Hygiene' },
};

/** design.md §2 — each bar's fill is its owned ramp's base. */
export const BAR_COLOR: Record<BarId, string> = {
  energy: '#6b4f74', // Dusk plum
  nutrition: '#5ca860', // Leaf green
  movement: '#bc6b42', // Terracotta
  hygiene: '#5b95c0', // Water blue
};

export const BAR_ORDER: readonly BarId[] = ['energy', 'nutrition', 'movement', 'hygiene'];
