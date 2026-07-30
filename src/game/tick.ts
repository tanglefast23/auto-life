import type { CommandOutcome, DomainEvent } from '../sim/step';
import {
  newDailyRecap,
  type GameObservation,
  type SessionState,
} from './session';
import type { ContentRegistry } from '../sim/content';
import { toFixed } from '../sim/fixed';
import { practiceLevel } from '../sim/practice-level';
import type { AutonomyMode } from '../sim/rules';
import {
  goalCanProgress,
  goalConditionSatisfied,
  rewardForGoal,
} from './goals';
import {
  offerLetterIfDue,
  respondToLetter,
  type LetterDecision,
} from './letter';

/**
 * The `game/` half of the top-level tick (plan T1).
 *
 * **Reducer order — the decision T1 owes, recorded here rather than left implicit.**
 * One tick runs in three phases, always in this order:
 *
 *   1. **pre-sim** — `game/` produces commands (a wrinkle firing, §9.4's package).
 *      They are enqueued *before* the sim step, so the sim sees them in its own
 *      stage 1 and nothing observes a half-applied tick.
 *   2. **sim** — `step()` applies commands and advances one game-minute, returning
 *      next state, snapshot, and its `DomainEvent`s.
 *   3. **post-event** — `advanceGame` (this function) folds those events into the
 *      session. It runs *after* the sim so it can never influence the tick it is
 *      observing, which is what keeps the sim replayable on its own.
 *
 * `application/` composes the three; neither `sim/` nor `game/` knows about the loop.
 * That direction matters for Q6's sleep-skip: the batch replays the same three phases
 * per skipped tick, so a skipped night and a watched night fold identical events in
 * identical order.
 *
 * Pure and total: no clock, no randomness of its own, no I/O.
 */

/**
 * Player observations the sim cannot emit, because they happen in the UI: §12's Goal 1
 * needs a why-line to have been *opened*, Goal 2 needs a forecast change to have been
 * *seen*. Serializable so the scripted-player replay (T11) can carry them — a replay of
 * sim commands alone could never reproduce a goal that turns on looking at something.
 */
export type GameAction =
  | { type: 'whyLineOpened'; cardId: string }
  | { type: 'forecastChangeObserved' }
  | {
      type: 'intentionSelected';
      intentionId: string;
      day: number;
      deliberate: boolean;
    }
  | {
      type: 'decorationChosen';
      wrinkleId: string;
      decorationId: string;
    }
  | {
      type: 'wrinkleAction';
      wrinkleId: string;
      actionId: string;
    }
  | {
      type: 'goalRewardChosen';
      goalId: string;
      choiceId: string;
    }
  | {
      type: 'letterResponded';
      decision: LetterDecision;
    };

export interface GameTickResult {
  session: SessionState;
}

export interface GameRuntimeContext {
  autonomy: AutonomyMode;
  practicePoints100: number;
}

