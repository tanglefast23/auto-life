import { z } from 'zod';
import { mulberryNext } from './prng';
import { STAT_IDS, type StatsState } from './stats';
import { GAME_VERSION } from './version';
import type {
  GradesConfig,
  PerksConfig,
  RatesConfig,
  RollTag,
} from './content-schemas';

/**
 * The activity check (docs/08 §6).
 *
 * One `d20` against one global DC, banded onto a fifteen-grade ladder, each grade carrying
 * an integer percent multiplier. Everything here is a pure function of integers — no
 * transcendental math, no floats that reach a bar — because SPEC §16.2's golden replay
 * asserts exact one-day closure and a `Math.round` in the wrong place would move it.
 *
 * The single number the balance rests on: **at a stat of 5 with no perk offset the expected
 * multiplier is exactly 100.00%**, because the fifteen multipliers weighted by the reference
 * character's twenty equally-likely outcomes sum to exactly 2000. That is what lets SPEC
 * §6.8's whole daily budget table survive, and what lets the forecaster keep showing the
 * ungraded base without lying. `roll.test.ts` asserts the 2000, in integers.
 */

export type RollShape = 'plain' | 'advantage' | 'disadvantage';

/** One mulberry32 record, owned by `SimState` — see docs/08 §8.1 for why it lives there. */
export const RollStreamSchema = z.strictObject({
  state: z.number().int().min(0).max(0xffffffff),
  calls: z.number().int().min(0),
});
export type RollStream = z.infer<typeof RollStreamSchema>;

/** Continues `prng.ts`'s π-hex salt series, so the sixth record cannot collide with the five. */
export const ROLL_STREAM_SALT = 0x299f31d0;

export function newRollStream(rootSeed: number): RollStream {
  return { state: ((rootSeed >>> 0) ^ ROLL_STREAM_SALT) >>> 0, calls: 0 };
}

export interface DieDraw {
  value: number;
  stream: RollStream;
}

/** One d20. Integer-only: `floor(value × 20) + 1`, with the 1.0 edge clamped rather than wrapped. */
export function drawD20(stream: RollStream): DieDraw {
  const { state, value } = mulberryNext(stream.state);
  return {
    value: Math.min(20, Math.floor(value * 20) + 1),
    stream: { state, calls: stream.calls + 1 },
  };
}

export interface RollModifiers {
  /** Sum of perk `rollOffset` effects. Never negative — docs/08 §5.0. */
  offset: number;
  shape: RollShape;
  /** Integer percents to fold into the duration derivation, in authored order. */
  durationPercents: number[];
}

export const NO_MODIFIERS: RollModifiers = Object.freeze({
  offset: 0,
  shape: 'plain',
  durationPercents: Object.freeze([]) as unknown as number[],
});

/**
 * What a character's perks do to one activity.
 *
 * Shape does not stack: a character holds two perks from two families, and no shipped perk
 * pair tags the same activity on opposite sides. If a future pair ever does, advantage and
 * disadvantage cancel to plain — D&D's own rule, and the only answer that keeps
 * `E[advantage] + E[disadvantage] = 2 × E[plain]` meaningful.
 */
export function modifiersFor(
  perks: PerksConfig,
  perkIds: readonly string[],
  tags: readonly RollTag[],
): RollModifiers {
  let offset = 0;
  let advantage = false;
  let disadvantage = false;
  const durationPercents: number[] = [];
  const held = new Set(perkIds);
  for (const family of perks.families) {
    for (const option of family.options) {
      if (!held.has(option.id)) continue;
      for (const effect of option.effects) {
        switch (effect.kind) {
          case 'rollOffset':
            offset += effect.value;
            break;
          case 'rollShape':
            if (!tags.includes(effect.tag)) break;
            if (effect.shape === 'advantage') advantage = true;
            else disadvantage = true;
            break;
          case 'durationFactor':
            if (effect.tag !== undefined && !tags.includes(effect.tag)) break;
            durationPercents.push(effect.percent);
            break;
        }
      }
    }
  }
  const shape: RollShape =
    advantage && disadvantage ? 'plain' : advantage ? 'advantage' : disadvantage ? 'disadvantage' : 'plain';
  return { offset, shape, durationPercents };
}

