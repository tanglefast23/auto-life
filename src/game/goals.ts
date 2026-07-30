import type {
  GoalDef,
  GoalReward,
} from '../sim/content-schemas';
import type { AutonomyMode } from '../sim/rules';
import type { GoalProgress } from './session';

export function goalCanProgress(
  goal: GoalDef,
  autonomy: AutonomyMode,
): boolean {
  return (
    goal.requiresAutonomy === 'any' ||
    autonomy === 'full-routine'
  );
}

export function goalConditionSatisfied(
  goal: GoalDef,
  progress: GoalProgress,
): boolean {
  const counters = progress.counters;
  switch (goal.condition.kind) {
    case 'activity-and-why':
      return (
        (counters.activitiesCompleted ?? 0) >=
          goal.condition.activityCompletions &&
        (counters.whyLineOpened ?? 0) >= 1
      );
    case 'queue-edit-and-forecast':
      return (
        (counters.queueEdits ?? 0) >= 1 &&
        (counters.forecastChangesSeen ?? 0) >= 1
      );
    case 'wrinkle-day':
      return (counters.resolvedDaysWithoutUrgent ?? 0) >= 1;
    case 'practice-level':
      return (
        (counters.practiceLevel ?? 0) >= goal.condition.level
      );
    case 'intention-bias':
      return (counters.intentionBiasDays ?? 0) >= 1;
    case 'balanced-streak':
      return (
        (counters.consecutiveBalancedDays ?? 0) >=
        goal.condition.days
      );
    case 'letter-accepted':
      return (counters.letterAccepted ?? 0) >= 1;
  }
}

export function rewardForGoal(
  goal: GoalDef,
  rewards: readonly GoalReward[],
): GoalReward {
  const reward = rewards.find(
    (candidate) => candidate.id === goal.rewardId,
  );
  if (reward === undefined) {
    throw new Error(
      `goal "${goal.id}" references unknown reward "${goal.rewardId}"`,
    );
  }
  return reward;
}
