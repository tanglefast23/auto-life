import type { CommandOutcome, DomainEvent } from '../sim/step';
import type { SessionState } from './session';

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
      type: 'decorationChosen';
      wrinkleId: string;
      decorationId: string;
    };

export interface GameTickResult {
  session: SessionState;
}

export function advanceGame(
  session: SessionState,
  simEvents: readonly DomainEvent[],
  actions: readonly GameAction[] = [],
  commandOutcomes: readonly CommandOutcome[] = [],
): GameTickResult {
  let observations = session.observations;
  let wrinkles = session.wrinkles;
  let decorations = session.decorations;
  let goals = session.goals;
  let unlocks = session.unlocks;

  // Actions fold before sim events: they were taken during the frame that produced this
  // tick, so they precede anything the tick itself caused. Fixed order, not incidental —
  // the replay depends on it.
  for (const a of actions) {
    if (a.type === 'whyLineOpened') {
      observations = { ...observations, whyLineOpened: true };
    } else if (a.type === 'forecastChangeObserved') {
      observations = { ...observations, forecastChangeObserved: true };
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
        resolvedIds: addUnique(wrinkles.resolvedIds, a.wrinkleId),
      };
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

  let recap = session.recap;
  let morningRecap = session.morningRecap;

  // Folded strictly in arrival order, which is what decides where a completion lands
  // when it shares a batch with the boundary: before it, the completion belongs to the
  // day that just ended (whose recap has already been shown, so clearing it is right);
  // after it, to the new day.
  for (const e of simEvents) {
    if (e.type === 'activityCompleted') {
      recap = { ...recap, completedActivityIds: [...recap.completedActivityIds, e.detail] };
      goals = incrementGoalCounter(
        goals,
        'meet-you',
        'activitiesCompleted',
      );
      if (
        e.detail === 'package' &&
        wrinkles.pendingId === 'package-delivery'
      ) {
        wrinkles = {
          ...wrinkles,
          choiceReadyId: 'package-delivery',
        };
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
    } else if (e.type === 'wakeBoundary') {
      // detail is the day number (step.ts emits String(dayNumber(...))).
      morningRecap = recap;
      recap = {
        forDay: Number(e.detail),
        completedActivityIds: [],
        missedAnchorIds: [],
        practicePoints100: 0,
      };
    }
  }

  if (observations.whyLineOpened) {
    goals = setGoalCounter(
      goals,
      'meet-you',
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

  const meet = goals['meet-you'];
  if (
    meet?.status === 'active' &&
    (meet.counters.activitiesCompleted ?? 0) >= 3 &&
    (meet.counters.whyLineOpened ?? 0) >= 1
  ) {
    goals = {
      ...goals,
      'meet-you': { ...meet, status: 'complete' },
    };
    unlocks = { ...unlocks, journal: true };
  }

  const change = goals['change-of-plans'];
  if (
    change?.status === 'active' &&
    (change.counters.queueEdits ?? 0) >= 1 &&
    (change.counters.forecastChangesSeen ?? 0) >= 1
  ) {
    goals = {
      ...goals,
      'change-of-plans': { ...change, status: 'complete' },
    };
    decorations = {
      grantedIds: addUnique(decorations.grantedIds, 'goal-plant'),
    };
  }

  const unchanged =
    recap === session.recap &&
    morningRecap === session.morningRecap &&
    observations === session.observations &&
    wrinkles === session.wrinkles &&
    decorations === session.decorations &&
    goals === session.goals &&
    unlocks === session.unlocks;
  return {
    session: unchanged
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
        },
  };
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
  if (goal === undefined || goal.status === 'complete') return goals;
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
    goal.status === 'complete' ||
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
