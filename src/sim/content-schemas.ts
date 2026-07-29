import { z } from 'zod';

export const BarIdSchema = z.enum(['energy', 'nutrition', 'movement', 'hygiene']);
export type BarId = z.infer<typeof BarIdSchema>;

const finiteNonNegative = z.number().finite().min(0);

/** Rates must survive ratePerMinuteFixed: at most two decimals (same 1e-9 tolerance). */
const twoDecimalRate = finiteNonNegative.refine(
  (v) => Math.abs(v * 100 - Math.round(v * 100)) <= 1e-9,
  'rates must have at most two decimal places',
);

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
  sleepRestorePerHour: twoDecimalRate.refine((v) => v > 0, 'must be positive'),
  // Zod 4: an enum-keyed record is exhaustive — a missing bar weight fails the parse.
  weights: z.record(BarIdSchema, z.number().finite().positive()),
  wellFed: z.strictObject({
    threshold: z.number().finite().min(0).max(100),
    outputBonus: z.number().finite().min(0),
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

/** Sparse signed effect map: some bars, never an unknown bar (Zod 4 partial record). */
const BarEffectsSchema = z.partialRecord(BarIdSchema, z.number().finite());

const ActivityBase = {
  id: z.string().min(1),
  object: z.string().min(1),
};

const TimedActivitySchema = z
  .strictObject({
    ...ActivityBase,
    kind: z.literal('timed'),
    baseMin: z.number().int().positive(),
    effects: BarEffectsSchema,
    tags: z.array(z.enum(['workout'])).optional(),
    // Two-decimal grid so fillStartTick's integer round-half-up is exact (frac×100 ∈ ℤ).
    fillStartsAfterFraction: z
      .number()
      .min(0)
      .lt(1)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) <= 1e-9, 'fraction must have at most two decimals')
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
