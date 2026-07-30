import { z } from 'zod';

export const BarIdSchema = z.enum(['energy', 'nutrition', 'movement', 'hygiene']);
export type BarId = z.infer<typeof BarIdSchema>;

const finiteNonNegative = z.number().finite().min(0);

/**
 * Rates must survive ratePerMinuteFixed: at most two decimals (same 1e-9 tolerance),
 * and bounded to the bar domain (≤100/h — bars are 0–100, so faster than full-drain-
 * in-an-hour is content nonsense and unbounded magnitudes reach runtime throws).
 */
const twoDecimalRate = finiteNonNegative
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) <= 1e-9, 'rates must have at most two decimal places')
  .refine((v) => v <= 100, 'rates must be at most 100 per hour');

const BarRateSchema = z.strictObject({
  awake: twoDecimalRate,
  asleep: twoDecimalRate,
});

const TargetSchema = z.strictObject({
  wake: z.number().int().min(0).max(1439),
  bed: z.number().int().min(0).max(1439),
});

const BandSchema = z
  .strictObject({
    tick: z.number().finite().min(0).max(100),
    alert: z.number().finite().min(0).max(100),
  })
  .refine((band) => band.alert < band.tick, 'alert must be below tick');

export const RatesSchema = z.strictObject({
  rates: z.strictObject({
    energy: BarRateSchema,
    nutrition: BarRateSchema,
    movement: BarRateSchema,
    hygiene: BarRateSchema,
  }),
  // Positive ON THE GRID: 1e-12 passes float positivity but quantizes to a zero
  // per-minute delta, silently voiding the closure guarantee.
  sleepRestorePerHour: twoDecimalRate.refine((v) => Math.round(v * 100) >= 1, 'must be at least 0.01/h'),
  // Zod 4: an enum-keyed record is exhaustive — a missing bar weight fails the parse.
  weights: z.record(BarIdSchema, z.number().finite().positive()),
  wellFed: z.strictObject({
    threshold: z.number().finite().min(0).max(100),
    outputBonus: z.number().finite().min(0).max(10),
  }),
  displayBands: z.strictObject({
    default: BandSchema,
    energy: BandSchema,
  }),
  urgentThreshold: z.number().finite().min(0).max(100),
  chronotype: z.strictObject({
    baseline: TargetSchema,
    early: TargetSchema,
    owl: TargetSchema,
  }),
});

export type RatesConfig = z.infer<typeof RatesSchema>;

// ---------- activities (SPEC §6.2; signed pro-rata effects close the stop-at-99% exploit) ----------

/** Sparse signed effect map: some bars, never an unknown bar; magnitude bounded to the bar domain. */
const BarEffectsSchema = z.partialRecord(
  BarIdSchema,
  z.number().finite().refine((v) => Math.abs(v) <= 100, 'effect magnitude must be at most 100'),
);

const ActivityBase = {
  id: z.string().min(1),
  object: z.string().min(1),
  /** System-only activities (for example the Day-1 package) never enter player pickers. */
  playerSelectable: z.boolean().optional(),
};

const TimedActivitySchema = z
  .strictObject({
    ...ActivityBase,
    kind: z.literal('timed'),
    // ≤1440 (one full day): the integer duration derivation is proven exact on this
    // domain, and a longer "timed" activity is content nonsense anyway.
    baseMin: z.number().int().positive().max(1440),
    effects: BarEffectsSchema,
    tags: z.array(z.enum(['workout'])).optional(),
    // Two-decimal grid so fillStartTick's integer round-half-up is exact (frac×100 ∈ 0…99;
    // the ≤99 refine keeps values like 0.9999999999995 from rounding onto the excluded 1.00).
    fillStartsAfterFraction: z
      .number()
      .min(0)
      .lt(1)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) <= 1e-9, 'fraction must have at most two decimals')
      .refine((v) => Math.round(v * 100) <= 99, 'fraction must round to at most 0.99')
      .optional(),
    effectiveUsesPerDay: z.number().int().positive().optional(),
    startBelow: z.partialRecord(BarIdSchema, z.number().min(0).max(100)).optional(),
    effectiveWindow: z
      .strictObject({
        wakeOffsetStart: z.number().int().min(0),
        wakeOffsetEnd: z.number().int().min(0),
      })
      .refine((w) => w.wakeOffsetStart < w.wakeOffsetEnd, 'window must be non-empty')
      .optional(),
    suppressPassiveEnergyWhenEffective: z.boolean().optional(),
  })
  .superRefine((a, ctx) => {
    // The effective-use mechanic is one coherent unit — no half-configured variants:
    // suppression ⇒ budget + window, and budget ⇔ window.
    if (a.suppressPassiveEnergyWhenEffective && (!a.effectiveUsesPerDay || !a.effectiveWindow)) {
      ctx.addIssue({
        code: 'custom',
        message: `${a.id}: suppressPassiveEnergyWhenEffective requires effectiveUsesPerDay and effectiveWindow`,
      });
    }
    if ((a.effectiveUsesPerDay !== undefined) !== (a.effectiveWindow !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: `${a.id}: effectiveUsesPerDay and effectiveWindow must be declared together`,
      });
    }
  });

