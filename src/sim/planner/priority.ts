import { toDisplay } from '../fixed';
import type { ReactiveConfig, ReactiveRule } from '../content-schemas';
import type { Bars } from '../types';
import type { QueueCard } from '../queue';

/**
 * Two-stage priority (SPEC §7.3, verified formula). Scores are computed, compared,
 * and discarded — never persisted (they would be meaningless after a restore).
 * Anchor-block cards are NEVER scored; blocks keep their data-defined order.
 */
export function scoreReactiveCard(
  card: QueueCard,
  rule: ReactiveRule,
  bars: Bars,
  cfg: ReactiveConfig,
): number {
  const weight = cfg.weights[rule.bar];
  if (weight === undefined) throw new Error(`missing weight for bar "${rule.bar}"`);
  const value = toDisplay(bars[rule.bar]);
  if (card.urgent) {
    // Stage 1: common normalization by the urgency threshold — equal deficits rank by weight.
    return 1_000 + weight * ((cfg.urgentThreshold - value) / cfg.urgentThreshold);
  }
  // Stage 2: per-trigger normalization.
  return weight * ((rule.below - value) / rule.below);
}

export const isUrgentBarValue = (value: number, cfg: ReactiveConfig, bar: ReactiveRule['bar']): boolean =>
  value < cfg.urgentThreshold && !cfg.neverUrgent.includes(bar);
