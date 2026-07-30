import { content } from '../../sim/content';
import {
  offerLetterIfDue,
  nextSundayAfter,
  nextWeekdayAfter,
  preparedPerformerBonusPercent,
  respondToLetter,
} from '../letter';
import { newSession, type GameObservation } from '../session';
import { advanceGame } from '../tick';

function sessionReadyForLetter() {
  const session = newSession();
  session.goals['balanced-week']!.status = 'rewarded';
  return session;
}

function observation(day: number): GameObservation {
  return {
    day,
    absoluteMinute: (day - 1) * 1440 + 600,
    minuteOfDay: 600,
    isMidnight: false,
    isMorningCheck: false,
    bars: {
      energy: 420_000,
      nutrition: 420_000,
      movement: 420_000,
      hygiene: 420_000,
    },
    currentActivityId: null,
    urgentCount: 0,
  };
}

test('Goal 6 opens the letter on Day 8, with a Day 10 hard fallback', () => {
  const ready = sessionReadyForLetter();
  expect(offerLetterIfDue(ready, 7)).toBe(ready);

  const dayEight = offerLetterIfDue(ready, 8);
  expect(dayEight.letter).toMatchObject({
    status: 'due',
    lastOfferedDay: 8,
    nextOfferDay: null,
  });
  expect(dayEight.goals['holidays-over']?.status).toBe('active');
  expect(offerLetterIfDue(dayEight, 8)).toBe(dayEight);

  const fallback = offerLetterIfDue(newSession(), 10);
  expect(fallback.letter.status).toBe('due');
  expect(fallback.letter.lastOfferedDay).toBe(10);
});

test('declining schedules the strictly next Sunday and reoffers once', () => {
  const due = offerLetterIfDue(sessionReadyForLetter(), 8);
  const declined = respondToLetter(
    due,
    'decline',
    8,
    70_000,
    content.practice.levels,
  );

  expect(nextSundayAfter(8)).toBe(14);
  expect(declined.letter).toMatchObject({
    status: 'declined',
    nextOfferDay: 14,
  });
  expect(offerLetterIfDue(declined, 13)).toBe(declined);

  const reoffered = offerLetterIfDue(declined, 14);
  expect(reoffered.letter).toMatchObject({
    status: 'due',
    lastOfferedDay: 14,
    nextOfferDay: null,
  });
  expect(offerLetterIfDue(reoffered, 14)).toBe(reoffered);
  expect(nextSundayAfter(14)).toBe(21);
});

test.each([
  [0, 0, 0],
  [10_000, 1, 20],
  [30_000, 2, 50],
  [70_000, 3, 100],
] as const)(
  'acceptance freezes %i points as L%i and a %i%% bonus',
  (points100, level, bonus) => {
    const due = offerLetterIfDue(newSession(), 10);
    const accepted = respondToLetter(
      due,
      'accept',
      12,
      points100,
      content.practice.levels,
    );

    expect(accepted.letter).toMatchObject({
      status: 'accepted',
      acceptedAtDay: 12,
      promisedStartDay: 15,
      preparedPerformerLevel: level,
      preparedPerformerBonusPercent: bonus,
    });
    expect(
      accepted.goals['holidays-over']?.counters.letterAccepted,
    ).toBe(1);
    expect(
      offerLetterIfDue(accepted, 30).letter,
    ).toEqual(accepted.letter);
  },
);

test('weekday and bonus helpers cover the v1 handoff boundaries', () => {
  expect(nextWeekdayAfter(4)).toBe(5);
  expect(nextWeekdayAfter(5)).toBe(8);
  expect(nextWeekdayAfter(6)).toBe(8);
  expect(nextWeekdayAfter(7)).toBe(8);
  expect(preparedPerformerBonusPercent(3)).toBe(100);
});

test('the accepted action completes Goal 7 and banks its terminal reward once', () => {
  const due = offerLetterIfDue(newSession(), 10);
  const first = advanceGame(
    due,
    [],
    [{ type: 'letterResponded', decision: 'accept' }],
    [],
    observation(10),
    content,
    {
      autonomy: 'full-routine',
      practicePoints100: 30_000,
    },
  ).session;

  expect(first.letter).toMatchObject({
    status: 'accepted',
    preparedPerformerLevel: 2,
    preparedPerformerBonusPercent: 50,
  });
  expect(first.goals['holidays-over']?.status).toBe('rewarded');
  expect(first.recap.goalProgressIds).toContain('holidays-over');
  expect(first.recap.rewardIds).toContain('first-gigs');

  const repeated = advanceGame(
    first,
    [],
    [{ type: 'letterResponded', decision: 'accept' }],
    [],
    observation(10),
    content,
    {
      autonomy: 'full-routine',
      practicePoints100: 70_000,
    },
  ).session;
  expect(repeated.letter).toEqual(first.letter);
  expect(repeated.recap.goalProgressIds).toEqual(
    first.recap.goalProgressIds,
  );
  expect(repeated.recap.rewardIds).toEqual(first.recap.rewardIds);
});
