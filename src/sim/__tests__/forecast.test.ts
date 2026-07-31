import { forecast } from '../forecast';
import { step } from '../step';
import { newGameState, type SimState } from '../state';
import { restoreCommitment, CommitmentSchema } from '../commitments';
import { PrngStreams } from '../prng';
import { dayNumber, minuteOfDay } from '../clock';
import { content, objectForActivity } from '../content';
import { toFixed } from '../fixed';

const fresh = (): SimState => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

test('forecast agreement: predicted starts match what step() actually produces, tick for tick', () => {
  const f = forecast(fresh(), content);
  let sim = fresh();
  const actualStarts: Array<{ activityId: string; minute: number }> = [];
  let prevCard: string | null = null;
  for (let t = 0; t < f.horizonTicks; t++) {
    // A start that happens THIS tick happens at the minute about to run —
    // snapshot.minuteOfDay is post-advance and would be one late.
    const tickMinute = minuteOfDay(sim.clock.absoluteMinute);
    const r = step(sim, [], content);
    sim = r.next;
    const cur = sim.current;
    const curCard = cur && (cur.type === 'activity' || cur.type === 'sleep') ? (cur.type === 'activity' ? cur.cardId : cur.cardId) : null;
    if (curCard && curCard !== prevCard) {
      actualStarts.push({ activityId: cur!.type === 'activity' ? cur!.dto.activityId : 'sleep', minute: tickMinute });
      prevCard = curCard;
    } else if (curCard === null) {
      prevCard = null;
    }
  }
  expect(f.starts.map((s) => ({ activityId: s.activityId, minute: s.predictedStartMinute }))).toEqual(actualStarts);
});

test('near bedtime the horizon shortens to the next wake, not 12 hours', () => {
  const s = fresh();
  s.clock.absoluteMinute = 420 + 960; // 23:00 Day 1 — 480 min to the 07:00 wake
  const f = forecast(s, content);
  expect(f.horizonTicks).toBe(480);
});

test('a forecast never advances the live PRNG streams or mutates the input state', () => {
  const before = fresh();
  const frozen = JSON.stringify(before);
  forecast(before, content);
  expect(JSON.stringify(before)).toBe(frozen);
});

test('the horizon is the sooner of next wake or 12 hours', () => {
  const f = forecast(fresh(), content);
  expect(f.horizonTicks).toBeLessThanOrEqual(720);
  expect(f.horizonTicks).toBeGreaterThan(0);
});

test('a healthy unattended day forecasts zero conflicts', () => {
  expect(forecast(fresh(), content).conflicts).toEqual([]);
});

test('commitments DTO validates and round-trips (materialization is v2)', () => {
  const c = restoreCommitment({
    ownerId: 'sim',
    targetStart: 9 * 1440 + 540,
    earliestStart: 9 * 1440 + 480,
    latestStart: 9 * 1440 + 600,
    duration: 480,
    location: 'street-corner',
    travelMinutes: 15,
    flexibility: 'fixed',
    source: 'work',
    status: 'booked',
  });
  expect(CommitmentSchema.parse(JSON.parse(JSON.stringify(c)))).toEqual(c);
  expect(() => restoreCommitment({ ...c, earliestStart: c.latestStart + 1 })).toThrow();
});

// ---- the day's counted-practice cap, made visible on the card (P7 playtest finding) ----

/**
 * Past `maxCountedSessionsPerDay`, `step()` scores a Practice with a factor of exactly 0.
 * Before this flag the card said nothing: the "Block" chip stopped appearing, which reads
 * the same as the day's *first* session, where block and scattered are both 1.0 and the
 * chip is correctly absent. A player queueing Practice all afternoon had no way to see
 * that everything after the fourth was free.
 */
const practiceForecast = (sessionsCountedToday: number) => {
  const s = fresh();
  const d = dayNumber(s.clock.absoluteMinute);
  for (const a of content.anchors.anchors) s.anchorsConsumedOnDay[a.id] = d;
  s.clock.absoluteMinute = 420 + 200;
  s.bars = {
    energy: toFixed(80),
    nutrition: toFixed(80),
    movement: toFixed(80),
    hygiene: toFixed(80),
  };
  const [x, y] = objectForActivity('practice').interactPoint;
  s.position = { x, y };
  s.practice.sessionsCountedToday = sessionsCountedToday;
  s.queue = [
    {
      id: 'p',
      activityId: 'practice',
      owner: 'PINNED',
      urgent: false,
      source: 'player',
      enqueuedTick: 0,
    },
  ];
  return forecast(s, content).annotations.find((a) => a.cardId === 'p');
};

test('a Practice inside the day’s counted cap is not flagged as uncounted', () => {
  const max = content.practice.maxCountedSessionsPerDay;
  for (const counted of [0, max - 1]) {
    expect(practiceForecast(counted)?.practiceUncounted).toBeUndefined();
  }
});

test('the first Practice past the cap is flagged, and the flag matches step()’s zero factor', () => {
  const max = content.practice.maxCountedSessionsPerDay;
  expect(practiceForecast(max)?.practiceUncounted).toBe(true);
  expect(practiceForecast(max + 3)?.practiceUncounted).toBe(true);

  // The curves stop at the cap, which is what makes the factor zero rather than small.
  expect(content.practice.blockCurve[max]).toBeUndefined();
  expect(content.practice.scatteredCurve[max]).toBeUndefined();
});

test('a non-Practice card is never flagged, whatever the practice counter says', () => {
  const s = fresh();
  s.practice.sessionsCountedToday = 99;
  for (const annotation of forecast(s, content).annotations) {
    expect(annotation.practiceUncounted).toBeUndefined();
  }
});
