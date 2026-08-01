import { z } from 'zod';
import { StatIdSchema, type RatesConfig, type StatId } from './content-schemas';

export type { StatId };

/**
 * Stat levels and the XP that moves them (docs/08 §7).
 *
 * XP is awarded for **doing**, never for succeeding — RimWorld's rule, and the one that
 * stops a lucky streak compounding into a permanently better character. It is also awarded
 * from the activity's authored `baseMin` rather than its perk-adjusted duration, or
 * Perfectionist would buy 15% faster growth on top of its better output.
 *
 * The daily cap is RimWorld's soft per-skill cap, reset at the wake boundary beside
 * `napEffectiveUsesToday`. Without it three meals a day would race Dexterity past every
 * other stat before the week was out.
 */

export const STAT_IDS = StatIdSchema.options;

export const StatRecordSchema = z.strictObject({
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
});
export type StatRecord = z.infer<typeof StatRecordSchema>;

/**
 * Both maps are **derived from the stat enum**, never restated.
 *
 * A hand-written `strictObject` with four keys was the drift waiting to happen: the moment
 * `charisma` joined the roster, `StatsState` and `StatXpToday` would each have had to be
 * remembered separately, and a strict parse would have failed at load rather than at build.
 * Deriving them means a future stat is one enum entry and nothing else.
 */
const perStat = <T extends z.ZodTypeAny>(value: T) =>
  z.strictObject(
    Object.fromEntries(STAT_IDS.map((id) => [id, value])) as Record<StatId, T>,
  );

export type StatsState = Record<StatId, StatRecord>;
export const StatsStateSchema: z.ZodType<StatsState> = perStat(StatRecordSchema);

export type StatXpToday = Record<StatId, number>;
export const StatXpTodaySchema: z.ZodType<StatXpToday> = perStat(
  z.number().int().min(0),
);

export function emptyStatXpToday(): StatXpToday {
  return Object.fromEntries(STAT_IDS.map((id) => [id, 0])) as StatXpToday;
}

/** Cost to advance from `level` to `level + 1`. Linear in the level, so late gains cost more. */
export function xpToAdvance(level: number, rates: RatesConfig): number {
  return rates.roll.xpPerLevelStep * level;
}

export interface XpAward {
  stats: StatsState;
  today: StatXpToday;
  /** The levels actually crossed this award — what the UI announces. */
  leveledTo: number | null;
}

/**
 * Award XP to one stat, honouring the daily cap and the level ceiling.
 *
 * At the ceiling XP is **discarded rather than banked**, so the save never carries a number
 * that means nothing — the same reason practice points are stored as the one integer the
 * thresholds read.
 */
export function awardStatXp(
  stats: StatsState,
  today: StatXpToday,
  stat: StatId,
  amount: number,
  rates: RatesConfig,
): XpAward {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('stat XP must be a non-negative integer');
  const spentToday = today[stat];
  const grantable = Math.max(0, Math.min(amount, rates.roll.xpDailyCap - spentToday));
  if (grantable === 0) return { stats, today, leveledTo: null };

  const record = stats[stat];
  const nextToday: StatXpToday = { ...today, [stat]: spentToday + grantable };
  if (record.level >= rates.roll.statMax) {
    // Ceiling: the cap still records the day's effort so the UI can show a full bar, but
    // no XP is banked toward a level that does not exist.
    return { stats, today: nextToday, leveledTo: null };
  }

  let level = record.level;
  let xp = record.xp + grantable;
  let leveled = false;
  while (level < rates.roll.statMax && xp >= xpToAdvance(level, rates)) {
    xp -= xpToAdvance(level, rates);
    level += 1;
    leveled = true;
  }
  if (level >= rates.roll.statMax) xp = 0;
  return {
    stats: { ...stats, [stat]: { level, xp } },
    today: nextToday,
    leveledTo: leveled ? level : null,
  };
}

/** Progress toward the next level, 0..1 — the slim bar in the character panel. */
export function levelProgress(record: StatRecord, rates: RatesConfig): number {
  if (record.level >= rates.roll.statMax) return 1;
  const need = xpToAdvance(record.level, rates);
  return need <= 0 ? 0 : Math.max(0, Math.min(1, record.xp / need));
}
