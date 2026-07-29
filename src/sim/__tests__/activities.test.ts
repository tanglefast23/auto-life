import { startTimedActivity, progressTimedActivity, napEligibility, crossedWakeBoundary, restoreActiveTimedActivity, sleepContribution, type ActiveTimedActivity } from '../activities';
import { applyBarContributions } from '../bar-deltas';
import { passiveContribution } from '../rates';
import { toFixed } from '../fixed';
import { activityById, content } from '../content';
import type { Bars } from '../types';

const rates = content.rates;
const bars = (e: number, n: number, m: number, h: number): Bars =>
  ({ energy: toFixed(e), nutrition: toFixed(n), movement: toFixed(m), hygiene: toFixed(h) });

const runTicks = (a: ActiveTimedActivity, ticks: number) => {
  let active: ActiveTimedActivity | null = a;
  const totals: Partial<Record<string, number>> = {};
  for (let t = 0; t < ticks; t++) {
    if (!active) throw new Error('activity ended early');
    const r = progressTimedActivity(active);
    for (const [bar, d] of Object.entries(r.contribution.deltas)) totals[bar] = (totals[bar] ?? 0) + (d as number);
    active = r.next;
  }
  return { active, totals };
};

test('duration = ceil(baseMin / mSpeed), sampled once at start', () => {
  expect(startTimedActivity(activityById('shower'), bars(100, 50, 50, 50), rates).durationTicks).toBe(14);
  expect(startTimedActivity(activityById('shower'), bars(0, 50, 50, 50), rates).durationTicks).toBe(40);
});

test('non-timed kinds are rejected by the timed starter', () => {
  for (const id of ['sleep', 'idle', 'practice']) {
    expect(() => startTimedActivity(activityById(id), bars(100, 50, 50, 50), rates)).toThrow(id);
  }
});

test('Meal at Energy 100: 20 ticks, first 8 grant nothing, final 12 grant exactly +35', () => {
  const a = startTimedActivity(activityById('meal'), bars(100, 50, 50, 50), rates);
  expect(a.durationTicks).toBe(20);
  expect(a.fillStartTick).toBe(8);
  const prep = runTicks(a, 8);
  expect(prep.totals.nutrition ?? 0).toBe(0);
  const rest = runTicks(prep.active!, 12);
  expect(rest.totals.nutrition).toBe(toFixed(35));
  expect(rest.active).toBeNull();
});

test('stopping Weights halfway: exactly +25 Movement and −2.5 Nutrition already accrued', () => {
  const a = startTimedActivity(activityById('weights'), bars(100, 50, 50, 50), rates); // 40 ticks
  const half = runTicks(a, 20);
  expect(half.totals.movement).toBe(toFixed(25));
  expect(half.totals.nutrition).toBe(toFixed(-2.5));
});

test('stopping one tick before completion cannot dodge the proportional cross-cost', () => {
  const a = startTimedActivity(activityById('weights'), bars(100, 50, 50, 50), rates);
  const almost = runTicks(a, 39);
  const cost = almost.totals.nutrition!;
  expect(cost).toBeLessThanOrEqual(toFixed(-2.5) * 1.9); // ~39/40 of −5 already paid
  expect(cost).toBeGreaterThanOrEqual(toFixed(-5));
});

test('Well-fed boosts only the positive workout output, sampled at start', () => {
  const fed = startTimedActivity(activityById('weights'), bars(100, 70, 50, 50), rates);
  expect(fed.effectTotalsFixed.movement).toBe(toFixed(55)); // 50 × 1.10
  expect(fed.effectTotalsFixed.nutrition).toBe(toFixed(-5)); // cost unchanged

  const under = bars(100, 70, 50, 50);
  under.nutrition -= 1; // one fixed unit below threshold
  const unfed = startTimedActivity(activityById('weights'), under, rates);
  expect(unfed.effectTotalsFixed.movement).toBe(toFixed(50));
  expect(unfed.sampled.wellFed).toBe(false);
});

test('input bars are never mutated by start', () => {
  const b = bars(100, 70, 50, 50);
  startTimedActivity(activityById('weights'), b, rates);
  expect(b).toEqual(bars(100, 70, 50, 50));
});