export function advanceGame(
  session: SessionState,
  simEvents: readonly DomainEvent[],
  actions: readonly GameAction[] = [],
  commandOutcomes: readonly CommandOutcome[] = [],
  observation?: GameObservation,
  content?: ContentRegistry,
  runtime?: GameRuntimeContext,
): GameTickResult {
  let observations = session.observations;
  let wrinkles = session.wrinkles;
  let decorations = session.decorations;
  let goals = session.goals;
  let unlocks = session.unlocks;
  let intentions = session.intentions;
  let recap = session.recap;
  let morningRecap = session.morningRecap;
  let calendarLedger = session.calendarLedger;
  let routineMemory = session.routineMemory;
  let letter = session.letter;
  const autonomy = runtime?.autonomy ?? 'full-routine';

  const resolveWrinkle = (wrinkleId: string, day: number): void => {
    const deal = wrinkles.dealt.find(
      (entry) =>
        entry.day === day && entry.wrinkleId === wrinkleId,
    );
    if (deal?.resolved === true) return;
    wrinkles = {
      ...wrinkles,
      pendingId:
        wrinkles.pendingId === wrinkleId
          ? null
          : wrinkles.pendingId,
      choiceReadyId:
        wrinkles.choiceReadyId === wrinkleId
          ? null
          : wrinkles.choiceReadyId,
      resolvedIds: addUnique(wrinkles.resolvedIds, wrinkleId),
      dealt: wrinkles.dealt.map((entry) =>
        entry.day === day && entry.wrinkleId === wrinkleId
          ? { ...entry, resolved: true }
          : entry,
      ),
    };
    if (recap.forDay === day) {
      recap = { ...recap, wrinkleOutcomeId: wrinkleId };
    }
    calendarLedger = updateCalendarDay(
      calendarLedger,
      day,
      (entry) => ({
        ...entry,
        resolvedWrinkleId: wrinkleId,
      }),
    );
  };

  // Actions fold before sim events: they were taken during the frame that produced this
  // tick, so they precede anything the tick itself caused. Fixed order, not incidental —
  // the replay depends on it.
  for (const a of actions) {
    if (a.type === 'whyLineOpened') {
      observations = { ...observations, whyLineOpened: true };
    } else if (a.type === 'forecastChangeObserved') {
      observations = { ...observations, forecastChangeObserved: true };
    } else if (
      a.type === 'intentionSelected' &&
      observation !== undefined &&
      a.day === observation.day &&
      intentions.today === null &&
      (
        content === undefined ||
        content.intentions.intentions.some(
          (intention) => intention.id === a.intentionId,
        )
      )
    ) {
      intentions = {
        ...intentions,
        today: {
          day: a.day,
          intentionId: a.intentionId,
          deliberate: a.deliberate,
          // The observation is post-step. Store the boundary minute that
          // consumed the action so a completion on that same boundary cannot
          // retroactively satisfy the choice.
          selectedAtMinute: Math.max(
            0,
            observation.absoluteMinute - 1,
          ),
          biasTargetCompletedAtMinute: null,
        },
      };
    } else if (
      a.type === 'decorationChosen' &&
      wrinkles.pendingId === a.wrinkleId &&
      wrinkles.choiceReadyId === a.wrinkleId
    ) {
      decorations = {
        grantedIds: addUnique(decorations.grantedIds, a.decorationId),
      };
      wrinkles = {
        ...wrinkles,
        pendingId: null,
        choiceReadyId: null,
      };
      resolveWrinkle(
        a.wrinkleId,
        wrinkles.announced?.day ?? observation?.day ?? 1,
      );
    } else if (
      a.type === 'wrinkleAction' &&
      content !== undefined &&
      wrinkles.announced?.wrinkleId === a.wrinkleId &&
      wrinkles.choiceReadyId === a.wrinkleId
    ) {
      const announced = wrinkles.announced;
      const wrinkle = content.wrinkles.entries.find(
        (entry) => entry.id === a.wrinkleId,
      );
      const variant = wrinkle?.variants.find(
        (entry) => entry.id === announced.variantId,
      );
      if (variant?.playerAction.id === a.actionId) {
        wrinkles = {
          ...wrinkles,
          choiceReadyId: null,
          announced: {
            ...announced,
            parameters: {
              ...announced.parameters,
              actionAccepted: true,
            },
          },
        };
        if (wrinkle?.success.kind === 'anchor-rescheduled') {
          resolveWrinkle(a.wrinkleId, announced.day);
        }
      }
    } else if (
      a.type === 'goalRewardChosen' &&
      content !== undefined
    ) {
      const goalDef = content.goals.goals.find(
        (goal) => goal.id === a.goalId,
      );
      const progress =
        goalDef === undefined ? undefined : goals[goalDef.id];
      const reward =
        goalDef === undefined
          ? undefined
          : rewardForGoal(goalDef, content.goals.rewards);
      if (
        goalDef !== undefined &&
        progress?.status === 'complete' &&
        reward?.kind === 'decoration' &&
        reward.decorationIds.includes(a.choiceId) &&
        !decorations.grantedIds.includes(a.choiceId)
      ) {
        decorations = {
          grantedIds: [
            ...decorations.grantedIds,
            a.choiceId,
          ],
        };
        goals = {
          ...goals,
          [goalDef.id]: {
            ...progress,
            status: 'rewarded',
          },
        };
        recap = {
          ...recap,
          rewardIds: addUnique(recap.rewardIds, reward.id),
        };
      }
    } else if (
      a.type === 'letterResponded' &&
      observation !== undefined &&
      content !== undefined &&
      runtime !== undefined
    ) {
      const responded = respondToLetter(
        { ...session, goals, letter },
        a.decision,
        observation.day,
        runtime.practicePoints100,
        content.practice.levels,
      );
      goals = responded.goals;
      letter = responded.letter;
    }
  }

  // Commands were applied in the sim phase before any of this tick's events.
  // Fold their typed outcomes in the same input order. A rejected command is not
  // a fired wrinkle; game state records only what the engine actually accepted.
  for (const outcome of commandOutcomes) {
    if (outcome.type === 'insertWrinkle' && outcome.status === 'accepted') {
      const firedIds = wrinkles.firedIds.includes(outcome.wrinkleId)
        ? wrinkles.firedIds
        : [...wrinkles.firedIds, outcome.wrinkleId];
      wrinkles = {
        ...wrinkles,
        firedIds,
        pendingId: outcome.wrinkleId,
        choiceReadyId: null,
        announced:
          wrinkles.announced ??
          packageAnnouncement(
            outcome.wrinkleId,
            observation?.day ?? 1,
            content,
          ),
        dealt: wrinkles.dealt.some(
          (entry) =>
            entry.day === (observation?.day ?? 1) &&
            entry.wrinkleId === outcome.wrinkleId,
        )
          ? wrinkles.dealt
          : [
              ...wrinkles.dealt,
              {
                day: observation?.day ?? 1,
                wrinkleId: outcome.wrinkleId,
                variantId:
                  packageAnnouncement(
                    outcome.wrinkleId,
                    observation?.day ?? 1,
                    content,
                  )?.variantId ?? null,
                resolved: false,
              },
            ],
      };
    } else if (
      outcome.status === 'accepted' &&
      (
        outcome.type === 'insertPlayer' ||
        outcome.type === 'objectClick' ||
        outcome.type === 'moveCard'
      )
    ) {
      goals = incrementGoalCounter(
        goals,
        'change-of-plans',
        'queueEdits',
      );
    }
  }

  // Folded strictly in arrival order, which is what decides where a completion lands
  // when it shares a batch with the boundary: before it, the completion belongs to the
  // day that just ended (whose recap has already been shown, so clearing it is right);
  // after it, to the new day.
  for (const e of simEvents) {
    if (e.type === 'wrinkleEffectApplied') {
      const announced = wrinkles.announced;
      if (announced?.wrinkleId === e.detail) {
        wrinkles = {
          ...wrinkles,
          announced: {
            ...announced,
            parameters: {
              ...announced.parameters,
              effectApplied: true,
            },
          },
        };
      }
    } else if (e.type === 'reactiveActivityCompleted') {
      const completionDay = dayForMinute(e.atMinute);
      calendarLedger = updateCalendarDay(
        calendarLedger,
        completionDay,
        (day) =>
          day.firstReactiveCompletionPositions[e.detail] !==
          undefined
            ? day
            : {
                ...day,
                firstReactiveCompletionPositions: {
                  ...day.firstReactiveCompletionPositions,
                  [e.detail]: Object.keys(
                    day.firstReactiveCompletionPositions,
                  ).length,
                },
              },
      );
    } else if (e.type === 'activityCompleted') {
      const announcedAtCompletion = wrinkles.announced;
      const suppressMealCount =
        e.detail === 'meal' &&
        announcedAtCompletion !== null &&
        announcedAtCompletion.parameters.effectApplied === true &&
        content?.wrinkles.entries.find(
          (entry) =>
            entry.id === announcedAtCompletion.wrinkleId,
        )?.effect.kind === 'forced-substitution';
      recap = {
        ...recap,
        completedActivityIds: [...recap.completedActivityIds, e.detail],
        mealCount:
          recap.mealCount +
          (e.detail === 'meal' && !suppressMealCount ? 1 : 0),
        practiceSessions:
          recap.practiceSessions + (e.detail === 'practice' ? 1 : 0),
      };
      goals = incrementGoalCounter(
        goals,
        'meet-the-routine',
        'activitiesCompleted',
      );
      if (e.detail === 'practice') {
        calendarLedger = updateCalendarDay(
          calendarLedger,
          dayForMinute(e.atMinute),
          (day) => ({
            ...day,
            practiceSessions: day.practiceSessions + 1,
          }),
        );
      }
      if (
        e.detail === 'package' &&
        wrinkles.pendingId === 'package-delivery'
      ) {
        wrinkles = {
          ...wrinkles,
          choiceReadyId: 'package-delivery',
        };
      }
      const announced = wrinkles.announced;
      if (announced !== null && content !== undefined) {
        const wrinkle = content.wrinkles.entries.find(
          (entry) => entry.id === announced.wrinkleId,
        );
        if (
          wrinkle !== undefined &&
          wrinkleSuccessMatchesActivity(wrinkle.success, e.detail)
        ) {
          if (
            wrinkle.effect.kind === 'slowed-activity' &&
            e.detail === wrinkle.effect.clearActivityId
          ) {
            wrinkles = {
              ...wrinkles,
              announced: {
                ...announced,
                parameters: {
                  ...announced.parameters,
                  cleared: true,
                },
              },
            };
          }
          resolveWrinkle(announced.wrinkleId, announced.day);
        }
      }
      const selected = intentions.today;
      if (
        selected !== null &&
        selected.deliberate &&
        selected.biasTargetCompletedAtMinute === null &&
        selected.day === dayForMinute(e.atMinute) &&
        e.atMinute > selected.selectedAtMinute &&
        content !== undefined &&
        activityMatchesIntention(
          selected.intentionId,
          e.detail,
          content,
        )
      ) {
        intentions = {
          ...intentions,
          today: {
            ...selected,
            biasTargetCompletedAtMinute: e.atMinute,
          },
        };
        goals = incrementGoalCounter(
          goals,
          'find-the-rhythm',
          'intentionBiasDays',
        );
      }
    } else if (e.type === 'practiceAwarded') {
      const amount = Number(e.detail);
      if (Number.isInteger(amount) && amount > 0) {
        recap = {
          ...recap,
          practicePoints100: recap.practicePoints100 + amount,
        };
      }
    } else if (e.type === 'anchorMissed') {
      recap = { ...recap, missedAnchorIds: [...recap.missedAnchorIds, e.detail] };
    } else if (e.type === 'urgent') {
      calendarLedger = updateCalendarDay(
        calendarLedger,
        dayForMinute(e.atMinute),
        (day) => ({ ...day, urgentEvents: day.urgentEvents + 1 }),
      );
    } else if (e.type === 'wakeBoundary') {
      // detail is the day number (step.ts emits String(dayNumber(...))).
      const nextDay = Number(e.detail);
      const completedIntention = intentions.today;
      intentions = {
        today: null,
        history:
          completedIntention === null ||
          intentions.history.some(
            (entry) => entry.day === completedIntention.day,
          )
            ? intentions.history
            : [...intentions.history, completedIntention],
      };
      morningRecap = {
        ...recap,
        endingBars:
          recap.endingBars ??
          observation?.bars ??
          null,
      };
      recap = {
        ...newDailyRecap(nextDay),
        priorEndingBars: morningRecap.endingBars,
      };
    }
  }

  if (observation?.isMidnight) {
    const completedDay = Math.max(1, observation.day - 1);
    if (
      recap.forDay === completedDay &&
      recap.endingBars === null
    ) {
      recap = {
        ...recap,
        endingBars: { ...observation.bars },
      };
    }
    const priorMidnight =
      calendarLedger.days.find(
        (day) => day.day === completedDay,
      )?.midnight ?? null;
    calendarLedger = updateCalendarDay(
      calendarLedger,
      completedDay,
      (day) => ({ ...day, midnight: observation }),
    );
    if (priorMidnight === null) {
      const completedEntry = calendarLedger.days.find(
        (day) => day.day === completedDay,
      );
      if (completedEntry !== undefined) {
        routineMemory = {
          ...routineMemory,
          completedDays: [
            ...routineMemory.completedDays.filter(
              (entry) => entry.day !== completedDay,
            ),
            {
              day: completedDay,
              firstCompletionPositionByActivity: {
                ...completedEntry.firstReactiveCompletionPositions,
              },
            },
          ]
            .sort((a, b) => a.day - b.day)
            .slice(-3),
        };
        const wrinkleGoal = content?.goals.goals.find(
          (goal) =>
            goal.condition.kind === 'wrinkle-day',
        );
        if (
          wrinkleGoal !== undefined &&
          wrinkleGoal.condition.kind === 'wrinkle-day' &&
          goalCanProgress(wrinkleGoal, autonomy) &&
          completedEntry.resolvedWrinkleId !== null &&
          completedEntry.urgentEvents <=
            wrinkleGoal.condition.maxUrgentEvents
        ) {
          goals = incrementGoalCounter(
            goals,
            wrinkleGoal.id,
            'resolvedDaysWithoutUrgent',
          );
        }
      }
    }
    const announced = wrinkles.announced;
    if (announced !== null && announced.day < observation.day) {
      if (recap.forDay === announced.day) {
        recap = {
          ...recap,
          wrinkleOutcomeId: announced.wrinkleId,
        };
      }
      wrinkles = {
        ...wrinkles,
        pendingId: null,
        choiceReadyId: null,
        announced: null,
        dealt: wrinkles.dealt.map((entry) =>
          entry.day === announced.day &&
          entry.wrinkleId === announced.wrinkleId
            ? { ...entry, resolved: true }
            : entry,
        ),
      };
    }
  }
  if (observation?.isMorningCheck) {
    const existingMorning =
      calendarLedger.days.find(
        (day) => day.day === observation.day,
      )?.morningCheck ?? null;
    calendarLedger = updateCalendarDay(
      calendarLedger,
      observation.day,
      (day) => ({ ...day, morningCheck: observation }),
    );
    if (existingMorning === null) {
      const balancedGoal = content?.goals.goals.find(
        (goal) =>
          goal.condition.kind === 'balanced-streak',
      );
      const priorDay = calendarLedger.days.find(
        (day) => day.day === observation.day - 1,
      );
      if (
        balancedGoal !== undefined &&
        balancedGoal.condition.kind === 'balanced-streak'
      ) {
        const condition = balancedGoal.condition;
        const balanced =
          goalCanProgress(balancedGoal, autonomy) &&
          priorDay !== undefined &&
          priorDay.practiceSessions >=
            condition.practiceSessionsPerDay &&
          priorDay.urgentEvents <= condition.maxUrgentEvents &&
          Object.values(observation.bars).every(
            (value) => value >= toFixed(condition.barsAtLeast),
          );
        const progress = goals[balancedGoal.id];
        if (progress?.status === 'active') {
          goals = setGoalCounter(
            goals,
            balancedGoal.id,
            'consecutiveBalancedDays',
            balanced
              ? (progress.counters.consecutiveBalancedDays ?? 0) + 1
              : 0,
          );
        }
      }
    }
  }

  if (observations.whyLineOpened) {
    goals = setGoalCounter(
      goals,
      'meet-the-routine',
      'whyLineOpened',
      1,
    );
  }
  if (observations.forecastChangeObserved) {
    goals = setGoalCounter(
      goals,
      'change-of-plans',
      'forecastChangesSeen',
      1,
    );
  }

  if (content !== undefined) {
    if (runtime !== undefined) {
      goals = setGoalCounter(
        goals,
        'first-chord',
        'practiceLevel',
        practiceLevel(
          runtime.practicePoints100,
          content.practice.levels,
        ),
      );
    }
    for (const goalDef of content.goals.goals) {
      const progress = goals[goalDef.id];
      if (
        progress?.status !== 'active' ||
        !goalCanProgress(goalDef, autonomy) ||
        !goalConditionSatisfied(goalDef, progress)
      ) {
        continue;
      }
      goals = {
        ...goals,
        [goalDef.id]: {
          ...progress,
          status: 'complete',
        },
      };
      recap = {
        ...recap,
        goalProgressIds: addUnique(
          recap.goalProgressIds,
          goalDef.id,
        ),
      };
    }

    for (const goalDef of content.goals.goals) {
      const progress = goals[goalDef.id];
      if (progress?.status !== 'complete') continue;
      const reward = rewardForGoal(
        goalDef,
        content.goals.rewards,
      );
      let applied = false;
      if (reward.kind === 'journal-unlock') {
        unlocks = { ...unlocks, journal: true };
        applied = true;
      } else if (reward.kind === 'decoration') {
        if (reward.decorationIds.length === 1) {
          decorations = {
            grantedIds: addUnique(
              decorations.grantedIds,
              reward.decorationIds[0]!,
            ),
          };
          applied = true;
        } else if (
          reward.decorationIds.every((id) =>
            decorations.grantedIds.includes(id),
          )
        ) {
          applied = true;
        }
      } else if (reward.kind === 'idle-variant') {
        applied = true;
      } else if (reward.kind === 'routine-memory') {
        unlocks = { ...unlocks, routineMemory: true };
        applied = true;
      } else if (reward.kind === 'chapter-handoff') {
        applied = letter.status === 'accepted';
      }
      if (!applied) continue;
      goals = {
        ...goals,
        [goalDef.id]: {
          ...progress,
          status: 'rewarded',
        },
      };
      recap = {
        ...recap,
        rewardIds: addUnique(recap.rewardIds, reward.id),
      };
    }
  }

  const unchanged =
    recap === session.recap &&
    morningRecap === session.morningRecap &&
    observations === session.observations &&
    wrinkles === session.wrinkles &&
    decorations === session.decorations &&
    goals === session.goals &&
    unlocks === session.unlocks &&
    calendarLedger === session.calendarLedger &&
    intentions === session.intentions &&
    routineMemory === session.routineMemory &&
    letter === session.letter;
  const foldedSession = unchanged
    ? session
    : {
        ...session,
        goals,
        observations,
        wrinkles,
        decorations,
        unlocks,
        recap,
        morningRecap,
        calendarLedger,
        intentions,
        routineMemory,
        letter,
      };
  return {
    session:
      observation === undefined
        ? foldedSession
        : offerLetterIfDue(foldedSession, observation.day),
  };
}