const SleepWindowActivitySchema = z.strictObject({ ...ActivityBase, kind: z.literal('sleepWindow') });
const IdleActivitySchema = z.strictObject({ ...ActivityBase, kind: z.literal('idle') });
const PracticeActivitySchema = z.strictObject({
  ...ActivityBase,
  kind: z.literal('practice'),
  baseMin: z.number().int().positive(),
});

export const ActivitySchema = z.discriminatedUnion('kind', [
  TimedActivitySchema,
  SleepWindowActivitySchema,
  IdleActivitySchema,
  PracticeActivitySchema,
]);
export type ActivityDef = z.infer<typeof ActivitySchema>;
export type TimedActivityDef = z.infer<typeof TimedActivitySchema>;

export const ActivitiesSchema = z
  .strictObject({ activities: z.array(ActivitySchema).min(1) })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    for (const a of doc.activities) {
      if (seen.has(a.id)) ctx.addIssue({ code: 'custom', message: `duplicate activity id "${a.id}"` });
      seen.add(a.id);
    }
  });
export type ActivitiesConfig = z.infer<typeof ActivitiesSchema>;

// ---------- planner content (SPEC §7.1–§7.3, §6.7, §8; offsets are minutes from wakeTarget) ----------

const WakeOffset = z.number().int().min(-1439).max(1439);

const AnchorGateSchema = z
  .strictObject({
    bar: BarIdSchema,
    below: z.number().min(0).max(100),
    noMealWithinMin: z.number().int().positive().optional(),
  })
  .nullable();

export const AnchorsSchema = z
  .strictObject({
    anchors: z
      .array(
        z
          .strictObject({
            id: z.string().min(1),
            opensAt: WakeOffset,
            closesAt: WakeOffset,
            targetAt: WakeOffset,
            block: z.array(z.string().min(1)).min(1),
            gate: AnchorGateSchema,
          })
          .refine((a) => a.opensAt <= a.targetAt && a.targetAt <= a.closesAt, 'opensAt ≤ targetAt ≤ closesAt'),
      )
      .min(1),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    for (const a of doc.anchors) {
      if (seen.has(a.id)) ctx.addIssue({ code: 'custom', message: `duplicate anchor id "${a.id}"` });
      seen.add(a.id);
    }
  });
export type AnchorsConfig = z.infer<typeof AnchorsSchema>;
export type AnchorDef = AnchorsConfig['anchors'][number];

export const ReactiveSchema = z.strictObject({
  weights: z.record(BarIdSchema, z.number().positive()).refine(
    (w) => !('movement' in w) || w.movement !== undefined,
    'weights must be exhaustive',
  ),
  urgentThreshold: z.number().min(0).max(100),
  neverUrgent: z.array(BarIdSchema),
  rules: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        bar: BarIdSchema,
        below: z.number().min(0).max(100),
        activity: z.string().min(1),
        window: z.tuple([WakeOffset, WakeOffset]).nullable(),
        supersededBelow: z.strictObject({ value: z.number().min(0).max(100), activity: z.string().min(1) }).optional(),
        exclusiveGroup: z.string().min(1).optional(),
        supersedesGroup: z.boolean().optional(),
      }),
    )
    .min(1),
});
export type ReactiveConfig = z.infer<typeof ReactiveSchema>;
export type ReactiveRule = ReactiveConfig['rules'][number];

const AdjacencyEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('halveDuration') }),
  z.strictObject({
    kind: z.literal('scaleDecay'),
    bar: BarIdSchema,
    factor: z.number().gt(0).lt(1),
    durationMin: z.number().int().positive().max(1440),
  }),
  z.strictObject({
    kind: z.literal('barDelta'),
    deltas: z.partialRecord(BarIdSchema, z.number().finite().refine((v) => Math.abs(v) <= 100, 'magnitude ≤ 100')),
  }),
  z.strictObject({
    kind: z.literal('scalePoints'),
    factor: z.number().gt(1).max(2),
    appliesTo: z.enum(['thatPractice', 'firstPracticeBeforeMorningCheck']),
  }),
]);

export const AdjacencySchema = z
  .strictObject({
    pairs: z
      .array(
        z
          .strictObject({
            id: z.string().min(1),
            first: z.string().min(1).optional(),
            firstTag: z.enum(['workout']).optional(),
            second: z.string().min(1).optional(),
            secondTag: z.enum(['workout']).optional(),
            gapMaxMin: z.number().int().min(0).max(1440),
            effect: AdjacencyEffectSchema,
          })
          .refine((p) => (p.first !== undefined) !== (p.firstTag !== undefined), 'exactly one of first/firstTag')
          .refine((p) => (p.second !== undefined) !== (p.secondTag !== undefined), 'exactly one of second/secondTag'),
      )
      .min(1),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    for (const p of doc.pairs) {
      if (seen.has(p.id)) ctx.addIssue({ code: 'custom', message: `duplicate pair id "${p.id}"` });
      seen.add(p.id);
    }
  });
export type AdjacencyConfig = z.infer<typeof AdjacencySchema>;
export type AdjacencyPair = AdjacencyConfig['pairs'][number];

const CurveSchema = z
  .array(z.number().gt(0).max(1))
  .min(1)
  .max(8)
  .refine((c) => c.every((v, i) => i === 0 || v <= (c[i - 1] as number)), 'curves must be non-increasing')
  .refine((c) => c[0] === 1.0, 'curves start at 1.0');

export const PracticeSchema = z
  .strictObject({
    basePoints: z.number().int().positive().max(1000),
    hygieneFocus: z.strictObject({
      below: z.number().min(0).max(100),
      factor: z.number().gt(0).lt(1),
    }),
    scatteredCurve: CurveSchema,
    blockCurve: CurveSchema,
    maxCountedSessionsPerDay: z.number().int().positive().max(24),
    levels: z
      .array(z.number().int().positive())
      .length(3)
      .refine((l) => l.every((v, i) => i === 0 || v > (l[i - 1] as number)), 'levels strictly increase'),
  })
  .refine(
    (p) => p.scatteredCurve.length >= p.maxCountedSessionsPerDay && p.blockCurve.length >= p.maxCountedSessionsPerDay,
    'curves must cover maxCountedSessionsPerDay',
  );
export type PracticeConfig = z.infer<typeof PracticeSchema>;

// ---------- home map + objects (SPEC §10) ----------

const Tile = z.tuple([z.number().int().min(0).max(23), z.number().int().min(0).max(13)]);

export const HomeMapSchema = z.strictObject({
  width: z.literal(24),
  height: z.literal(14),
  rooms: z.record(z.string(), z.string().length(1)),
  walls: z.literal('#'),
  grid: z.array(z.string().length(24)).length(14),
});
export type HomeMapConfig = z.infer<typeof HomeMapSchema>;

export const ObjectsSchema = z
  .strictObject({
    objects: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          room: z.string().min(1),
          footprint: z.array(Tile).min(1),
          interactPoint: Tile,
          facing: z.enum(['up', 'down', 'left', 'right']),
          activities: z.array(z.string()),
          upgradeTrack: z.string().nullable(),
          decorationSlots: z.number().int().min(0).max(4),
          blocksMovement: z.boolean().optional(), // default true; walk-on objects (rug) opt out
        }),
      )
      .min(1),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    for (const o of doc.objects) {
      if (seen.has(o.id)) ctx.addIssue({ code: 'custom', message: `duplicate object id "${o.id}"` });
      seen.add(o.id);
    }
  });
export type ObjectsConfig = z.infer<typeof ObjectsSchema>;
export type ObjectDef = ObjectsConfig['objects'][number];