test('JSON round-trip halfway through a Meal completes identically', () => {
  const a = startTimedActivity(activityById('meal'), bars(100, 50, 50, 50), rates);
  const straight = runTicks(a, 20);

  const b = startTimedActivity(activityById('meal'), bars(100, 50, 50, 50), rates);
  const firstHalf = runTicks(b, 10);
  const revived = JSON.parse(JSON.stringify(firstHalf.active)) as ActiveTimedActivity;
  const secondHalf = runTicks(revived, 10);
  expect((firstHalf.totals.nutrition ?? 0) + (secondHalf.totals.nutrition ?? 0)).toBe(straight.totals.nutrition);
  expect(secondHalf.active).toBeNull();
});

test('progressing a copy never changes the original DTO', () => {
  const a = startTimedActivity(activityById('meal'), bars(100, 50, 50, 50), rates);
  const frozen = JSON.stringify(a);
  progressTimedActivity(a);
  expect(JSON.stringify(a)).toBe(frozen);
});

test('composed tick: Meal fill + passive decay commit once through the reducer', () => {
  const start = bars(100, 50, 50, 50);
  const a = startTimedActivity(activityById('meal'), start, rates);
  // Jump to the first fill tick (tick 9 overall; fillIndex 1 of 12 → floor(35*6000/12)=17500).
  let active: ActiveTimedActivity | null = a;
  for (let t = 0; t < 8; t++) active = progressTimedActivity(active!).next;
  const r = progressTimedActivity(active!);
  const after = applyBarContributions(start, [r.contribution, passiveContribution('awake', rates)]);
  expect(after.nutrition).toBe(toFixed(50) + 17_500 - 400);
});

test('nap eligibility: the window bounds STARTABILITY, not just effectiveness (SPEC §6.2)', () => {
  const nap = activityById('nap');
  if (nap.kind !== 'timed') throw new Error('nap must be timed');
  const wake = 420;
  expect(napEligibility(nap, bars(49, 50, 50, 50), wake + 60, wake, 0)).toEqual({ canStart: true, effective: true });
  expect(napEligibility(nap, bars(50, 50, 50, 50), wake + 60, wake, 0).canStart).toBe(false); // energy gate
  expect(napEligibility(nap, bars(49, 50, 50, 50), wake + 59, wake, 0).canStart).toBe(false); // before window
  expect(napEligibility(nap, bars(49, 50, 50, 50), wake + 781, wake, 0).canStart).toBe(false); // after window
  expect(napEligibility(nap, bars(49, 50, 50, 50), wake - 30, wake, 0).canStart).toBe(false); // pre-wake
  const spent = napEligibility(nap, bars(49, 50, 50, 50), wake + 60, wake, 1);
  expect(spent).toEqual({ canStart: true, effective: false }); // budget spent: startable, flavor-only
});

test('the daily effective-use counter resets at the wake boundary, not midnight', () => {
  const wake = 420;
  const midnightBefore = 1439;
  const midnightAfter = 1441;
  expect(crossedWakeBoundary(midnightBefore, midnightAfter, wake)).toBe(false); // midnight is nothing
  expect(crossedWakeBoundary(1440 + 419, 1440 + 420, wake)).toBe(true); // Day-2 wake crossing
  expect(crossedWakeBoundary(1440 + 420, 1440 + 421, wake)).toBe(false); // already past it
  expect(crossedWakeBoundary(419, 419 + 1440, wake)).toBe(true); // a full day always crosses once
  expect(() => crossedWakeBoundary(10, 5, wake)).toThrow();
  expect(() => crossedWakeBoundary(0, 1, 1440)).toThrow(/wakeTarget/);
  expect(() => crossedWakeBoundary(0, 1, -1)).toThrow(/wakeTarget/);
});

test('activities with an effective-use budget refuse to start without an explicit decision', () => {
  const nap = activityById('nap');
  expect(() => startTimedActivity(nap, bars(40, 50, 50, 50), rates)).toThrow(/effectiveUse/);
});

test('durationTicks is exact integer ceil-division (the baseMin-17 float trap)', () => {
  const synthetic = {
    id: 'synthetic-17',
    kind: 'timed',
    object: 'bench',
    baseMin: 17,
    effects: { movement: 10 },
  } as const;
  // Energy exactly 18.00 → mSpeed 0.68; 17/0.68 = 25 exactly, but the float form
  // computed 25.000000000000004 → ceil 26 (round-2/3 math adversary: 106 of 79.2M cases, domain energyFixed 0..600000 x baseMin 1..132).
  const a = startTimedActivity(synthetic, bars(18, 50, 50, 50), rates);
  expect(a.durationTicks).toBe(25);
});

