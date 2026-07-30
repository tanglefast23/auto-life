import { z } from 'zod';
import rawGoalStrings from '../../content/strings/goals.json';
import type { GoalDef } from '../sim/content-schemas';
import type { SessionState } from '../game/session';

const GoalStringsSchema = z.strictObject({
  meetTheRoutine: goalCopySchema(),
  changeOfPlans: goalCopySchema(),
  handleTheWrinkle: goalCopySchema(),
  firstChord: goalCopySchema(),
  findTheRhythm: goalCopySchema(),
  balancedWeek: goalCopySchema(),
  holidaysOver: goalCopySchema(),
  rewards: z.strictObject({
    journal: z.string().min(1),
    bedroomPlant: z.string().min(1),
    wrinkleDecoration: z.string().min(1),
    airGuitar: z.string().min(1),
    practicePoster: z.string().min(1),
    routineMemory: z.string().min(1),
    firstGigs: z.string().min(1),
  }),
  ui: z.strictObject({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    panelLabel: z.string().min(1),
    open: z.string().min(1),
    close: z.string().min(1),
    allComplete: z.string().min(1),
    practiceSummary: z.string().min(1),
    practiceAccessibility: z.string().min(1),
    routineMemory: z.string().min(1),
    requiresFullRoutine: z.string().min(1),
    rewardPrefix: z.string().min(1),
    chooseReward: z.string().min(1),
    filters: z.strictObject({
      current: z.string().min(1),
      all: z.string().min(1),
    }),
    journal: z.strictObject({
      heading: z.string().min(1),
      locked: z.string().min(1),
      empty: z.string().min(1),
      entry: z.string().min(1),
    }),
    wrinkle: z.strictObject({
      heading: z.string().min(1),
      pending: z.string().min(1),
      quiet: z.string().min(1),
      resolved: z.string().min(1),
      active: z.string().min(1),
    }),
    statuses: z.strictObject({
      active: z.string().min(1),
      complete: z.string().min(1),
      rewarded: z.string().min(1),
      locked: z.string().min(1),
    }),
    progress: z.strictObject({
      activitiesAndWhy: z.string().min(1),
      whyOpened: z.string().min(1),
      openWhy: z.string().min(1),
      queueAndForecast: z.string().min(1),
      editDone: z.string().min(1),
      makeEdit: z.string().min(1),
      forecastSeen: z.string().min(1),
      checkForecast: z.string().min(1),
      wrinkleDay: z.string().min(1),
      practiceLevel: z.string().min(1),
      intentionBias: z.string().min(1),
      balancedStreak: z.string().min(1),
      letter: z.string().min(1),
    }),
    decorationChoices: z.strictObject({
      wrinkleKeepsake: z.string().min(1),
      wrinklePrint: z.string().min(1),
    }),
  }),
});

function goalCopySchema() {
  return z.strictObject({
    title: z.string().min(1),
    instruction: z.string().min(1),
  });
}

export const goalStrings = GoalStringsSchema.parse(rawGoalStrings);

export function goalString(stringId: string): string {
  const [namespace, path] = stringId.split(':', 2);
  if (namespace !== 'goals' || path === undefined) {
    throw new Error(`unsupported goal string "${stringId}"`);
  }
  let value: unknown = goalStrings;
  for (const segment of path.split('.')) {
    if (
      value === null ||
      typeof value !== 'object' ||
      !(segment in value)
    ) {
      throw new Error(`unknown goal string "${stringId}"`);
    }
    value = (value as Record<string, unknown>)[segment];
  }
  if (typeof value !== 'string') {
    throw new Error(`goal string "${stringId}" is not text`);
  }
  return value;
}

export function fillGoalCopy(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : token,
  );
}

export function goalProgressCopy(
  goal: GoalDef,
  session: SessionState,
): string {
  const counters = session.goals[goal.id]?.counters ?? {};
  const progress = goalStrings.ui.progress;
  switch (goal.condition.kind) {
    case 'activity-and-why':
      return fillGoalCopy(progress.activitiesAndWhy, {
        activities: Math.min(
          goal.condition.activityCompletions,
          counters.activitiesCompleted ?? 0,
        ),
        required: goal.condition.activityCompletions,
        why:
          (counters.whyLineOpened ?? 0) >= 1
            ? progress.whyOpened
            : progress.openWhy,
      });
    case 'queue-edit-and-forecast':
      return fillGoalCopy(progress.queueAndForecast, {
        edit:
          (counters.queueEdits ?? 0) >= 1
            ? progress.editDone
            : progress.makeEdit,
        forecast:
          (counters.forecastChangesSeen ?? 0) >= 1
            ? progress.forecastSeen
            : progress.checkForecast,
      });
    case 'wrinkle-day':
      return fillGoalCopy(progress.wrinkleDay, {
        days: Math.min(
          1,
          counters.resolvedDaysWithoutUrgent ?? 0,
        ),
      });
    case 'practice-level':
      return fillGoalCopy(progress.practiceLevel, {
        level: counters.practiceLevel ?? 0,
        required: goal.condition.level,
      });
    case 'intention-bias':
      return fillGoalCopy(progress.intentionBias, {
        days: Math.min(1, counters.intentionBiasDays ?? 0),
      });
    case 'balanced-streak':
      return fillGoalCopy(progress.balancedStreak, {
        days: Math.min(
          goal.condition.days,
          counters.consecutiveBalancedDays ?? 0,
        ),
        required: goal.condition.days,
      });
    case 'letter-accepted':
      return fillGoalCopy(progress.letter, {
        answers: Math.min(1, counters.letterAccepted ?? 0),
      });
  }
}

export function decorationChoiceLabel(id: string): string {
  if (id === 'wrinkle-keepsake') {
    return goalStrings.ui.decorationChoices.wrinkleKeepsake;
  }
  if (id === 'wrinkle-print') {
    return goalStrings.ui.decorationChoices.wrinklePrint;
  }
  return id;
}
