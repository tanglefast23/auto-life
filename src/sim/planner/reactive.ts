import { minuteOfDay } from '../clock';
import { toDisplay } from '../fixed';
import { isUrgentBarValue } from './priority';
import type { ReactiveConfig, ReactiveRule } from '../content-schemas';
import type { Bars } from '../types';
import type { QueueCard, SuppressionMap } from '../queue';
import { hasAutoCardFor, isSuppressed } from '../queue';

export interface ReactiveContext {
  absoluteMinute: number;
  wakeTarget: number;
  bars: Bars;
}

export interface ReactiveDecision {
  add: Array<{ rule: ReactiveRule; activityId: string; urgent: boolean }>;
  evict: string[]; // card ids to remove (group supersession, Q5)
}

const ruleActive = (rule: ReactiveRule, ctx: ReactiveContext): { active: boolean; activityId: string } => {
  const value = toDisplay(ctx.bars[rule.bar]);
  if (value >= rule.below) return { active: false, activityId: rule.activity };
  let activityId = rule.activity;
  if (rule.supersededBelow && value < rule.supersededBelow.value) {
    activityId = rule.supersededBelow.activity; // single-food-card: Meal replaces Snack below 20
  }
  if (rule.window) {
    const offset = minuteOfDay(ctx.absoluteMinute) - ctx.wakeTarget;
    if (offset < rule.window[0] || offset > rule.window[1]) return { active: false, activityId };
  }
  return { active: true, activityId };
};

/**
 * Reactive evaluation (SPEC §7.2). exclusiveGroup generalizes the single-food-card
 * rule; supersedesGroup lets Urgent Sleep evict a queued, unstarted Nap (Q5).
 */
export function evaluateReactive(
  cfg: ReactiveConfig,
  ctx: ReactiveContext,
  queue: readonly QueueCard[],
  suppression: SuppressionMap,
): ReactiveDecision {
  const add: ReactiveDecision['add'] = [];
  const evict: string[] = [];
  const groupWinner = new Map<string, { rule: ReactiveRule; activityId: string; urgent: boolean }>();

  for (const rule of cfg.rules) {
    const { active, activityId } = ruleActive(rule, ctx);
    if (!active) continue;
    const value = toDisplay(ctx.bars[rule.bar]);
    const urgent = isUrgentBarValue(value, cfg, rule.bar);
    if (isSuppressed(activityId, ctx.absoluteMinute, suppression, urgent)) continue;

    if (rule.exclusiveGroup) {
      const incumbent = groupWinner.get(rule.exclusiveGroup);
      if (incumbent && !rule.supersedesGroup) continue; // first-listed wins unless a superseder arrives
      if (incumbent && rule.supersedesGroup) groupWinner.set(rule.exclusiveGroup, { rule, activityId, urgent });
      else groupWinner.set(rule.exclusiveGroup, { rule, activityId, urgent });
    } else {
      if (!hasAutoCardFor(queue, activityId)) add.push({ rule, activityId, urgent });
    }
  }

  for (const [group, winner] of groupWinner) {
    // Evict queued-unstarted AUTO cards of the same group that lost to a superseder.
    for (const card of queue) {
      if (card.owner !== 'AUTO' || card.source !== 'reactive') continue;
      const cardRule = cfg.rules.find(
        (r) => r.exclusiveGroup === group && (r.activity === card.activityId || r.supersededBelow?.activity === card.activityId),
      );
      if (cardRule && card.activityId !== winner.activityId) evict.push(card.id);
    }
    if (!hasAutoCardFor(queue, winner.activityId)) add.push(winner);
  }

  return { add, evict };
}
