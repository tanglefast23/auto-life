import { content } from '../content';
import {
  gradeAt,
  gradeDeltaFixed,
  gradeIndexForMargin,
  modifiersFor,
  neutralGrade,
  newRollStream,
  resolveGrade,
  rollNewCharacter,
  statModifier,
} from '../roll';
import { awardStatXp, emptyStatXpToday, STAT_IDS, xpToAdvance } from '../stats';
import { activityDurationTicksAtCurrentSpeed } from '../activities';
import { newGameState } from '../state';
import { step } from '../step';
import { toFixed } from '../fixed';
import { GAME_VERSION } from '../version';
import { extendCharacterPerks } from '../roll';

/**
 * docs/08's assertions. The first four contain no simulation at all — they are properties
 * of fifteen integers, and the balance of the whole game rests on them.
 */

const DC = content.rates.roll.dc;

/** Every reference outcome: a par character rolls each face of the d20 once. */
const referenceMultipliers = (modifier: number): number[] =>
  Array.from({ length: 20 }, (_, i) => resolveGrade(content.grades, i + 1, modifier, DC).multiplier100);

// ---- assertion 1: E = 100.00% at par, as an integer identity ----

test('the reference ladder sums to exactly 2000, so E[multiplier] at par is exactly 100%', () => {
  const total = referenceMultipliers(0).reduce((a, b) => a + b, 0);
  expect(total).toBe(2000);
  expect(total / 20).toBe(100);
});

test('crit and fumble are a no-op at par, and only at par', () => {
  // A 20 already lands the best grade and a 1 the worst, so both adjustments clamp — which
  // is why the identity above survives a rule that is never switched off in play.
  expect(resolveGrade(content.grades, 20, 0, DC).gradeId).toBe(gradeAt(content.grades, 0).gradeId);
  expect(resolveGrade(content.grades, 1, 0, DC).gradeId).toBe(
    gradeAt(content.grades, content.grades.grades.length - 1).gradeId,
  );
  // One step off par it bites: at +1 a natural 1 is F+ by margin and F after the fumble.
  const byMargin = gradeAt(content.grades, gradeIndexForMargin(content.grades, 1 + 1 - DC));
  expect(resolveGrade(content.grades, 1, 1, DC).multiplier100).toBeLessThan(byMargin.multiplier100);
});

test('the par distribution is the intended report card: A 15 / B 20 / C 30 / D 20 / F 15', () => {
  const counts = { high: 0, mid: 0, low: 0 };
  const letters: Record<string, number> = {};
  for (let natural = 1; natural <= 20; natural += 1) {
    const grade = resolveGrade(content.grades, natural, 0, DC);
    counts[grade.band] += 5;
    const letter = grade.gradeId[0]!;
    letters[letter] = (letters[letter] ?? 0) + 5;
  }
  expect(letters).toEqual({ a: 15, b: 20, c: 30, d: 20, f: 15 });
  // Bands: high covers A and B, mid covers C, low covers D and F.
  expect(counts).toEqual({ high: 35, mid: 30, low: 35 });
});

// ---- assertion 2: advantage and disadvantage are exactly symmetric ----

test('E[advantage] + E[disadvantage] === 2 x E[plain], at every stat and offset', () => {
  // Exact over the full 400-outcome distribution, not sampled: for any pair (a, b),
  // mult(max) + mult(min) === mult(a) + mult(b), so the identity is structural.
  for (let level = 1; level <= content.rates.roll.statMax; level += 1) {
    for (let offset = 0; offset <= 5; offset += 1) {
      const modifier = statModifier(level, content.rates) + offset;
      const mults = referenceMultipliers(modifier);
      let advantage = 0;
      let disadvantage = 0;
      for (let a = 1; a <= 20; a += 1) {
        for (let b = 1; b <= 20; b += 1) {
          advantage += mults[Math.max(a, b) - 1]!;
          disadvantage += mults[Math.min(a, b) - 1]!;
        }
      }
      const plain = mults.reduce((x, y) => x + y, 0);
      expect(advantage + disadvantage).toBe(2 * 20 * plain);
    }
  }
});

test('advantage is worth 13.875 points at par, and disadvantage exactly its mirror', () => {
  const mults = referenceMultipliers(0);
  let advantage = 0;
  let disadvantage = 0;
  for (let a = 1; a <= 20; a += 1) {
    for (let b = 1; b <= 20; b += 1) {
      advantage += mults[Math.max(a, b) - 1]!;
      disadvantage += mults[Math.min(a, b) - 1]!;
    }
  }
  expect(advantage / 400).toBeCloseTo(113.875, 6);
  expect(disadvantage / 400).toBeCloseTo(86.125, 6);
});

