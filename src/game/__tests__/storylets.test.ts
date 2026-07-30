import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import type { GameObservation } from '../session';
import { newSession } from '../session';
import { appendDailyStorylet } from '../storylets';

const midnight: GameObservation = {
  day: 2,
  absoluteMinute: 1440,
  minuteOfDay: 0,
  isMidnight: true,
  isMorningCheck: false,
  bars: {
    energy: 70_000,
    nutrition: 70_000,
    movement: 70_000,
    hygiene: 70_000,
  },
  currentActivityId: 'sleep',
  urgentCount: 0,
};

test('one storylets draw selects one line from multiple closing-day candidates', () => {
  const session = newSession();
  session.recap.wrinkleOutcomeId = 'package-delivery';
  session.recap.goalProgressIds = ['first-chord'];
  const before = PrngStreams.create(81).serialize();

  const result = appendDailyStorylet(
    session,
    before,
    [],
    midnight,
    content,
  );

  expect(result.session.journal.entries).toHaveLength(1);
  expect([
    'package-on-counter',
    'first-chord-note',
  ]).toContain(result.session.journal.entries[0]?.sourceId);
  expect(result.session.recap.journalEntryId).toBe(
    result.session.journal.entries[0]?.id,
  );
  expect(result.prng.streams.storylets.calls).toBe(
    before.streams.storylets.calls + 1,
  );
  expect(result.prng.streams.wrinkles).toEqual(
    before.streams.wrinkles,
  );
});

test('a closing day without a wrinkle or milestone uses the idle pool', () => {
  const result = appendDailyStorylet(
    newSession(),
    PrngStreams.create(82).serialize(),
    [],
    midnight,
    content,
  );
  expect(
    result.session.journal.entries[0]?.sourceKind,
  ).toBe('idle-moment');
});

test('reloading the completed boundary appends no duplicate and consumes no draw', () => {
  const before = PrngStreams.create(83).serialize();
  const first = appendDailyStorylet(
    newSession(),
    before,
    [],
    midnight,
    content,
  );
  const repeated = appendDailyStorylet(
    JSON.parse(JSON.stringify(first.session)),
    JSON.parse(JSON.stringify(first.prng)),
    [],
    midnight,
    content,
  );

  expect(repeated.changed).toBe(false);
  expect(repeated.session.journal.entries).toEqual(
    first.session.journal.entries,
  );
  expect(repeated.prng).toEqual(first.prng);
});
