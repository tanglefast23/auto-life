import {
  practiceLevel,
  type PracticeLevel,
} from '../sim/practice-level';
import type { SessionState } from './session';

export type LetterDecision = 'accept' | 'decline';

const GOAL_SIX_ID = 'balanced-week';
const GOAL_SEVEN_ID = 'holidays-over';
const HARD_FALLBACK_DAY = 10;

export function preparedPerformerBonusPercent(
  level: PracticeLevel,
): 0 | 20 | 50 | 100 {
  return [0, 20, 50, 100][level] as 0 | 20 | 50 | 100;
}

/** Day 1 is Monday. A Sunday decline always means the following Sunday. */
export function nextSundayAfter(day: number): number {
  const weekdayIndex = (day - 1) % 7;
  const daysUntilSunday = (6 - weekdayIndex + 7) % 7;
  return day + (daysUntilSunday === 0 ? 7 : daysUntilSunday);
}

/** The promised start is strictly after the acceptance day. */
export function nextWeekdayAfter(day: number): number {
  let candidate = day + 1;
  while ((candidate - 1) % 7 >= 5) candidate += 1;
  return candidate;
}

/**
 * Opens the v1 chapter-ending decision when its saved trigger is due.
 * Repeated boundary checks and reloads are no-ops once the same offer exists.
 */
export function offerLetterIfDue(
  session: SessionState,
  day: number,
): SessionState {
  if (!Number.isInteger(day) || day < 1) return session;
  if (
    session.letter.status === 'due' ||
    session.letter.status === 'accepted'
  ) {
    return session;
  }

  const goalSixStatus = session.goals[GOAL_SIX_ID]?.status;
  const earnedEarlyOffer =
    session.letter.status === 'not-due' &&
    day >= 8 &&
    (goalSixStatus === 'complete' || goalSixStatus === 'rewarded');
  const declinedOfferDue =
    session.letter.status === 'declined' &&
    session.letter.nextOfferDay !== null &&
    day >= session.letter.nextOfferDay;
  const fallbackOfferDue =
    session.letter.status === 'not-due' && day >= HARD_FALLBACK_DAY;
  if (!earnedEarlyOffer && !declinedOfferDue && !fallbackOfferDue) {
    return session;
  }

  const goalSeven = session.goals[GOAL_SEVEN_ID];
  return {
    ...session,
    goals:
      goalSeven?.status === 'locked'
        ? {
            ...session.goals,
            [GOAL_SEVEN_ID]: {
              ...goalSeven,
              status: 'active',
            },
          }
        : session.goals,
    letter: {
      ...session.letter,
      status: 'due',
      lastOfferedDay: day,
      nextOfferDay: null,
    },
  };
}

export function respondToLetter(
  session: SessionState,
  decision: LetterDecision,
  day: number,
  practicePoints100: number,
  levelThresholds: readonly number[],
): SessionState {
  if (session.letter.status !== 'due') return session;
  if (decision === 'decline') {
    return {
      ...session,
      letter: {
        ...session.letter,
        status: 'declined',
        nextOfferDay: nextSundayAfter(day),
      },
    };
  }

  const level = practiceLevel(practicePoints100, levelThresholds);
  const goalSeven = session.goals[GOAL_SEVEN_ID];
  return {
    ...session,
    goals:
      goalSeven === undefined
        ? session.goals
        : {
            ...session.goals,
            [GOAL_SEVEN_ID]: {
              ...goalSeven,
              status:
                goalSeven.status === 'locked'
                  ? 'active'
                  : goalSeven.status,
              counters: {
                ...goalSeven.counters,
                letterAccepted: 1,
              },
            },
          },
    letter: {
      ...session.letter,
      status: 'accepted',
      nextOfferDay: null,
      acceptedAtDay: day,
      promisedStartDay: nextWeekdayAfter(day),
      preparedPerformerLevel: level,
      preparedPerformerBonusPercent:
        preparedPerformerBonusPercent(level),
    },
  };
}