function activityMatchesIntention(
  intentionId: string,
  activityId: string,
  content: ContentRegistry,
): boolean {
  const intention = content.intentions.intentions.find(
    (candidate) => candidate.id === intentionId,
  );
  if (intention === undefined) return false;
  if (intention.biasTarget.kind === 'any-completed-activity') {
    return true;
  }
  if (intention.biasTarget.kind === 'activity') {
    return intention.biasTarget.activityIds.includes(activityId);
  }
  const activity = content.activities.activities.find(
    (candidate) => candidate.id === activityId,
  );
  return (
    activity !== undefined &&
    'tags' in activity &&
    (activity.tags?.includes(intention.biasTarget.tag) ?? false)
  );
}

function dayForMinute(absoluteMinute: number): number {
  return Math.floor(absoluteMinute / 1440) + 1;
}

function packageAnnouncement(
  wrinkleId: string,
  day: number,
  content: ContentRegistry | undefined,
): SessionState['wrinkles']['announced'] {
  const wrinkle = content?.wrinkles.entries.find(
    (entry) => entry.id === wrinkleId,
  );
  const variant = wrinkle?.variants[0];
  if (wrinkle === undefined || variant === undefined) return null;
  return {
    day,
    wrinkleId,
    variantId: variant.id,
    parameters: {},
  };
}

