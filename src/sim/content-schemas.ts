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
    scatteredCurve: CurveSchema,
    blockCurve: CurveSchema,
    maxCountedSessionsPerDay: z.number().int().positive().max(24),
    levels: z
      .array(z.number().int().positive())
      .min(1)
      .refine((l) => l.every((v, i) => i === 0 || v > (l[i - 1] as number)), 'levels strictly increase'),
  })
  .refine(
    (p) => p.scatteredCurve.length >= p.maxCountedSessionsPerDay && p.blockCurve.length >= p.maxCountedSessionsPerDay,
    'curves must cover maxCountedSessionsPerDay',
  );
export type PracticeConfig = z.infer<typeof PracticeSchema>;
