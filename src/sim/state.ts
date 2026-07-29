import { z } from 'zod';
import { ActiveTimedActivitySchema, type ActiveTimedActivity } from './activities';
import { PrngSnapshotSchema, type PrngSnapshot } from './prng';
import { QueueCardSchema, type QueueCard } from './queue';
import { ENGINE_VERSION } from './version';
import { initialAbsoluteMinute, initialBars } from './initial-state';
import type { RatesConfig } from './content-schemas';
import { BarIdSchema } from './content-schemas';
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
  z.strictObject({ type: z.literal('sleep'), cardId: z.string().min(1).nullable() }),
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
  lastMealCompletedAt: z.number().int().nullable(),
  napEffectiveUsesToday: z.number().int().min(0),
  preferredWorkout: z.enum(['weights', 'treadmill']),
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
  prng: PrngSnapshotSchema,
});
export type SimState = z.infer<typeof SimStateSchema>;

export function restoreSimState(raw: unknown): SimState {
  return SimStateSchema.parse(raw);
}

export function newGameState(chronotype: Chronotype, cfg: RatesConfig, rootSeed: number, prng: PrngSnapshot): SimState {
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
    lastMealCompletedAt: null,
    napEffectiveUsesToday: 0,
    preferredWorkout: 'weights',
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
    prng,
  };
}
