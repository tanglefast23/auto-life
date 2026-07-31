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
   * §7.4's suppression window — removing an AUTO card suppresses its type for 2 game-hours,
   * stopping one for 1.
   *
   * The reactive planner has read this since P2; the routine planner did not, and that gap
   * made Remove and Stop dead verbs against exactly the cards the player sees most. Under
   * the default `full-routine` autonomy the queue is refilled to five every tick, so a
   * removed Snack was re-created in the same tick it was removed and a stopped activity
   * restarted about two minutes later — with the Undo toast still offering to undo a
   * removal that had already undone itself.
   */
  suppression: SuppressionMap;
}

function activityForNeed(
  bar: BarId,
  args: RefillRoutineQueueArgs,
  projectedBars: Bars,
): string | null {
  if (bar === 'nutrition') return 'snack';
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

  /**
   * §7.4: a suppressed type is not re-planned, and urgency is the only override.
   *
   * A routine card is never urgent — urgency is the reactive planner's escalation, and it
   * reaches the queue through §7.2's net, which reads the same map with `urgent: true` and
   * so still gets through in a genuine crisis. Passing `false` here is therefore the whole
   * of the routine planner's half of the rule.
   */
  const suppressed = (activityId: string): boolean =>
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
      // `break`, not `continue`. The fallback is the loop's only other exit, so suppressing
      // it while still looping would spin forever inside the tick. A plan that is short for
      // an hour is the correct outcome anyway: the player just said they did not want this.
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
