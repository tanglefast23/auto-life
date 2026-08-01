import { step } from '../../step';
import { newGameState, type SimState } from '../../state';
import { PrngStreams } from '../../prng';
import { content, type ContentRegistry } from '../../content';
import { toDisplay, toFixed } from '../../fixed';
import { healthDisplay } from '../../bars';
import { morningCheckMinute } from '../../clock';
import bands from '../../../../content/harness-bands.json';

/**
 * The balance harness (T16). Bands live in content/harness-bands.json — they verify
 * TUNING (which P4.5 may invalidate); unit tests keep hard-coded values because they
 * verify formulas. Figures were recorded travel-inclusive before asserting (Q6).
 */
const fresh = (seed: number): SimState => newGameState('baseline', content.rates, seed, content.perks);

test('fairness: unattended week holds every band', () => {
  let s = fresh(1234);
  const mc = morningCheckMinute('baseline', content.rates);
  let dayIndex = 1;
  let nutritionMin = 100;
  let nutritionMinMinute = -1;
  let travelToday = 0;
  const travelPerDay: number[] = [];
  const mcFailures: string[] = [];

  for (let t = 0; t < 7 * 1440; t++) {
    const r = step(s, [], content);
    s = r.next;
    if (r.snapshot.processed === 'travel') travelToday += 1; // arrival-inclusive (audit round 4)
    const n = toDisplay(s.bars.nutrition);
    if (n < nutritionMin) {
      nutritionMin = n;
      nutritionMinMinute = r.snapshot.minuteOfDay;
    }
    if (r.events.some((e) => e.type === 'wakeBoundary')) {
      travelPerDay.push(travelToday);
      travelToday = 0;
      dayIndex += 1;
    }
    if (r.snapshot.minuteOfDay === mc && dayIndex >= bands.morningCheck.fromDay) {
      for (const [bar, v] of Object.entries(r.snapshot.bars)) {
        if (v < bands.morningCheck.floor) mcFailures.push(`day ${dayIndex} ${bar}=${v} < ${bands.morningCheck.floor}`);
      }
    }
  }

  expect(mcFailures).toEqual([]);
  expect(s.events.urgentCount).toBeLessThanOrEqual(bands.urgentMax);
  expect(s.events.anchorsMissed).toBeLessThanOrEqual(bands.anchorsMissedMax);
  expect(nutritionMin).toBeGreaterThanOrEqual(bands.nutritionMinBand[0]!);
  expect(nutritionMin).toBeLessThanOrEqual(bands.nutritionMinBand[1]!);
  // The minimum occurs pre-breakfast (morning, before the wake block's meal completes).
  expect(nutritionMinMinute).toBeGreaterThanOrEqual(420);
  expect(nutritionMinMinute).toBeLessThanOrEqual(520);
  for (const travel of travelPerDay.slice(0, 7)) {
    expect(travel).toBeGreaterThanOrEqual(bands.travelMinutesPerDayBand[0]!);
    expect(travel).toBeLessThanOrEqual(bands.travelMinutesPerDayBand[1]!);
  }
});

/**
 * docs/08 §9.3's floor, as the falsifiable gate the derivation promised.
 *
 * The fixture is named rather than seed-rolled, because "an all-stats-4 career" tests
 * whatever perks the seed happens to deal. The worst legal character is specific: the
 * lowest legal stats, the Drive perk that adds nothing to the roll, the Approach perk whose
 * advantage misses the Hygiene activities, and the workout that costs Hygiene on top.
 *
 * At E[multiplier] 95.25% that character nets Nutrition +4.0/day, Hygiene −3.8 on treadmill
 * days and Movement −0.4. If this ever fails, the answer is to raise `statStartMin` to 5 and
 * re-derive §9.2's table — never to widen a band (SPEC §16.3).
 */
