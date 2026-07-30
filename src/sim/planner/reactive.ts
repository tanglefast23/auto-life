import { minuteOfDay } from '../clock';
import { toDisplay } from '../fixed';
import { isUrgentBarValue } from './priority';
import type { ReactiveConfig, ReactiveRule } from '../content-schemas';
import type { Bars } from '../types';
import type { QueueCard, SuppressionMap } from '../queue';
import { hasAutoCardFor, hasCardFor, isSuppressed } from '../queue';

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
  runningActivityId: string | null = null,
): ReactiveDecision {
  const add: ReactiveDecision['add'] = [];
  const evict: string[] = [];
  const groupWinner = new Map<string, { rule: ReactiveRule; activityId: string; urgent: boolean }>();

  const groupOfActivity = (activityId: string): string | undefined =>
    cfg.rules.find((r) => r.activity === activityId || r.supersededBelow?.activity === activityId)?.exclusiveGroup;
  // A RUNNING member occupies its exclusive group entirely — the planner never
  // interrupts (§7.4), so nothing in that group may be added while it runs.
  const runningGroup = runningActivityId !== null ? groupOfActivity(runningActivityId) : undefined;

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
      // A player-touched reactive becomes PINNED but still handles this exact
      // need. Looking only for AUTO ownership cloned it on the same tick.
      if (!hasCardFor(queue, activityId)) add.push({ rule, activityId, urgent });
    }
  }

  for (const [group, winner] of groupWinner) {
    if (group === runningGroup) continue; // running member owns the group — no adds, no evictions
    const occupants = queue.filter((c) => groupOfActivity(c.activityId) === group);
    // An anchor block step or player card in the group (queued breakfast, pinned meal)
    // already handles the need — the corrective net must not double-book around it.
    const handledOutsideReactive = occupants.some((c) => c.owner !== 'AUTO' || c.source !== 'reactive');
    // Evict queued-unstarted reactive cards that lost to a superseder (Q5: urgent
    // sleep replaces a queued nap — reactive occupants are replaceable, others never).
    for (const card of occupants) {
      if (card.owner !== 'AUTO' || card.source !== 'reactive') continue;
      if (card.activityId !== winner.activityId) evict.push(card.id);
    }
    if (handledOutsideReactive) continue;
    if (!hasAutoCardFor(queue, winner.activityId)) add.push(winner);
  }

  return { add, evict };
}