test('start rejects corrupt bars at the trust boundary', () => {
  const b = bars(100, 50, 50, 50);
  b.energy = NaN;
  expect(() => startTimedActivity(activityById('shower'), b, rates)).toThrow(/energy/);
});

test('napEligibility throws for window-less activities (caller-bug guard)', () => {
  const meal = activityById('meal');
  if (meal.kind !== 'timed') throw new Error('meal must be timed');
  expect(() => napEligibility(meal, bars(40, 50, 50, 50), 480, 420, 0)).toThrow(/budget-bearing/);
});

test('fillStartTick round-half-up is exact in integers (the 45×0.7 float trap)', () => {
  const synthetic = {
    id: 'synthetic-70',
    kind: 'timed',
    object: 'bench',
    baseMin: 45,
    effects: { movement: 10 },
    fillStartsAfterFraction: 0.7,
  } as const;
  // Energy 50 → mSpeed 1.0 → 45 ticks; 45 × 0.7 = 31.5 decimal → rounds UP to 32.
  const a = startTimedActivity(synthetic, bars(50, 50, 50, 50), rates);
  expect(a.durationTicks).toBe(45);
  expect(a.fillStartTick).toBe(32);
});

test('the ≥1-fill-tick clamp grants the full total even at extreme fractions', () => {
  const synthetic = {
    id: 'synthetic-clamp',
    kind: 'timed',
    object: 'bench',
    baseMin: 1,
    effects: { movement: 3 },
    fillStartsAfterFraction: 0.9,
  } as const;
  const a = startTimedActivity(synthetic, bars(0, 50, 50, 50), rates); // 2 ticks at mSpeed 0.5
  expect(a.fillStartTick).toBeLessThanOrEqual(a.durationTicks - 1);
  const done = runTicks(a, a.durationTicks);
  expect(done.totals.movement).toBe(toFixed(3));
  expect(done.active).toBeNull();
});

test('a corrupt persisted DTO is rejected on restore', () => {
  const a = startTimedActivity(activityById('meal'), bars(100, 50, 50, 50), rates);
  const good = JSON.parse(JSON.stringify(progressTimedActivity(a).next));
  expect(() => restoreActiveTimedActivity(good)).not.toThrow();
  expect(() => restoreActiveTimedActivity({ ...good, fillStartTick: 99 })).toThrow();
  expect(() => restoreActiveTimedActivity({ ...good, elapsedTicks: good.durationTicks })).toThrow();
  expect(() => restoreActiveTimedActivity({ ...good, effectTotalsFixed: { nutrition: 1.5 } })).toThrow();
});

test('first effective nap nets exactly +10 with passive Energy suppressed; others keep awake decay', () => {
  const nap = activityById('nap');
  const a = startTimedActivity(nap, bars(40, 50, 50, 50), rates, { effectiveUse: true });
  expect(a.suppressPassiveEnergy).toBe(true);
  expect(a.durationTicks).toBe(50); // ceil(45 / 0.9) at Energy 40
  let active: ActiveTimedActivity | null = a;
  let barsNow = bars(40, 50, 50, 50);
  while (active) {
    const r = progressTimedActivity(active);
    barsNow = applyBarContributions(barsNow, [r.contribution, passiveContribution('effectiveNap', rates)]);
    active = r.next;
  }
  expect(barsNow.energy).toBe(toFixed(50)); // +10 net, no passive Energy drain
  expect(barsNow.hygiene).toBe(toFixed(50) - 50 * 300); // awake decay continued
});

test('later naps are flavor-only: zero restore, ordinary awake decay', () => {
  const nap = activityById('nap');
  const a = startTimedActivity(nap, bars(40, 50, 50, 50), rates, { effectiveUse: false });
  expect(a.suppressPassiveEnergy).toBe(false);
  expect(a.effectTotalsFixed).toEqual({});
  const r = progressTimedActivity(a);
  const after = applyBarContributions(bars(40, 50, 50, 50), [r.contribution, passiveContribution('awake', rates)]);
  expect(after.energy).toBe(toFixed(40) - 500); // normal drain — no Energy-freeze exploit
});

test('sleep restore is +10/h exactly, never scaled', () => {
  expect(sleepContribution(rates).deltas).toEqual({ energy: 1000 });
});
