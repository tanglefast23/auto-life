import { forecast } from '../forecast';
import { step } from '../step';
import { newGameState, type SimState } from '../state';
import { restoreCommitment, CommitmentSchema } from '../commitments';
import { PrngStreams } from '../prng';
import { minuteOfDay } from '../clock';
import { content } from '../content';

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
