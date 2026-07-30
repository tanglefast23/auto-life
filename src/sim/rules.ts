import { z } from 'zod';
import { StableContentIdSchema } from './content-schemas';

export const AutonomyModeSchema = z.enum([
  'full-routine',
  'essentials-only',
  'reactive-only',
]);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;

const RuleSourceSchema = z.strictObject({
  wrinkleId: StableContentIdSchema,
  variantId: StableContentIdSchema,
  day: z.number().int().positive().optional(),
});

const IntentionPolicyRuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('balanced') }),
  z.strictObject({
    kind: z.literal('take-it-easy'),
    suppressAnchorId: StableContentIdSchema,
    favorQuickVariants: z.literal(true),
  }),
  z.strictObject({
    kind: z.literal('get-moving'),
    suggestActivityId: StableContentIdSchema,
    waiveSecondWorkoutCrossCost: z.literal(true),
  }),
  z.strictObject({
    kind: z.literal('eat-properly'),
    preferActivityId: StableContentIdSchema,
    wellFedThreshold: z.number().min(0).max(100),
  }),
  z.strictObject({
    kind: z.literal('practice-focus'),
    suggestedActivityId: StableContentIdSchema,
    protectContiguousBlock: z.literal(true),
  }),
]);

/**
 * Mechanical truth announced to the player for the minute about to run.
 *
 * This is derived outside sim/ from career/game state and passed to both live
 * stepping and forecasting. It contains no prose, UI state, or undealt draws.
 */
export const SimRulesSchema = z.strictObject({
  revision: z.number().int().min(0),
  key: z.string().min(1),
  autonomy: AutonomyModeSchema,
  intention: z
    .strictObject({
      id: StableContentIdSchema,
      selectedDay: z.number().int().positive(),
      deliberate: z.boolean(),
      policy: IntentionPolicyRuleSchema,
      workoutsCompletedToday: z.number().int().min(0),
    })
    .nullable(),
  preferences: z.strictObject({
    foodMood: z.enum(['proper-meals', 'grazer']).nullable(),
    idleVariantId: StableContentIdSchema.nullable(),
  }),
  objectBlocks: z.array(
    z.strictObject({
      source: RuleSourceSchema,
      objectId: StableContentIdSchema,
      startsAtMinute: z.number().int().min(0),
      endsAtMinute: z.number().int().min(0),
      fallbackActivityId: StableContentIdSchema,
    }),
  ),
  activitySlowdowns: z.array(
    z.strictObject({
      source: RuleSourceSchema,
      activityTag: z.literal('workout'),
      durationFactor: z.number().gt(1).max(4),
      clearActivityId: StableContentIdSchema,
    }),
  ),
  activityOverrides: z.array(
    z.strictObject({
      source: RuleSourceSchema,
      activityId: StableContentIdSchema,
      nutritionDelta: z.number().int().min(0).max(100),
      countsAsMeal: z.boolean(),
    }),
  ),
  availabilityGates: z.array(
    z.strictObject({
      source: RuleSourceSchema,
      activityIds: z.array(StableContentIdSchema).min(1),
      availableAtMinute: z.number().int().min(0),
    }),
  ),
  anchorOverrides: z.array(
    z.strictObject({
      source: RuleSourceSchema,
      anchorId: StableContentIdSchema,
      targetAtWakeOffset: z.number().int().min(-1439).max(1439).nullable(),
      suppressed: z.boolean(),
    }),
  ),
  wakeModifier: z
    .strictObject({
      source: RuleSourceSchema,
      wakeOffsetMin: z.number().int().min(-180).max(180),
      energy: z.number().int().min(1).max(100),
    })
    .nullable(),
  routineMemory: z
    .strictObject({
      rankByActivity: z.record(
        StableContentIdSchema,
        z.number().int().min(0),
      ),
      absentRank: z.number().int().positive(),
    })
    .nullable()
    .default(null),
});
export type SimRules = z.infer<typeof SimRulesSchema>;

export const DEFAULT_SIM_RULES: SimRules = Object.freeze(
  SimRulesSchema.parse({
    revision: 0,
    key: 'default',
    autonomy: 'full-routine',
    intention: null,
    preferences: {
      foodMood: null,
      idleVariantId: null,
    },
    objectBlocks: [],
    activitySlowdowns: [],
    activityOverrides: [],
    availabilityGates: [],
    anchorOverrides: [],
    wakeModifier: null,
    routineMemory: null,
  }),
);

export function restoreSimRules(raw: unknown): SimRules {
  return SimRulesSchema.parse(raw);
}