export interface GradeOutcome {
  gradeId: string;
  band: 'high' | 'mid' | 'low';
  multiplier100: number;
  index: number;
}

/** The ladder is authored best-first, so the first entry the margin clears is the answer. */
export function gradeIndexForMargin(grades: GradesConfig, margin: number): number {
  for (let i = 0; i < grades.grades.length; i += 1) {
    if (margin >= grades.grades[i]!.minMargin) return i;
  }
  // Unreachable: the schema refines the last entry to catch every margin.
  return grades.grades.length - 1;
}

export function gradeAt(grades: GradesConfig, index: number): GradeOutcome {
  const clamped = Math.max(0, Math.min(grades.grades.length - 1, index));
  const g = grades.grades[clamped]!;
  return { gradeId: g.id, band: g.band, multiplier100: g.multiplier100, index: clamped };
}

/**
 * Margin → grade, then the crit/fumble step.
 *
 * A natural 20 moves one grade up and a natural 1 one grade down, both clamping. It is
 * deliberately *not* "a natural 20 always scores an A": that would let a novice hit top
 * marks 5% of the time and throw away the property this whole system is copied from —
 * that mastery buys a floor. At par the rule is provably a no-op, because a 20 already
 * lands A+ and a 1 already lands F−, which is why it costs SPEC §6.8's budgets nothing.
 */
export function resolveGrade(
  grades: GradesConfig,
  natural: number,
  modifier: number,
  dc: number,
): GradeOutcome {
  const margin = natural + modifier - dc;
  let index = gradeIndexForMargin(grades, margin);
  if (natural === 20) index -= 1; // one better; index 0 is the best grade
  else if (natural === 1) index += 1;
  return gradeAt(grades, index);
}

export interface ResolvedRoll {
  /** The kept die — what the player sees tumble. */
  natural: number;
  shape: RollShape;
  /** statMod + perk offset, as shown on the banner. */
  modifier: number;
  gradeId: string;
  band: 'high' | 'mid' | 'low';
  multiplier100: number;
}

export interface RollInput {
  statLevel: number;
  modifiers: RollModifiers;
  grades: GradesConfig;
  rates: RatesConfig;
}

/** Draw and resolve in one place, so the draw count per start is auditable at one call site. */
export function rollActivity(
  stream: RollStream,
  input: RollInput,
): { roll: ResolvedRoll; stream: RollStream } {
  const first = drawD20(stream);
  let natural = first.value;
  let next = first.stream;
  if (input.modifiers.shape !== 'plain') {
    const second = drawD20(next);
    next = second.stream;
    natural =
      input.modifiers.shape === 'advantage'
        ? Math.max(natural, second.value)
        : Math.min(natural, second.value);
  }
  const modifier = statModifier(input.statLevel, input.rates) + input.modifiers.offset;
  const grade = resolveGrade(input.grades, natural, modifier, input.rates.roll.dc);
  return {
    roll: {
      natural,
      shape: input.modifiers.shape,
      modifier,
      gradeId: grade.gradeId,
      band: grade.band,
      multiplier100: grade.multiplier100,
    },
    stream: next,
  };
}

export function statModifier(statLevel: number, rates: RatesConfig): number {
  return statLevel - rates.roll.statParLevel;
}

/**
 * The graded total, and the signed delta that carries it to the bar at completion.
 *
 * Round-half-up in integers — the same form `fillStartTick`'s `frac100` uses, and for the
 * same reason: a float here would drift the golden replay's exact one-day closure.
 */
export function gradedTotalFixed(totalFixed: number, multiplier100: number): number {
  if (!Number.isSafeInteger(totalFixed)) throw new Error('graded totals must be safe integers');
  if (totalFixed < 0) {
    // docs/08 §6.4: only positive outputs are graded. A negative here means a cross-effect
    // leaked into the graded path, which would punish twice for one bad roll.
    throw new Error('only positive outputs are graded');
  }
  return Math.floor((totalFixed * multiplier100 + 50) / 100);
}

