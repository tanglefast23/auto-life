import { toFixed } from '../../sim/fixed';
import { advanceGame } from '../tick';
import {
  newSession,
  type GameObservation,
} from '../session';

function observation(
  overrides: Partial<GameObservation>,
): GameObservation {
  return {
    day: 1,
    absoluteMinute: 540,
    minuteOfDay: 540,
    isMidnight: false,
    isMorningCheck: true,
    bars: {
      energy: toFixed(90),
      nutrition: toFixed(82),
      movement: toFixed(71),
      hygiene: toFixed(95),
    },
    currentActivityId: null,
    urgentCount: 0,
    ...overrides,
  };
}

test('calendar samples are separate from wake-based recap presentation', () => {
  const morning = advanceGame(
    newSession(),
    [],
    [],
    [],
    observation({}),
  ).session;
  expect(morning.calendarLedger.days[0]).toMatchObject({
    day: 1,
    morningCheck: expect.objectContaining({ minuteOfDay: 540 }),
  });
  expect(morning.morningRecap).toBeNull();

  const midnight = advanceGame(
    morning,
    [],
    [],
    [],
    observation({
      day: 2,
      absoluteMinute: 1440,
      minuteOfDay: 0,
      isMidnight: true,
      isMorningCheck: false,
    }),
  ).session;
  expect(midnight.calendarLedger.days[0]).toMatchObject({
    day: 1,
    midnight: expect.objectContaining({ absoluteMinute: 1440 }),
  });
  expect(midnight.morningRecap).toBeNull();

  const wake = advanceGame(
    midnight,
    [
      {
        type: 'wakeBoundary',
        detail: '2',
        atMinute: 1829,
      },
    ],
    [],
    [],
    observation({
      day: 2,
      absoluteMinute: 1830,
      minuteOfDay: 390,
      isMidnight: false,
      isMorningCheck: false,
    }),
  ).session;
  expect(wake.morningRecap).not.toBeNull();
  expect(wake.recap.forDay).toBe(2);
});
