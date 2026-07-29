import { z } from 'zod';

export const BarIdSchema = z.enum(['energy', 'nutrition', 'movement', 'hygiene']);
export type BarId = z.infer<typeof BarIdSchema>;

const finiteNonNegative = z.number().finite().min(0);

const BarRateSchema = z.strictObject({
  awake: finiteNonNegative,
  asleep: finiteNonNegative,
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
  sleepRestorePerHour: z.number().finite().positive(),
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