test('the worst legal starting character still survives an unattended week', () => {
  let s = fresh(1234);
  for (const id of Object.keys(s.stats) as (keyof typeof s.stats)[]) {
    s.stats[id] = { level: content.rates.roll.statStartMin, xp: 0 };
  }
  s.perks = ['creative', 'easygoing'];
  s.preferredWorkout = 'treadmill';

  const mc = morningCheckMinute('baseline', content.rates);
  let dayIndex = 1;
  const mcFailures: string[] = [];
  for (let t = 0; t < 7 * 1440; t++) {
    const r = step(s, [], content);
    s = r.next;
    if (r.events.some((e) => e.type === 'wakeBoundary')) dayIndex += 1;
    if (r.snapshot.minuteOfDay === mc && dayIndex >= bands.morningCheck.fromDay) {
      for (const [bar, v] of Object.entries(r.snapshot.bars)) {
        if (v < bands.morningCheck.floor) mcFailures.push(`day ${dayIndex} ${bar}=${v}`);
      }
    }
  }
  expect(mcFailures).toEqual([]);
  expect(s.events.urgentCount).toBe(0);
  expect(s.events.anchorsMissed).toBe(0);
});

test('routine Snacks maintain Nutrition without creating an urgent crisis', () => {
  let s = fresh(77);
  const completions: string[] = [];
  for (let t = 0; t < 7 * 1440; t++) {
    const r = step(s, [], content);
    s = r.next;
    for (const e of r.events) if (e.type === 'activityCompleted') completions.push(e.detail);
  }
  expect(completions.filter((c) => c === 'snack').length).toBeGreaterThan(0);
  expect(s.events.urgentCount).toBe(0);
});

test('without the workout anchor, routine Stretch keeps Movement out of collapse', () => {
  const noWorkout: ContentRegistry = { ...content, anchors: { anchors: content.anchors.anchors.filter((a) => a.id !== 'workout') } };
  let s = fresh(1);
  let minMovement = 100;
  for (let t = 0; t < bands.neglect.withinDays * 1440; t++) {
    s = step(s, [], noWorkout).next;
    minMovement = Math.min(minMovement, toDisplay(s.bars.movement));
  }
  expect(minMovement).toBeGreaterThan(50);
  expect(minMovement).toBeLessThan(70);
  expect(s.events.urgentCount).toBe(0); // Movement is never URGENT
});

test('recovery: from all bars 0, autopilot reads healthy at the Day-3 morning check', () => {
  let s = fresh(2);
  s.bars = { energy: 0, nutrition: 0, movement: 0, hygiene: 0 };
  const mc = morningCheckMinute('baseline', content.rates);
  let day = 1;
  let day3mc: number | null = null;
  for (let t = 0; t < 3 * 1440 && day3mc === null; t++) {
    const r = step(s, [], content);
    s = r.next;
    if (r.events.some((e) => e.type === 'wakeBoundary')) day += 1;
    if (day === 3 && r.snapshot.minuteOfDay === mc) day3mc = r.snapshot.health;
  }
  expect(day3mc).not.toBeNull();
  expect(day3mc!).toBeGreaterThanOrEqual(bands.recovery.healthFloorAtDay3MorningCheck);
});

test('meal cap-waste stays inside the band and dinner fires near-daily', () => {
  let s = fresh(1234);
  let wasted = 0;
  let dinners = 0;
  for (let t = 0; t < 7 * 1440; t++) {
    const before = s.bars.nutrition;
    const wasMeal = s.current?.type === 'activity' && s.current.dto.activityId === 'meal';
    const r = step(s, [], content);
    const completedMeal = r.events.some((e) => e.type === 'activityCompleted' && e.detail === 'meal');
    if (wasMeal && r.next.bars.nutrition === toFixed(100) && before > toFixed(96)) {
      // A fill tick clamped at the cap — counted at ANY meal (lunch included);
      // this is a coarse proxy, not the full §6.6 audit (P4 owns that).
      wasted += 1;
    }
    if (completedMeal && r.snapshot.minuteOfDay > 1000) dinners += 1;
    s = r.next;
  }
  expect(dinners).toBeGreaterThanOrEqual(bands.dinnersMinPerWeek);
  expect(wasted / 7).toBeLessThanOrEqual(bands.mealCapWastePerDayMax);
});