// ---------- P5 game content (SPEC §§9, 12) ----------

/** Stable authored IDs are save data. Keep them lowercase and URL-safe. */
export const StableContentIdSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
    'content IDs must be lowercase kebab-case',
  );

/**
 * Player copy is addressed as `file:leaf.path`. The file prefix keeps IDs
 * stable even when two authored documents use the same leaf name.
 */
export const StringRefSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*:[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*$/,
    'string references must use file:leaf.path',
  );

function addDuplicateIdIssues<T extends { id: string }>(
  values: readonly T[],
  owner: string,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `duplicate ${owner} id "${value.id}"`,
      });
    }
    seen.add(value.id);
  }
}

const GoalConditionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('activity-and-why'),
    activityCompletions: z.number().int().positive(),
  }),
  z.strictObject({
    kind: z.literal('queue-edit-and-forecast'),
  }),
  z.strictObject({
    kind: z.literal('wrinkle-day'),
    maxUrgentEvents: z.number().int().min(0),
    sample: z.literal('midnight'),
  }),
  z.strictObject({
    kind: z.literal('practice-level'),
    level: z.number().int().min(1).max(3),
  }),
  z.strictObject({
    kind: z.literal('intention-bias'),
    deliberateSelection: z.literal(true),
  }),
  z.strictObject({
    kind: z.literal('balanced-streak'),
    days: z.number().int().positive(),
    practiceSessionsPerDay: z.number().int().positive(),
    barsAtLeast: z.number().min(0).max(100),
    maxUrgentEvents: z.number().int().min(0),
    sampleAtWakeOffset: WakeOffset,
  }),
  z.strictObject({
    kind: z.literal('letter-accepted'),
    earliestDay: z.number().int().positive(),
  }),
]);
export type GoalCondition = z.infer<typeof GoalConditionSchema>;

const GoalRewardSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    id: StableContentIdSchema,
    kind: z.literal('journal-unlock'),
    labelStringId: StringRefSchema,
  }),
  z.strictObject({
    id: StableContentIdSchema,
    kind: z.literal('decoration'),
    labelStringId: StringRefSchema,
    decorationIds: z.array(StableContentIdSchema).min(1),
  }),
  z.strictObject({
    id: StableContentIdSchema,
    kind: z.literal('idle-variant'),
    labelStringId: StringRefSchema,
    idleVariantId: StableContentIdSchema,
    fallback: z.literal('next-available'),
  }),
  z.strictObject({
    id: StableContentIdSchema,
    kind: z.literal('routine-memory'),
    labelStringId: StringRefSchema,
  }),
  z.strictObject({
    id: StableContentIdSchema,
    kind: z.literal('chapter-handoff'),
    labelStringId: StringRefSchema,
  }),
]);
export type GoalReward = z.infer<typeof GoalRewardSchema>;