test('the published E[multiplier] curve is what the ladder actually produces', () => {
  // docs/08 §9.2. These include the crit/fumble rule, which the audited first draft omitted.
  const expected: Record<number, number> = {
    1: 82.25,
    4: 95.25,
    5: 100.0,
    6: 104.5,
    7: 109.25,
    10: 120.25,
  };
  for (const [level, e] of Object.entries(expected)) {
    const mods = referenceMultipliers(statModifier(Number(level), content.rates));
    expect(mods.reduce((a, b) => a + b, 0) / 20).toBeCloseTo(e, 6);
  }
});

// ---- assertion 3: the ladder is contiguous and exhaustive ----

test('reference rolls 1..20 map onto exactly one grade each, with no gap and no overlap', () => {
  const seen = new Map<string, number[]>();
  for (let natural = 1; natural <= 20; natural += 1) {
    const grade = resolveGrade(content.grades, natural, 0, DC);
    seen.set(grade.gradeId, [...(seen.get(grade.gradeId) ?? []), natural]);
  }
  // Every authored grade is reachable by the reference character — an unreachable entry is
  // a fifteenth tier of nothing, and the ladder is only worth fifteen tiers if all fifteen
  // can happen to an ordinary person.
  expect(seen.size).toBe(content.grades.grades.length);
  expect([...seen.values()].flat().sort((a, b) => a - b)).toEqual(
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
});

// ---- assertion 4: nothing ships dormant (the rest is a content-registry gate) ----

test('every LIVE stat governs a graded activity, and every future one governs none', () => {
  // The roster is whole-game (docs/08 §4): a character carries stats for chapters that do
  // not exist yet. `since` is what keeps that from being the dormant-mechanic failure —
  // live means live, future means genuinely inert, and both halves are checked.
  const graded = content.activities.activities.filter((a) => a.graded === true);
  expect(graded.length).toBeGreaterThan(0);
  for (const activity of graded) expect(activity.stat).toBeDefined();
  for (const stat of content.stats.stats) {
    const governs = graded.some((a) => a.stat === stat.id);
    expect(governs).toBe(stat.since <= GAME_VERSION);
    if (stat.since > GAME_VERSION) expect(stat.activatedBy).toBeDefined();
  }
  // And the enum and the content file cannot drift apart.
  expect(content.stats.stats.map((stat) => stat.id).sort()).toEqual([...STAT_IDS].sort());
});

test('a future perk family is declared, inert, and points at the doc that turns it on', () => {
  const future = content.perks.families.filter((family) => family.since > GAME_VERSION);
  expect(future.length).toBeGreaterThan(0); // the roadmap is represented, not deferred to memory
  const gradedTags = new Set(
    content.activities.activities
      .filter((a) => a.graded === true)
      .flatMap((a) => a.rollTags ?? []),
  );
  for (const family of future) {
    expect(family.activatedBy).toBeDefined();
    for (const option of family.options) {
      for (const effect of option.effects) {
        const tag = effect.kind === 'rollShape' ? effect.tag : effect.kind === 'durationFactor' ? effect.tag : undefined;
        if (tag !== undefined) expect(gradedTags.has(tag)).toBe(false);
      }
    }
  }
});

test('no shipped perk lowers a bar output', () => {
  // docs/08 §5.0 — SPEC §6.8's margins are 2-8% of daily restore and a shape effect is
  // worth 13.9%, so a penalty on an output cannot be absorbed by any bar in the game.
  for (const family of content.perks.families) {
    for (const option of family.options) {
      for (const effect of option.effects) {
        if (effect.kind === 'rollOffset') expect(effect.value).toBeGreaterThanOrEqual(0);
        if (effect.kind === 'rollShape') expect(effect.shape).toBe('advantage');
      }
    }
  }
});

// ---- the integer arithmetic that reaches a bar ----

test('the grade delta is round-half-up in integers, and zero at grade C', () => {
  const neutral = neutralGrade(content.grades);
  expect(gradeDeltaFixed(toFixed(35), neutral.multiplier100)).toBe(0);
  // 35 x 6000 = 210000; at 150% that is 315000, so the delta is exactly +105000 (= +17.5).
  expect(gradeDeltaFixed(toFixed(35), 150)).toBe(105_000);
  // 45% of 210000 is 94500, so an F- takes back 115500 (= -19.25) of the fill it already got.
  expect(gradeDeltaFixed(toFixed(35), 45)).toBe(-115_500);
  // Round-half-up on an odd total: 7 x 6000 = 42000; 42000 x 95 / 100 = 39900 exactly.
  expect(gradeDeltaFixed(toFixed(7), 95)).toBe(-2_100);
});

test('a graded completion can never leave a bar below where the activity started it', () => {
  // The worst multiplier is 45%, so fill + delta is always a positive fraction of the base.
  for (const grade of content.grades.grades) {
    const fill = toFixed(40);
    expect(fill + gradeDeltaFixed(fill, grade.multiplier100)).toBeGreaterThan(0);
  }
});

// ---- perks ----

test('a perk shape fires only on its tags, and its duration factor with it', () => {
  const onTag = modifiersFor(content.perks, ['creative'], ['expressive']);
  expect(onTag.shape).toBe('advantage');
  expect(onTag.durationPercents).toEqual([115]);

  const offTag = modifiersFor(content.perks, ['creative'], ['routine']);
  expect(offTag.shape).toBe('plain');
  expect(offTag.durationPercents).toEqual([]);
});

test('a global duration factor applies everywhere, and offsets sum', () => {
  const mods = modifiersFor(content.perks, ['perfectionist', 'easygoing'], []);
  expect(mods.offset).toBe(2);
  expect([...mods.durationPercents].sort((a, b) => a - b)).toEqual([85, 115]);
});

test('duration factors fold into one ceiling rather than stacking two', () => {
  const bars = { energy: toFixed(50), nutrition: toFixed(50), movement: toFixed(50), hygiene: toFixed(50) };
  const meal = content.activities.activities.find((a) => a.id === 'meal')!;
  const plain = activityDurationTicksAtCurrentSpeed(meal, bars)!;
  const slow = activityDurationTicksAtCurrentSpeed(meal, bars, [115, 115])!;
  const fast = activityDurationTicksAtCurrentSpeed(meal, bars, [85])!;
  expect(slow).toBeGreaterThan(plain);
  expect(fast).toBeLessThan(plain);
  // One ceiling at the end: applying 115 twice in sequence would round twice and drift.
  expect(slow).toBe(
    Math.ceil((meal.kind === 'timed' ? meal.baseMin : 0) * 1.15 * 1.15 * 600_000 / (300_000 + bars.energy)),
  );
});

// ---- creation and growth ----

test('one seed always produces the same character', () => {
  const a = rollNewCharacter(1234, content.perks, content.rates);
  const b = rollNewCharacter(1234, content.perks, content.rates);
  expect(a).toEqual(b);
  // This is what lets a migrated career get precisely what a fresh one would have rolled.
  expect(rollNewCharacter(5678, content.perks, content.rates)).not.toEqual(a);
});

test('starting stats land inside the derived 4..7 floor, and one perk comes from each live family', () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const c = rollNewCharacter(seed, content.perks, content.rates);
    for (const id of STAT_IDS) {
      expect(c.stats[id].level).toBeGreaterThanOrEqual(content.rates.roll.statStartMin);
      expect(c.stats[id].level).toBeLessThanOrEqual(content.rates.roll.statStartMax);
      expect(c.stats[id].xp).toBe(0);
    }
    // One per ACTIVE family — a perk is a rule that fires, and a family whose chapter has
    // not shipped has nothing to fire on.
    const liveFamilies = content.perks.families.filter((f) => f.since <= GAME_VERSION);
    expect(c.perks).toHaveLength(liveFamilies.length);
    expect(new Set(c.perks).size).toBe(c.perks.length);
  }
});