export function gradeDeltaFixed(totalFixed: number, multiplier100: number): number {
  return gradedTotalFixed(totalFixed, multiplier100) - totalFixed;
}

/** A uniform index draw, for the creation rolls below. */
function drawIndex(stream: RollStream, length: number): DieDraw {
  if (length <= 0) throw new Error('cannot draw from an empty list');
  const { state, value } = mulberryNext(stream.state);
  return {
    value: Math.min(length - 1, Math.floor(value * length)),
    stream: { state, calls: stream.calls + 1 },
  };
}

export interface RolledCharacter {
  rollStream: RollStream;
  stats: StatsState;
  perks: string[];
}

/**
 * Who this person turned out to be (docs/08 §4, §5).
 *
 * **Every stat is rolled, including the ones no shipped chapter uses yet.** A person has a
 * capacity for charm before the game contains anybody to charm — the world opens up around
 * a fixed roster, which is why `charisma` is a live number in a v1 save and v2 costs a
 * content edit rather than a migration.
 *
 * **Perks are drawn only for ACTIVE families**, because a perk is a rule that fires, and a
 * rule with nothing to fire on is the §6.7 decoration class. A family activates by raising
 * `GAME_VERSION`; existing careers pick theirs up through `extendCharacterPerks`.
 *
 * Draw order is fixed and **append-only**: stats in `STAT_IDS` order, then families in
 * authored order. Position is identity here — inserting a stat in the middle would silently
 * re-roll every existing career's other stats — so new entries go on the end, and a version
 * that activates one draws it from the career's LIVE stream rather than restarting from the
 * seed (§8.5).
 *
 * Stats start at 4…7 rather than 1…10. The floor is derived, not chosen: at a stat of 1 the
 * expected multiplier is 82.25%, which nets Nutrition −10/day against SPEC §6.8's +9 margin
 * — a spiral. At 4 it is 95.25% and every bar still closes or drifts inside a reactive net.
 */
export function rollNewCharacter(
  rootSeed: number,
  perks: PerksConfig,
  rates: RatesConfig,
  gameVersion: number = GAME_VERSION,
): RolledCharacter {
  let stream = newRollStream(rootSeed);
  const span = rates.roll.statStartMax - rates.roll.statStartMin + 1;
  const levels: Record<string, { level: number; xp: number }> = {};
  for (const id of STAT_IDS) {
    const draw = drawIndex(stream, span);
    stream = draw.stream;
    levels[id] = { level: rates.roll.statStartMin + draw.value, xp: 0 };
  }
  const extended = extendCharacterPerks(stream, perks, [], gameVersion);
  return {
    rollStream: extended.rollStream,
    stats: levels as unknown as StatsState,
    perks: extended.perks,
  };
}

/**
 * Give an existing character the perks a newly-activated family owes them.
 *
 * Drawn from the career's **live** stream, never from the root seed. Restarting from the
 * seed would re-derive the perks they already hold, and any change to the draw order above
 * it would rewrite a character mid-life — the one thing a trait must never do. Continuing
 * the stream means existing values are untouched by construction.
 *
 * The framing for the player is the same one v12's migration used: the trait was always
 * true, the game had not modelled it yet.
 */
export function extendCharacterPerks(
  stream: RollStream,
  perks: PerksConfig,
  held: readonly string[],
  gameVersion: number = GAME_VERSION,
): { rollStream: RollStream; perks: string[] } {
  let next = stream;
  const chosen = [...held];
  const heldSet = new Set(held);
  for (const family of perks.families) {
    if (family.since > gameVersion) continue;
    if (family.options.some((option) => heldSet.has(option.id))) continue;
    const draw = drawIndex(next, family.options.length);
    next = draw.stream;
    chosen.push(family.options[draw.value]!.id);
  }
  return { rollStream: next, perks: chosen };
}

/** The C entry — what the forecaster models for every future roll (docs/08 §8.3). */
export function neutralGrade(grades: GradesConfig): GradeOutcome {
  const index = grades.grades.findIndex((g) => g.multiplier100 === 100);
  if (index === -1) throw new Error('the grade ladder has no 100% entry to forecast with');
  return gradeAt(grades, index);
}