export const GoalsSchema = z
  .strictObject({
    rewards: z.array(GoalRewardSchema).min(1),
    goals: z
      .array(
        z.strictObject({
          id: StableContentIdSchema,
          order: z.number().int().positive(),
          titleStringId: StringRefSchema,
          instructionStringId: StringRefSchema,
          rewardId: StableContentIdSchema,
          condition: GoalConditionSchema,
          requiresAutonomy: z
            .enum(['full-routine', 'any'])
            .default('any'),
        }),
      )
      .min(1),
  })
  .superRefine((doc, ctx) => {
    addDuplicateIdIssues(doc.rewards, 'reward', ctx);
    addDuplicateIdIssues(doc.goals, 'goal', ctx);
    const orders = new Set<number>();
    for (const goal of doc.goals) {
      if (orders.has(goal.order)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate goal order "${goal.order}"`,
        });
      }
      orders.add(goal.order);
    }
  });
export type GoalsConfig = z.infer<typeof GoalsSchema>;
export type GoalDef = GoalsConfig['goals'][number];

const IntentionPolicySchema = z.discriminatedUnion('kind', [
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

const IntentionBiasTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('any-completed-activity') }),
  z.strictObject({
    kind: z.literal('activity'),
    activityIds: z.array(StableContentIdSchema).min(1),
  }),
  z.strictObject({
    kind: z.literal('activity-tag'),
    tag: z.literal('workout'),
  }),
]);

export const IntentionsSchema = z
  .strictObject({
    defaultId: StableContentIdSchema,
    intentions: z
      .array(
        z.strictObject({
          id: StableContentIdSchema,
          labelStringId: StringRefSchema,
          descriptionStringId: StringRefSchema,
          policy: IntentionPolicySchema,
          biasTarget: IntentionBiasTargetSchema,
        }),
      )
      .min(1),
  })
  .superRefine((doc, ctx) => {
    addDuplicateIdIssues(doc.intentions, 'intention', ctx);
  });
export type IntentionsConfig = z.infer<typeof IntentionsSchema>;
export type IntentionDef = IntentionsConfig['intentions'][number];

const WrinkleWindowSchema = z
  .tuple([WakeOffset, WakeOffset])
  .refine(([start, end]) => start < end, 'wrinkle window must be non-empty');

const WrinkleEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('visitor'),
    activityId: StableContentIdSchema,
    window: WrinkleWindowSchema,
    durationMin: z.number().int().positive(),
    anchorPrecedence: z.literal('none'),
  }),
  z.strictObject({
    kind: z.literal('blocked-object'),
    objectId: StableContentIdSchema,
    window: WrinkleWindowSchema,
    fallbackActivityId: StableContentIdSchema,
    anchorPrecedence: z.literal('blocks-object-only'),
  }),
  z.strictObject({
    kind: z.literal('timed-window'),
    activityId: StableContentIdSchema,
    window: WrinkleWindowSchema,
    collidingAnchorId: StableContentIdSchema,
    replacementTargetOffsets: z.tuple([WakeOffset, WakeOffset]),
    anchorPrecedence: z.literal('wrinkle-shifts-anchor'),
  }),
  z.strictObject({
    kind: z.literal('slowed-activity'),
    activityTag: z.literal('workout'),
    durationFactor: z.number().gt(1).max(4),
    clearActivityId: StableContentIdSchema,
    anchorPrecedence: z.literal('anchor-remains'),
  }),
  z.strictObject({
    kind: z.literal('free-time'),
    wakeOffsetMin: z.number().int().negative().min(-180),
    energy: z.literal(100),
    anchorPrecedence: z.literal('wake-only'),
  }),
  z.strictObject({
    kind: z.literal('forced-substitution'),
    targetActivityId: StableContentIdSchema,
    nutritionDelta: z.number().int().positive().max(100),
    countsAsMeal: z.literal(false),
    anchorPrecedence: z.literal('replaces-wake-meal'),
  }),
  z.strictObject({
    kind: z.literal('availability-gate'),
    activityIds: z.array(StableContentIdSchema).min(1),
    availableAtWakeOffset: WakeOffset,
    anchorPrecedence: z.literal('gate-wins'),
  }),
  z.strictObject({
    kind: z.literal('wake-modifier'),
    energy: z.number().int().min(1).max(99),
    anchorPrecedence: z.literal('wake-only'),
  }),
]);
export type WrinkleEffect = z.infer<typeof WrinkleEffectSchema>;

const WrinkleSuccessSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('queue-slot-free'),
    window: WrinkleWindowSchema,
    durationMin: z.number().int().positive(),
  }),
  z.strictObject({
    kind: z.literal('activity-completed'),
    activityId: StableContentIdSchema,
  }),
  z.strictObject({
    kind: z.literal('one-of-activities-completed'),
    activityIds: z.array(StableContentIdSchema).min(1),
  }),
  z.strictObject({
    kind: z.literal('anchor-rescheduled'),
    anchorId: StableContentIdSchema,
    allowedTargetOffsets: z.array(WakeOffset).min(1),
  }),
]);
export type WrinkleSuccess = z.infer<typeof WrinkleSuccessSchema>;

const WrinkleActionSchema = z.strictObject({
  id: StableContentIdSchema,
  kind: z.enum([
    'keep-slot-free',
    'reroute-or-reschedule',
    'reschedule-anchor',
    'schedule-recovery',
    'use-free-time',
    'plan-recovery',
    'use-alternative',
    'recover-energy',
  ]),
  labelStringId: StringRefSchema,
});

const WrinkleVariantSchema = z.strictObject({
  id: StableContentIdSchema,
  titleStringId: StringRefSchema,
  introStringId: StringRefSchema,
  successStringId: StringRefSchema,
  failureStringId: StringRefSchema,
  outcomeStringId: StringRefSchema,
  playerAction: WrinkleActionSchema,
});

export const WrinklesSchema = z
  .strictObject({
    quietDayWeight: z.number().int().min(0),
    noRepeatDays: z.number().int().positive(),
    entries: z
      .array(
        z.strictObject({
          id: StableContentIdSchema,
          firstDay: z.number().int().positive(),
          effect: WrinkleEffectSchema,
          success: WrinkleSuccessSchema,
          variants: z.array(WrinkleVariantSchema).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((doc, ctx) => {
    addDuplicateIdIssues(doc.entries, 'wrinkle', ctx);
    const variantIds = new Set<string>();
    const actionIds = new Set<string>();
    for (const entry of doc.entries) {
      for (const variant of entry.variants) {
        if (variantIds.has(variant.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `duplicate wrinkle variant id "${variant.id}"`,
          });
        }
        variantIds.add(variant.id);
        if (actionIds.has(variant.playerAction.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `duplicate wrinkle action id "${variant.playerAction.id}"`,
          });
        }
        actionIds.add(variant.playerAction.id);
      }
    }
  });
export type WrinklesConfig = z.infer<typeof WrinklesSchema>;
export type WrinkleDef = WrinklesConfig['entries'][number];

const StoryletSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('wrinkle-outcome'),
    wrinkleId: StableContentIdSchema,
  }),
  z.strictObject({
    kind: z.literal('idle-moment'),
    activityId: StableContentIdSchema,
  }),
  z.strictObject({
    kind: z.literal('milestone'),
    goalId: StableContentIdSchema,
  }),
]);

export const StoryletsSchema = z
  .strictObject({
    storylets: z
      .array(
        z.strictObject({
          id: StableContentIdSchema,
          source: StoryletSourceSchema,
          stringId: StringRefSchema,
        }),
      )
      .min(1),
  })
  .superRefine((doc, ctx) => {
    addDuplicateIdIssues(doc.storylets, 'storylet', ctx);
  });
export type StoryletsConfig = z.infer<typeof StoryletsSchema>;

const PreferenceMechanicSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('chronotype'),
    value: z.enum(['early', 'owl']),
  }),
  z.strictObject({
    kind: z.literal('preferred-workout'),
    activityId: StableContentIdSchema,
  }),
  z.strictObject({
    kind: z.literal('food-mood'),
    value: z.enum(['proper-meals', 'grazer']),
  }),
  z.strictObject({
    kind: z.literal('idle-variant'),
    idleVariantId: StableContentIdSchema,
  }),
]);

const PreferenceOptionSchema = z.strictObject({
  id: StableContentIdSchema,
  labelStringId: StringRefSchema,
  mechanic: PreferenceMechanicSchema,
});

export const IdentitySchema = z
  .strictObject({
    appearancePresets: z
      .array(
        z.strictObject({
          id: StableContentIdSchema,
          labelStringId: StringRefSchema,
          paletteId: StableContentIdSchema,
        }),
      )
      .length(4),
    preferenceCategories: z
      .array(
        z.strictObject({
          id: StableContentIdSchema,
          labelStringId: StringRefSchema,
          alwaysActive: z.boolean(),
          options: z.array(PreferenceOptionSchema).min(2),
        }),
      )
      .min(1),
  })
  .superRefine((doc, ctx) => {
    addDuplicateIdIssues(doc.appearancePresets, 'appearance preset', ctx);
    addDuplicateIdIssues(doc.preferenceCategories, 'preference category', ctx);
    const optionIds = new Set<string>();
    for (const category of doc.preferenceCategories) {
      for (const option of category.options) {
        if (optionIds.has(option.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `duplicate preference option id "${option.id}"`,
          });
        }
        optionIds.add(option.id);
      }
    }
  });
export type IdentityConfig = z.infer<typeof IdentitySchema>;

export const StringCatalogSchema = z
  .strictObject({
    ids: z.array(StringRefSchema).min(1),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    for (const id of doc.ids) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate string id "${id}"`,
        });
      }
      seen.add(id);
    }
  });
export type StringCatalog = z.infer<typeof StringCatalogSchema>;