test('XP honours the daily cap, and stops banking at the ceiling', () => {
  const rates = content.rates;
  let stats = rollNewCharacter(1, content.perks, rates).stats;
  stats = { ...stats, strength: { level: 5, xp: 0 } };
  let today = emptyStatXpToday();

  // Well past the cap in one award: only the cap's worth is granted.
  const first = awardStatXp(stats, today, 'strength', 500, rates);
  expect(first.today.strength).toBe(rates.roll.xpDailyCap);
  expect(first.stats.strength.xp).toBe(rates.roll.xpDailyCap);
  // A second award the same day grants nothing at all.
  const second = awardStatXp(first.stats, first.today, 'strength', 60, rates);
  expect(second.stats.strength.xp).toBe(first.stats.strength.xp);

  // Enough days to cross: 5 -> 6 costs 500.
  stats = { ...stats, strength: { level: 5, xp: xpToAdvance(5, rates) - 10 } };
  today = emptyStatXpToday();
  const levelled = awardStatXp(stats, today, 'strength', 10, rates);
  expect(levelled.leveledTo).toBe(6);
  expect(levelled.stats.strength.xp).toBe(0);

  // At the ceiling XP is discarded rather than banked.
  const capped = awardStatXp(
    { ...stats, strength: { level: rates.roll.statMax, xp: 0 } },
    emptyStatXpToday(),
    'strength',
    60,
    rates,
  );
  expect(capped.stats.strength.xp).toBe(0);
  expect(capped.stats.strength.level).toBe(rates.roll.statMax);
});

// ---- assertions 6-9: the engine ----

