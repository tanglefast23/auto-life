import { z } from 'zod';

/**
 * The `game/` ring's serializable truth (master §4: depends on `sim/`, stays
 * framework-free). Same discipline as `SimState` — no closures, no class instances,
 * no `Date`, no embedded content. Ids are resolved against validated content.
 *
 * Deliberately holds only what P4's T1 owns: goal progress, wrinkle state,
 * decoration state, and recap accumulation. Later tasks extend these in place
 * rather than adding parallel stores, and each extends the reset alongside it
 * (plan T1's [R4] note — asserting the whole reset contract here would test state
 * that does not exist yet).
 */

const GoalProgressSchema = z.strictObject({
  status: z.enum(['active', 'complete']),
  /**
   * Free-form counters so §12's goals can be counted without the envelope knowing
   * their rules — Goal 1 needs completions *and* a why-line opened, and those
   * conditions arrive with T10e, not here.
   */
  counters: z.record(z.string(), z.number().int().min(0)),
});
export type GoalProgress = z.infer<typeof GoalProgressSchema>;

const RecapSchema = z.strictObject({
  /** Which day this accumulation belongs to — the day boundary clears it. */
  forDay: z.number().int().min(0),
  completedActivityIds: z.array(z.string().min(1)),
  /** §11.4: the recap must be able to name the routine that was missed. */
  missedAnchorIds: z.array(z.string().min(1)),
  /** Exact ×100 amount earned during this day; UI rounds only at presentation. */
  practicePoints100: z.number().int().min(0),
});
export type DailyRecap = z.infer<typeof RecapSchema>;

/**
 * Player observations that no `DomainEvent` can carry, because they happen in the UI
 * rather than the sim: §12's Goal 1 requires the player to have *opened a why-line*,
 * and Goal 2 to have *seen a forecast change*. They arrive as `GameAction`s.
 *
 * Run-scoped, not day-scoped — goals span the run, so unlike `recap` these survive
 * the wake boundary.
 */
const ObservationsSchema = z.strictObject({
  whyLineOpened: z.boolean(),
  forecastChangeObserved: z.boolean(),
});

export const SessionStateSchema = z.strictObject({
  goals: z.record(z.string(), GoalProgressSchema),
  observations: ObservationsSchema,
  wrinkles: z.strictObject({
    firedIds: z.array(z.string().min(1)),
    /** A wrinkle awaiting the player's resolution, e.g. the Day-1 package (§9.4). */
    pendingId: z.string().min(1).nullable(),
    /** The package activity completed and its reward choice can now be shown. */
    choiceReadyId: z.string().min(1).nullable(),
    resolvedIds: z.array(z.string().min(1)),
  }),
  decorations: z.strictObject({
    /** Granted and visible for the rest of the run. */
    grantedIds: z.array(z.string().min(1)),
  }),
  unlocks: z.strictObject({
    journal: z.boolean(),
  }),
  recap: RecapSchema,
  /** The completed day retained after wake while `recap` starts accumulating the new day. */
  morningRecap: RecapSchema.nullable(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export function restoreSession(raw: unknown): SessionState {
  return SessionStateSchema.parse(raw);
}

/**
 * The deterministic session reset (plan T1).
 *
 * Identical to `newSession()` today because T1's envelope is all there is to clear.
 * It exists as its own named entry point so that every later task which introduces
 * resettable state extends *this* — plan T1's [R4] note. `application/` owns the rest
 * of the contract (pending commands, loop accumulator, forecast cache, live receipt
 * and toast, idle timer, presentation selections), and T12 asserts the whole of it
 * end to end once every contributor has landed.
 */
export function resetSession(): SessionState {
  return newSession();
}

export function newSession(): SessionState {
  return {
    goals: {
      'meet-you': {
        status: 'active',
        counters: { activitiesCompleted: 0, whyLineOpened: 0 },
      },
      'change-of-plans': {
        status: 'active',
        counters: { queueEdits: 0, forecastChangesSeen: 0 },
      },
    },
    observations: { whyLineOpened: false, forecastChangeObserved: false },
    wrinkles: {
      firedIds: [],
      pendingId: null,
      choiceReadyId: null,
      resolvedIds: [],
    },
    decorations: { grantedIds: [] },
    unlocks: { journal: false },
    recap: {
      forDay: 1,
      completedActivityIds: [],
      missedAnchorIds: [],
      practicePoints100: 0,
    },
    morningRecap: null,
  };
}
