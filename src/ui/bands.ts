import type { RatesConfig } from '../sim/content-schemas';
import type { BarId } from '../sim/types';
import { theme } from './theme';

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

/**
 * The default bands, named explicitly.
 *
 * The composite Health bar has no `BarId`, so it was reading `bandFor('nutrition', …)`
 * as a stand-in for "the default thresholds". That works only for as long as Nutrition
 * has no override of its own — the moment a second bar gets custom bands (Energy already
 * has one), Health would silently start following the wrong rule with nothing failing.
 */
export function bandForDefault(displayValue: number, cfg: RatesConfig): BandStyle {
  return classify(displayValue, cfg.displayBands.default);
}

function classify(displayValue: number, t: { tick: number; alert: number }): BandStyle {
  if (displayValue < t.alert) return { band: 'alert', pulse: true, alertGlyph: true };
  if (displayValue < t.tick) return { band: 'tick', pulse: false, alertGlyph: false };
  return { band: 'normal', pulse: false, alertGlyph: false };
}

export function bandFor(bar: BarId, displayValue: number, cfg: RatesConfig): BandStyle {
  return classify(displayValue, thresholdsFor(bar, cfg));
}

/** design.md §9 — per-bar icon identity, with the alert variant as a distinct shape. */
export const BAR_ICON: Record<BarId, { normal: string; alert: string; label: string }> = {
  energy: { normal: '☾', alert: '☾̶', label: 'Energy' },
  nutrition: { normal: '⑃', alert: '◡', label: 'Nutrition' },
  movement: { normal: '⇗', alert: '⇘', label: 'Movement' },
  hygiene: { normal: '◍', alert: '≈', label: 'Hygiene' },
};

/**
 * What each bar means, and the one activity family that raises it.
 *
 * The glyphs above are the only thing naming a bar on screen, and a moon or a tilde is not
 * self-evident — the names existed solely in `accessibilityLabel`, so a sighted player had
 * no way to learn them. One line each: what it is, then how to raise it, because "what do
 * I do about this?" is the question a bar actually provokes.
 */
export const BAR_TIP: Record<BarId, string> = {
  energy: 'How rested she is. Sleep and naps restore it.',
  nutrition: 'How well fed she is. Meals and snacks restore it.',
  movement: 'How active she has been. Weights, treadmill and stretching raise it.',
  hygiene: 'How clean she feels. Showers, quick washes and brushing raise it.',
};

/** design.md §2 — each bar's fill is its owned ramp's base. */
export const BAR_COLOR: Record<BarId, string> = {
  energy: theme.color.plum, // Dusk plum
  nutrition: theme.color.leaf, // Leaf green
  movement: theme.color.terracotta, // Terracotta
  hygiene: theme.color.water, // Water blue
};

export const BAR_ORDER: readonly BarId[] = ['energy', 'nutrition', 'movement', 'hygiene'];
