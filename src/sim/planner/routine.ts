import { napEligibility } from '../activities';
import { minuteOfDay } from '../clock';
import type { ContentRegistry } from '../content';
import { toDisplay, toFixed } from '../fixed';
import { isSuppressed, type QueueCard, type SuppressionMap } from '../queue';
import type { BarId, Bars } from '../types';

export const ROUTINE_QUEUE_TARGET = 5;
export const ROUTINE_NEED_THRESHOLD = 80;
export const PRODUCTIVE_FALLBACK_ACTIVITY_ID = 'read';

const NEED_ORDER: readonly BarId[] = [
  'energy',
  'nutrition',
  'hygiene',
  'movement',
];

export interface RefillRoutineQueueArgs {
  queue: readonly QueueCard[];
  currentCardId: string | null;
  bars: Bars;
  absoluteMinute: number;
  wakeTarget: number;
  napEffectiveUsesToday: number;
  content: ContentRegistry;
  createCardId: () => string;
  targetSize?: number;
  /**
   * §7.4's stop/remove suppression. Without it the rolling plan re-proposes the exact
   * activity the player just stopped, on the same minute, and Stop reads as dead — which
   * is what forced the blanket "start nothing this tick" guard that broke same-tick
   * handoff. Honouring suppression here is what lets that guard go.
   */
  suppression?: SuppressionMap;
  /**
   * §9.2's rolled food preference — "which variant the planner reaches for first".
   *
   * The reactive path has always honoured it (`step.ts` upgrades snack→meal), but this
   * planner books the default autonomy and never saw it, so a `proper-meals` career
   * played out identically to one with no preference at all. Optional and defaulting to
   * the snack behaviour, so a career that never rolled the food category is unchanged.
   */
  foodMood?: 'proper-meals' | 'grazer' | null;
}

function activityForNeed(
  bar: BarId,
  args: RefillRoutineQueueArgs,
  projectedBars: Bars,
): string | null {
  // A proper-meals person reaches for the 30-minute meal; a grazer (and a career with no
  // food preference) reaches for the 10-minute snack.
  if (bar === 'nutrition') {
    return args.foodMood === 'proper-meals' ? 'meal' : 'snack';
  }
  if (bar === 'hygiene') return 'quickwash';
  if (bar === 'movement') return 'stretch';

  const nap = args.content.activities.activities.find(
    (activity) => activity.id === 'nap',
  );
  if (
    nap?.kind !== 'timed' ||
    !napEligibility(
      nap,
      projectedBars,
      minuteOfDay(args.absoluteMinute),
      args.wakeTarget,
      args.napEffectiveUsesToday,
    ).effective
  ) {
    return null;
  }
  return 'nap';
}

function projectActivity(
  bars: Bars,
  activityId: string,
  content: ContentRegistry,
): Bars {
  const next = { ...bars };
  const activity = content.activities.activities.find(
    (candidate) => candidate.id === activityId,
  );
  if (activity?.kind !== 'timed') return next;

  for (const [bar, amount] of Object.entries(activity.effects)) {
    const barId = bar as BarId;
    next[barId] = toFixed(
      Math.max(0, Math.min(100, toDisplay(next[barId]) + (amount ?? 0))),
    );
  }
  return next;
}

function reasonKey(card: QueueCard): string | null {
  if (card.reason?.kind !== 'routinePlan') return null;
  return `${card.activityId}:${card.reason.bar ?? 'free'}`;
}

function needForActivity(
  activityId: string,
  content: ContentRegistry,
): BarId | null {
  const reactive = content.reactive.rules.find(
    (rule) =>
      rule.activity === activityId ||
      rule.supersededBelow?.activity === activityId,
  );
  if (reactive !== undefined) return reactive.bar;
  if (activityId === 'quickwash' || activityId === 'brush') {
    return 'hygiene';
  }
  if (activityId === 'weights' || activityId === 'treadmill') {
    return 'movement';
  }
  return null;
}

/**
 * Keep the visible plan at current + four upcoming cards.
 *
 * Only untouched automatic routine cards are rewritten. Running cards, anchors,
 * reactive fixes, wrinkles, and anything the player pinned or moved remain fixed.
 */
export function refillRoutineQueue(
  args: RefillRoutineQueueArgs,
): QueueCard[] {
  const targetSize = args.targetSize ?? ROUTINE_QUEUE_TARGET;
  const reusable = new Map<string, QueueCard[]>();
  const fixed: QueueCard[] = [];

  for (const card of args.queue) {
    const replaceable =
      card.source === 'routine' &&
      card.owner === 'AUTO' &&
      card.id !== args.currentCardId;
    if (!replaceable) {
      fixed.push(card);
      continue;
    }
    const key = reasonKey(card);
    if (key === null) continue;
    const matches = reusable.get(key) ?? [];
    matches.push(card);
    reusable.set(key, matches);
  }

  let projectedBars = fixed.reduce(
    (projected, card) =>
      projectActivity(projected, card.activityId, args.content),
    { ...args.bars },
  );
  const plannedBars = new Set<BarId>();
  for (const card of fixed) {
    if (card.reason?.kind === 'routinePlan' && card.reason.bar !== null) {
      plannedBars.add(card.reason.bar);
      continue;
    }
    const coveredBar = needForActivity(card.activityId, args.content);
    if (coveredBar !== null) plannedBars.add(coveredBar);
  }

  const takeOrCreate = (
    activityId: string,
    bar: BarId | null,
  ): QueueCard => {
    const key = `${activityId}:${bar ?? 'free'}`;
    const prior = reusable.get(key)?.shift();
    if (prior !== undefined) {
      return prior;
    }
    return {
      id: args.createCardId(),
      activityId,
      owner: 'AUTO',
      urgent: false,
      source: 'routine',
      reason: {
        kind: 'routinePlan',
        bar,
        threshold: ROUTINE_NEED_THRESHOLD,
        atMinute: args.absoluteMinute,
      },
      enqueuedTick: args.absoluteMinute,
    };
  };

  // Routine cards are never urgent, so suppression always applies to them (§7.4 gives
  // urgency the only override).
  const suppressed = (activityId: string): boolean =>
    args.suppression !== undefined &&
    isSuppressed(activityId, args.absoluteMinute, args.suppression, false);

  const additions: QueueCard[] = [];
  while (fixed.length + additions.length < targetSize) {
    const candidates = NEED_ORDER.flatMap((bar, order) => {
      if (
        plannedBars.has(bar) ||
        toDisplay(projectedBars[bar]) >= ROUTINE_NEED_THRESHOLD
      ) {
        return [];
      }
      const activityId = activityForNeed(bar, args, projectedBars);
      if (activityId === null || suppressed(activityId)) return [];
      return [{
        bar,
        activityId,
        order,
        score:
          (ROUTINE_NEED_THRESHOLD - toDisplay(projectedBars[bar])) *
          args.content.reactive.weights[bar],
      }];
    }).sort((a, b) => b.score - a.score || a.order - b.order);

    const next = candidates[0];
    if (next === undefined) {
      // Nothing left to propose. Stopping short of the target is the honest answer —
      // padding with a suppressed activity is exactly the behaviour being fixed.
      if (suppressed(PRODUCTIVE_FALLBACK_ACTIVITY_ID)) break;
      additions.push(
        takeOrCreate(PRODUCTIVE_FALLBACK_ACTIVITY_ID, null),
      );
      continue;
    }
    additions.push(takeOrCreate(next.activityId, next.bar));
    plannedBars.add(next.bar);
    projectedBars = projectActivity(
      projectedBars,
      next.activityId,
      args.content,
    );
  }

  return [...fixed, ...additions];
}
