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
const fresh = (seed: number): SimState => newGameState('baseline', content.rates, seed, PrngStreams.create(seed).serialize());

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
    if (s.current?.type === 'travel') travelToday += 1;
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

test('the reactive snack never fires in an unattended week', () => {
  let s = fresh(77);
  const completions: string[] = [];
  for (let t = 0; t < 7 * 1440; t++) {
    const r = step(s, [], content);
    s = r.next;
    for (const e of r.events) if (e.type === 'activityCompleted') completions.push(e.detail);
  }
  expect(completions.filter((c) => c === 'snack')).toEqual([]);
});

test('neglect: with the workout anchor disabled, Movement falls below the band within 3 days (and the stretch net floors it — never a collapse)', () => {
  const noWorkout: ContentRegistry = { ...content, anchors: { anchors: content.anchors.anchors.filter((a) => a.id !== 'workout') } };
  let s = fresh(1);
  let minMovement = 100;
  for (let t = 0; t < bands.neglect.withinDays * 1440; t++) {
    s = step(s, [], noWorkout).next;
    minMovement = Math.min(minMovement, toDisplay(s.bars.movement));
  }
  expect(minMovement).toBeLessThan(bands.neglect.movementBelow);
  expect(minMovement).toBeGreaterThan(10); // the net holds — fail-soft, not free-fall
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