function wrinkleSuccessMatchesActivity(
  success: ContentRegistry['wrinkles']['entries'][number]['success'],
  activityId: string,
): boolean {
  if (success.kind === 'activity-completed') {
    return success.activityId === activityId;
  }
  if (success.kind === 'one-of-activities-completed') {
    return success.activityIds.includes(activityId);
  }
  return false;
}

function updateCalendarDay(
  ledger: SessionState['calendarLedger'],
  dayNumber: number,
  update: (
    day: SessionState['calendarLedger']['days'][number],
  ) => SessionState['calendarLedger']['days'][number],
): SessionState['calendarLedger'] {
  const existingIndex = ledger.days.findIndex(
    (day) => day.day === dayNumber,
  );
  const existing =
    existingIndex === -1
      ? {
          day: dayNumber,
          midnight: null,
          morningCheck: null,
          practiceSessions: 0,
          urgentEvents: 0,
          resolvedWrinkleId: null,
          firstReactiveCompletionPositions: {},
        }
      : ledger.days[existingIndex]!;
  const nextDay = update(existing);
  const days =
    existingIndex === -1
      ? [...ledger.days, nextDay]
      : ledger.days.map((day, index) =>
          index === existingIndex ? nextDay : day,
        );
  return { days };
}

function addUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}

function incrementGoalCounter(
  goals: SessionState['goals'],
  goalId: string,
  counter: string,
): SessionState['goals'] {
  const goal = goals[goalId];
  if (goal === undefined || goal.status !== 'active') return goals;
  return {
    ...goals,
    [goalId]: {
      ...goal,
      counters: {
        ...goal.counters,
        [counter]: (goal.counters[counter] ?? 0) + 1,
      },
    },
  };
}

function setGoalCounter(
  goals: SessionState['goals'],
  goalId: string,
  counter: string,
  value: number,
): SessionState['goals'] {
  const goal = goals[goalId];
  if (
    goal === undefined ||
    goal.status !== 'active' ||
    goal.counters[counter] === value
  ) {
    return goals;
  }
  return {
    ...goals,
    [goalId]: {
      ...goal,
      counters: {
        ...goal.counters,
        [counter]: value,
      },
    },
  };
}
