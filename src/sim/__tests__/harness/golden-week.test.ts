import { step } from '../../step';
import { newGameState } from '../../state';
import { PrngStreams } from '../../prng';
import { content } from '../../content';
import { toDisplay } from '../../fixed';
import { morningCheckMinute } from '../../clock';
import { ENGINE_VERSION } from '../../version';

/**
 * The unattended golden replay (T15). Format (recorded in evidence/p2.md):
 * { engineVersion, seed, chronotype, commands: [], digest: per-day rows }.
 * A digest diff with an unchanged ENGINE_VERSION fails as a BUG, never a retune.
 */
interface DayDigest {
  morningCheck: Record<string, number> | null;
  minPerBar: Record<string, number>;
  maxPerBar: Record<string, number>;
  completions: Record<string, number>;
  travelMinutes: number;
  urgentEvents: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function runGoldenWeek() {
  let s = newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());
  const mc = morningCheckMinute('baseline', content.rates);
  const days: DayDigest[] = [];
  const freshDay = (): DayDigest => ({ morningCheck: null, minPerBar: { energy: 100, nutrition: 100, movement: 100, hygiene: 100 }, maxPerBar: { energy: 0, nutrition: 0, movement: 0, hygiene: 0 }, completions: {}, travelMinutes: 0, urgentEvents: 0 });
  let day: DayDigest = freshDay();
  let firstWakeOrder: string[] = [];
  let urgentCount = 0;

  for (let t = 0; t < 7 * 1440; t++) {
    const r = step(s, [], content);
    s = r.next;
    for (const e of r.events) {
      if (e.type === 'activityCompleted') {
        day.completions[e.detail] = (day.completions[e.detail] ?? 0) + 1;
        if (days.length === 0 && firstWakeOrder.length < 4) firstWakeOrder.push(e.detail);
      }
      if (e.type === 'urgent') day.urgentEvents += 1;
      if (e.type === 'wakeBoundary') {
        days.push(day);
        day = freshDay();
      }
    }
    // snapshot.processed sees the arrival tick and one-tick journeys; post-step
    // current dropped one tick per journey (audit round 4: 24 recorded vs 32 real).
    if (r.snapshot.processed === 'travel') day.travelMinutes += 1;
    for (const bar of ['energy', 'nutrition', 'movement', 'hygiene'] as const) {
      const v = toDisplay(s.bars[bar]);
      if (v < (day.minPerBar[bar] ?? 100)) day.minPerBar[bar] = round2(v);
      if (v > (day.maxPerBar[bar] ?? 0)) day.maxPerBar[bar] = round2(v);
    }
    if (r.snapshot.minuteOfDay === mc) {
      day.morningCheck = Object.fromEntries(Object.entries(r.snapshot.bars).map(([k, v]) => [k, round2(v)]));
    }
  }
  urgentCount = s.events.urgentCount;
  return { engineVersion: ENGINE_VERSION, seed: 1234, chronotype: 'baseline', commands: [], firstWakeOrder, urgentCount, anchorsMissed: s.events.anchorsMissed, days };
}

test('golden week: digest matches the recorded replay and the pinned ENGINE_VERSION', () => {
  const golden = runGoldenWeek();
  expect(golden.engineVersion).toBe(5);
  expect(golden.firstWakeOrder).toEqual(['toilet', 'brush', 'shower', 'meal']); // §7.1 Day-1 order
  expect(golden).toMatchSnapshot();
});