test('stopping a graded activity forfeits its grade and its XP', () => {
  let s = newGameState('baseline', content.rates, 1234, content.perks);
  s.perks = [];
  s.clock.absoluteMinute = 420 + 200;
  s.position = { x: 4, y: 2 };
  s.queue = [
    {
      id: 'sh',
      activityId: 'shower',
      owner: 'PINNED',
      urgent: false,
      source: 'player',
      enqueuedTick: s.clock.absoluteMinute,
    },
  ];
  // Run until the shower is genuinely under way, then stop it before it can complete.
  for (let t = 0; t < 40 && s.current?.type !== 'activity'; t += 1) s = step(s, [], content).next;
  expect(s.current?.type).toBe('activity');
  const vitalityBefore = s.stats.vitality.xp;

  const stopped = step(s, [{ type: 'stopCurrent' }], content);
  expect(stopped.next.pendingInstantDeltas.filter((d) => d.source.startsWith('grade:'))).toEqual([]);
  expect(stopped.next.stats.vitality.xp).toBe(vitalityBefore);
  expect(stopped.events.some((e) => e.type === 'activityGraded')).toBe(false);
});

test('the roll survives a save and reload mid-activity', () => {
  let s = newGameState('baseline', content.rates, 99, content.perks);
  for (let t = 0; t < 300 && !(s.current?.type === 'activity' && s.current.dto.sampled.roll); t += 1) {
    s = step(s, [], content).next;
  }
  const roll = s.current?.type === 'activity' ? s.current.dto.sampled.roll : undefined;
  expect(roll).toBeDefined();
  const reloaded = JSON.parse(JSON.stringify(s)) as typeof s;
  expect(reloaded.current?.type === 'activity' ? reloaded.current.dto.sampled.roll : null).toEqual(roll);
});

test('two runs from one seed produce an identical grade sequence', () => {
  const grades = (seed: number) => {
    let s = newGameState('baseline', content.rates, seed, content.perks);
    const out: string[] = [];
    for (let t = 0; t < 2000; t += 1) {
      const r = step(s, [], content);
      s = r.next;
      for (const e of r.events) if (e.type === 'activityGraded') out.push(e.detail);
    }
    return out;
  };
  const a = grades(4321);
  expect(a.length).toBeGreaterThan(5);
  expect(grades(4321)).toEqual(a);
});

test('a forecast draws no checks: the roll stream is left exactly where it was', () => {
  let s = newGameState('baseline', content.rates, 1234, content.perks);
  for (let t = 0; t < 100; t += 1) s = step(s, [], content).next;
  const before = { ...s.rollStream };
  for (let t = 0; t < 300; t += 1) s = step(s, [], content, undefined, { forecast: true }).next;
  expect(s.rollStream).toEqual(before);
});

test('the roll stream is its own record, seeded from the career root seed', () => {
  const s = newGameState('baseline', content.rates, 777, content.perks);
  const seeded = newRollStream(777);
  // The character draws advance it, so the state moves — but the number of draws is exactly
  // four stats plus one per perk family, and nothing else has touched it yet.
  expect(s.rollStream.calls).toBe(
    STAT_IDS.length + content.perks.families.filter((f) => f.since <= GAME_VERSION).length,
  );
  expect(s.rollStream.state).not.toBe(seeded.state);
});


// ---- the roster is whole-game, and grows without rewriting anyone ----

test('activating a family gives an existing character its perk without touching the ones they have', () => {
  // The append-only rule (docs/08 §8.5). Drawn from the career's LIVE stream, never from the
  // root seed: restarting would re-derive what they already hold, and any change to the draw
  // order above it would rewrite a character mid-life.
  const before = rollNewCharacter(1234, content.perks, content.rates, 1);
  const after = extendCharacterPerks(before.rollStream, content.perks, before.perks, 3);

  expect(after.perks.slice(0, before.perks.length)).toEqual(before.perks);
  const liveAt3 = content.perks.families.filter((f) => f.since <= 3);
  expect(after.perks).toHaveLength(liveAt3.length);
  for (const family of liveAt3) {
    expect(family.options.some((option) => after.perks.includes(option.id))).toBe(true);
  }
  // The stream moved forward rather than restarting, so nothing already drawn is re-drawn.
  expect(after.rollStream.calls).toBeGreaterThan(before.rollStream.calls);
});

test('a second activation is idempotent — nobody gets two perks from one family', () => {
  const base = rollNewCharacter(99, content.perks, content.rates, 1);
  const once = extendCharacterPerks(base.rollStream, content.perks, base.perks, 4);
  const twice = extendCharacterPerks(once.rollStream, content.perks, once.perks, 4);
  expect(twice.perks).toEqual(once.perks);
  expect(twice.rollStream).toEqual(once.rollStream);
});
