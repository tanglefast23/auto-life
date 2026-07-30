import { z } from 'zod';
import rawQueueStrings from '../../content/strings/queue.json';
import type {
  ForecastBonus,
  ForecastConflict,
  ForecastWakeConflict,
} from '../sim/forecast';
import type { QueueReason } from '../sim/queue';
import type { CardStartDecision } from '../sim/step';
import { formatTimeOfDay } from './clock-format';
import { activityCopy, blockLabel } from './queue-presenter';

const QueueStringsSchema = z.strictObject({
  why: z.strictObject({
    reactiveTrigger: z.string().min(1),
    anchorWindow: z.string().min(1),
    routineNeed: z.string().min(1),
    routineFree: z.string().min(1),
    wrinklePackage: z.string().min(1),
    wrinkleFallback: z.string().min(1),
  }),
  chips: z.strictObject({
    conflict: z.string().min(1),
    wakeConflict: z.string().min(1),
    warmedUp: z.string().min(1),
    itSticks: z.string().min(1),
    cramp: z.string().min(1),
    mintyFresh: z.string().min(1),
    freshMind: z.string().min(1),
    practiceBlock: z.string().min(1),
    blocked: z.string().min(1),
    waiting: z.string().min(1),
    reroute: z.string().min(1),
  }),
  details: z.strictObject({
    conflict: z.string().min(1),
    wakeConflict: z.string().min(1),
    capWaste: z.string().min(1),
    halveDuration: z.string().min(1),
    scaleDecay: z.string().min(1),
    barDelta: z.string().min(1),
    scalePoints: z.string().min(1),
    practiceBlock: z.string().min(1),
    objectBlocked: z.string().min(1),
    activityUnavailable: z.string().min(1),
    reroute: z.string().min(1),
  }),
  announcements: z.strictObject({
    forecastUpdated: z.string().min(1),
  }),
});

export const queueStrings = QueueStringsSchema.parse(rawQueueStrings);

const PAIR_CHIP_KEYS = {
  'warmed-up': 'warmedUp',
  'it-sticks': 'itSticks',
  cramp: 'cramp',
  'minty-fresh': 'mintyFresh',
  'fresh-mind': 'freshMind',
} as const;

function fill(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : token,
  );
}

export function titleCase(value: string): string {
  return value.length === 0
    ? value
    : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

export function whyLine(reason: QueueReason | null): string | null {
  if (reason === null) return null;
  if (reason.kind === 'reactiveTrigger') {
    return fill(queueStrings.why.reactiveTrigger, {
      bar: titleCase(reason.bar),
      threshold: reason.threshold,
      time: formatTimeOfDay(reason.atMinute),
    });
  }
  if (reason.kind === 'anchorWindow') {
    return fill(queueStrings.why.anchorWindow, {
      anchor: blockLabel(reason.anchorId),
      time: formatTimeOfDay(reason.targetMinute),
    });
  }
  if (reason.kind === 'routinePlan') {
    return reason.bar === null
      ? queueStrings.why.routineFree
      : fill(queueStrings.why.routineNeed, {
          bar: titleCase(reason.bar),
          threshold: reason.threshold,
        });
  }
  return reason.wrinkleId === 'package-delivery'
    ? queueStrings.why.wrinklePackage
    : queueStrings.why.wrinkleFallback;
}

export function bonusChipLabel(bonus: ForecastBonus): string {
  if (bonus.kind === 'practiceBlock') return queueStrings.chips.practiceBlock;
  const key = PAIR_CHIP_KEYS[bonus.pairId as keyof typeof PAIR_CHIP_KEYS];
  return key === undefined ? titleCase(bonus.pairId) : queueStrings.chips[key];
}

export function bonusDetail(bonus: ForecastBonus): string {
  if (bonus.kind === 'practiceBlock') {
    return fill(queueStrings.details.practiceBlock, {
      block: Math.round(bonus.blockFactor * 100),
      scattered: Math.round(bonus.scatteredFactor * 100),
    });
  }
  const effect = bonus.effect;
  if (effect.kind === 'halveDuration') return queueStrings.details.halveDuration;
  if (effect.kind === 'scaleDecay') {
    return fill(queueStrings.details.scaleDecay, {
      bar: titleCase(effect.bar),
      percent: Math.round((1 - effect.factor) * 100),
      hours: effect.durationMin / 60,
    });
  }
  if (effect.kind === 'barDelta') {
    const [bar, amount] = Object.entries(effect.deltas)[0] ?? ['bar', 0];
    return fill(queueStrings.details.barDelta, {
      amount: `${(amount ?? 0) > 0 ? '+' : ''}${amount ?? 0}`,
      bar: titleCase(bar),
    });
  }
  return fill(queueStrings.details.scalePoints, {
    percent: Math.round((effect.factor - 1) * 100),
  });
}

export function conflictDetail(conflict: ForecastConflict): string {
  return fill(queueStrings.details.conflict, {
    bar: titleCase(conflict.bar),
    time: formatTimeOfDay(conflict.atMinute),
  });
}

export function wakeConflictDetail(
  _conflict: ForecastWakeConflict,
): string {
  return queueStrings.details.wakeConflict;
}

export function capWasteDetail(bar: string, amount: number): string {
  return fill(queueStrings.details.capWaste, {
    amount: Math.round(amount * 10) / 10,
    bar: titleCase(bar),
  });
}

export function startConstraintChip(
  constraint: Exclude<CardStartDecision, { kind: 'start' }>,
): string {
  if (constraint.kind === 'reroute') {
    return queueStrings.chips.reroute;
  }
  return constraint.reason === 'object-blocked'
    ? queueStrings.chips.blocked
    : queueStrings.chips.waiting;
}

export function startConstraintDetail(
  constraint: Exclude<CardStartDecision, { kind: 'start' }>,
): string {
  if (constraint.kind === 'reroute') {
    return queueStrings.details.reroute;
  }
  return fill(
    constraint.reason === 'object-blocked'
      ? queueStrings.details.objectBlocked
      : queueStrings.details.activityUnavailable,
    {
      time: formatTimeOfDay(constraint.untilMinute),
      object: titleCase(constraint.targetId),
      activity: activityCopy(constraint.targetId).label,
    },
  );
}
