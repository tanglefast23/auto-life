import { z } from 'zod';
import { ActiveTimedActivitySchema, type ActiveTimedActivity } from './activities';
import type { PrngSnapshot } from './prng';
import {
  QueueCardSchema,
  RemovalReceiptSchema,
  type QueueCard,
  type RemovalReceipt,
} from './queue';
import { ENGINE_VERSION } from './version';
import { initialAbsoluteMinute, initialBars } from './initial-state';
import type { PerksConfig, RatesConfig } from './content-schemas';
import { BarIdSchema } from './content-schemas';
import { RollStreamSchema, rollNewCharacter } from './roll';
import { StatsStateSchema, StatXpTodaySchema, emptyStatXpToday } from './stats';
import type { Bars, Chronotype } from './types';

/**
 * The serializable truth (master §4): no closures, no class instances, no Date,
 * no embedded content — activities are ids resolved against validated content.
 * Everything the forecaster clones and the save persists is exactly this shape.
 */
const BarsSchema = z.strictObject({
  energy: z.number().int(),
  nutrition: z.number().int(),
  movement: z.number().int(),
  hygiene: z.number().int(),
});

const CurrentSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('travel'),
    cardId: z.string().min(1),
    path: z.array(z.strictObject({ x: z.number().int(), y: z.number().int() })).min(1),
    totalTicks: z.number().int().positive(),
    elapsedTicks: z.number().int().min(0),
  }),
  z.strictObject({ type: z.literal('activity'), cardId: z.string().min(1), dto: ActiveTimedActivitySchema }),
  // armedMinty records that THIS sleep instance armed the minty bonus — §6.7
  // stop-cancels-bonus must not clear an arming it did not create.
  z.strictObject({ type: z.literal('sleep'), cardId: z.string().min(1).nullable(), armedMinty: z.boolean().optional() }),
]);
export type CurrentEntry = z.infer<typeof CurrentSchema>;

export const SimStateSchema = z.strictObject({
  engineVersion: z.number().int().positive(),
  chronotype: z.enum(['baseline', 'early', 'owl']),
  clock: z.strictObject({ absoluteMinute: z.number().int().min(0) }),
  bars: BarsSchema,
  position: z.strictObject({ x: z.number().int(), y: z.number().int() }),
  queue: z.array(QueueCardSchema),
  current: CurrentSchema.nullable(),
  suppression: z.record(z.string(), z.number().int()),
  anchorsConsumedOnDay: z.record(z.string(), z.number().int()),
  /** Exact write ownership for T4 anchor-receipt equality guards. */
  anchorMutationGenerations: z.record(z.string(), z.number().int().positive()),
  nextAnchorMutationGeneration: z.number().int().positive(),
  /** Single-depth, engine-issued undo truth. Real-time visibility lives in application/. */
  removalReceipt: RemovalReceiptSchema.nullable(),
  nextRemovalReceiptSeq: z.number().int().min(0),
  lastMealCompletedAt: z.number().int().nullable(),
  napEffectiveUsesToday: z.number().int().min(0),
  preferredWorkout: z.enum(['weights', 'treadmill']),
  /**
   * Who this person is, mechanically (docs/08).
   *
   * In `SimState` rather than `IdentityState` for the same reason `chronotype` and
   * `preferredWorkout` are: the engine reads them inside a tick and the golden replay has
   * to see them. The stream record is here for a sharper reason still — `step()` takes no
   * PRNG, and the five career-envelope streams are drawn in `game/` at boundaries the
   * application can see, while an activity check happens inside stage 3 where it cannot.
   */
  stats: StatsStateSchema,
  statXpToday: StatXpTodaySchema,
  perks: z.array(z.string().min(1)),
  rollStream: RollStreamSchema,
  practice: z.strictObject({
    points100: z.number().int().min(0),
    sessionsCountedToday: z.number().int().min(0),
    prevCompletionWasPractice: z.boolean(),
    mintyArmed: z.boolean(),
    mintyPaidToday: z.boolean(),
  }),
  decayModifiers: z.array(
    z.strictObject({ bar: BarIdSchema, factor: z.number().gt(0).lt(1), untilMinute: z.number().int(), source: z.string() }),
  ),
  lastCompletion: z
    .strictObject({ activityId: z.string().min(1), isWorkout: z.boolean(), atMinute: z.number().int().min(0) })
    .nullable(),
  pendingInstantDeltas: z.array(
    z.strictObject({ source: z.string().min(1), deltas: z.partialRecord(BarIdSchema, z.number().int()) }),
  ),
  nextCardSeq: z.number().int().min(0),
  events: z.strictObject({ urgentCount: z.number().int().min(0), anchorsMissed: z.number().int().min(0) }),
  // §7.2 row 6: one urgent event per <15 crossing per bar — the flag holds while
  // the crisis lasts so re-adds/deletions never re-count the same crisis.
  urgentActive: z.partialRecord(BarIdSchema, z.boolean()),
});
export type SimState = z.infer<typeof SimStateSchema>;

export function restoreSimState(raw: unknown): SimState {
  return SimStateSchema.parse(raw);
}

/**
 * `perksConfig` replaces the old unused `_legacyPrng` parameter: the roll stream that used
 * to be a career-envelope concern now lives here (docs/08 §8.1), so the one thing a fresh
 * SimState still cannot derive on its own is which perk ids exist to draw from.
 */
export function newGameState(
  chronotype: Chronotype,
  cfg: RatesConfig,
  rootSeed: number,
  perksConfig: PerksConfig,
): SimState {
  const character = rollNewCharacter(rootSeed, perksConfig, cfg);
  return {
    engineVersion: ENGINE_VERSION,
    chronotype,
    clock: { absoluteMinute: initialAbsoluteMinute(chronotype, cfg) },
    bars: initialBars() as Bars & SimState['bars'],
    position: { x: 4, y: 2 }, // at the bed — where Day 1 begins
    queue: [] as QueueCard[],
    current: null,
    suppression: {},
    anchorsConsumedOnDay: {},
    anchorMutationGenerations: {},
    nextAnchorMutationGeneration: 1,
    removalReceipt: null as RemovalReceipt | null,
    nextRemovalReceiptSeq: 0,
    lastMealCompletedAt: null,
    napEffectiveUsesToday: 0,
    preferredWorkout: 'weights',
    stats: character.stats,
    statXpToday: emptyStatXpToday(),
    perks: character.perks,
    rollStream: character.rollStream,
    practice: {
      points100: 0,
      sessionsCountedToday: 0,
      prevCompletionWasPractice: false,
      mintyArmed: false,
      mintyPaidToday: false,
    },
    decayModifiers: [],
    lastCompletion: null,
    pendingInstantDeltas: [],
    nextCardSeq: 0,
    events: { urgentCount: 0, anchorsMissed: 0 },
    urgentActive: {},
  };
}
