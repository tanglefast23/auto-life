import { z } from 'zod';

/**
 * The Commitments DTO (SPEC §7.6) — the second planning horizon. v1 ships the TYPE
 * and validator only; materialization (the two-hours-before scheduler) is v2's,
 * because it has no caller and no verifiable behavior until work shifts exist.
 */
export const CommitmentSchema = z.strictObject({
  ownerId: z.string().min(1),
  targetStart: z.number().int().min(0),
  earliestStart: z.number().int().min(0),
  latestStart: z.number().int().min(0),
  duration: z.number().int().positive(),
  location: z.string().min(1),
  travelMinutes: z.number().int().min(0),
  flexibility: z.enum(['fixed', 'flexible', 'anytime']),
  source: z.enum(['work', 'invitation', 'class', 'date', 'letter']),
  status: z.enum(['booked', 'materialized', 'completed', 'cancelled']),
}).refine((c) => c.earliestStart <= c.targetStart && c.targetStart <= c.latestStart, 'earliest ≤ target ≤ latest');

export type Commitment = z.infer<typeof CommitmentSchema>;

export function restoreCommitment(raw: unknown): Commitment {
  return CommitmentSchema.parse(raw);
}
