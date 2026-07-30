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
  status: z.enum(['locked', 'active', 'complete', 'rewarded']),
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
  practiceSessions: z.number().int().min(0),
  mealCount: z.number().int().min(0),
  endingBars: z
    .strictObject({
      energy: z.number().int(),
      nutrition: z.number().int(),
      movement: z.number().int(),
      hygiene: z.number().int(),
    })
    .nullable(),
  priorEndingBars: z
    .strictObject({
      energy: z.number().int(),
      nutrition: z.number().int(),
      movement: z.number().int(),
      hygiene: z.number().int(),
    })
    .nullable(),
  wrinkleOutcomeId: z.string().min(1).nullable(),
  goalProgressIds: z.array(z.string().min(1)),
  rewardIds: z.array(z.string().min(1)),
  journalEntryId: z.string().min(1).nullable(),
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

export const GameObservationSchema = z.strictObject({
  day: z.number().int().positive(),
  absoluteMinute: z.number().int().min(0),
  minuteOfDay: z.number().int().min(0).max(1439),
  isMidnight: z.boolean(),
  isMorningCheck: z.boolean(),
  bars: z.strictObject({
    energy: z.number().int(),
    nutrition: z.number().int(),
    movement: z.number().int(),
    hygiene: z.number().int(),
  }),
  currentActivityId: z.string().min(1).nullable(),
  urgentCount: z.number().int().min(0),
});
export type GameObservation = z.infer<typeof GameObservationSchema>;

const DailyIntentionSchema = z.strictObject({
  day: z.number().int().positive(),
  intentionId: z.string().min(1),
  deliberate: z.boolean(),
  selectedAtMinute: z.number().int().min(0),
  biasTargetCompletedAtMinute: z.number().int().min(0).nullable(),
});

const CalendarDaySchema = z.strictObject({
  day: z.number().int().positive(),
  midnight: GameObservationSchema.nullable(),
  morningCheck: GameObservationSchema.nullable(),
  practiceSessions: z.number().int().min(0),
  urgentEvents: z.number().int().min(0),
  resolvedWrinkleId: z.string().min(1).nullable(),
  firstReactiveCompletionPositions: z.record(
    z.string(),
    z.number().int().min(0),
  ),
});

const JournalEntrySchema = z.strictObject({
  id: z.string().min(1),
  day: z.number().int().positive(),
  minuteOfDay: z.number().int().min(0).max(1439),
  sourceKind: z.enum(['wrinkle-outcome', 'idle-moment', 'milestone']),
  sourceId: z.string().min(1),
  stringId: z.string().min(1),
});

const LegacyWrinklesSchema = z.strictObject({
  firedIds: z.array(z.string().min(1)),
  pendingId: z.string().min(1).nullable(),
  choiceReadyId: z.string().min(1).nullable(),
  resolvedIds: z.array(z.string().min(1)),
});

const WrinklesStateSchema = LegacyWrinklesSchema.extend({
  remainingDeckIds: z.array(z.string().min(1)),
  recentDealtIds: z.array(z.string().min(1)),
  dealt: z.array(
    z.strictObject({
      day: z.number().int().positive(),
      wrinkleId: z.string().min(1).nullable(),
      variantId: z.string().min(1).nullable(),
      resolved: z.boolean(),
    }),
  ),
  announced: z
    .strictObject({
      day: z.number().int().positive(),
      wrinkleId: z.string().min(1),
      variantId: z.string().min(1),
      parameters: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()]),
      ),
    })
    .nullable(),
});

export const SessionStateSchema = z.strictObject({
  goals: z.record(z.string(), GoalProgressSchema),
  observations: ObservationsSchema,
  wrinkles: WrinklesStateSchema,
  intentions: z.strictObject({
    today: DailyIntentionSchema.nullable(),
    history: z.array(DailyIntentionSchema),
  }),
  decorations: z.strictObject({
    /** Granted and visible for the rest of the run. */
    grantedIds: z.array(z.string().min(1)),
  }),
  unlocks: z.strictObject({
    journal: z.boolean(),
    routineMemory: z.boolean(),
  }),
  journal: z.strictObject({
    nextEntrySeq: z.number().int().min(0),
    entries: z.array(JournalEntrySchema),
  }),
  calendarLedger: z.strictObject({
    days: z.array(CalendarDaySchema),
  }),
  routineMemory: z.strictObject({
    absentDaySentinel: z.number().int().positive(),
    completedDays: z.array(
      z.strictObject({
        day: z.number().int().positive(),
        firstCompletionPositionByActivity: z.record(
          z.string(),
          z.number().int().min(0),
        ),
      }),
    ),
  }),
  letter: z.strictObject({
    status: z.enum(['not-due', 'due', 'declined', 'accepted']),
    lastOfferedDay: z.number().int().positive().nullable(),
    nextOfferDay: z.number().int().positive().nullable(),
    acceptedAtDay: z.number().int().positive().nullable(),
    promisedStartDay: z.number().int().positive().nullable(),
    preparedPerformerLevel: z.number().int().min(0).max(3).nullable(),
    preparedPerformerBonusPercent: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable(),
  }),
  recap: RecapSchema,
  /** The completed day retained after wake while `recap` starts accumulating the new day. */
  morningRecap: RecapSchema.nullable(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export function restoreSession(raw: unknown): SessionState {
  const current = SessionStateSchema.safeParse(raw);
  if (current.success) return current.data;
  return migrateLegacySession(raw);
}

const LegacyRecapSchema = z.strictObject({
  forDay: z.number().int().min(0),
  completedActivityIds: z.array(z.string().min(1)),
  missedAnchorIds: z.array(z.string().min(1)),
  practicePoints100: z.number().int().min(0),
});

const LegacySessionStateSchema = z.strictObject({
  goals: z.record(z.string(), GoalProgressSchema),
  observations: ObservationsSchema,
  wrinkles: LegacyWrinklesSchema,
  decorations: z.strictObject({
    grantedIds: z.array(z.string().min(1)),
  }),
  unlocks: z.strictObject({
    journal: z.boolean(),
  }),
  recap: LegacyRecapSchema,
  morningRecap: LegacyRecapSchema.nullable(),
});

export function newDailyRecap(forDay: number): DailyRecap {
  return {
    forDay,
    completedActivityIds: [],
    missedAnchorIds: [],
    practicePoints100: 0,
    practiceSessions: 0,
    mealCount: 0,
    endingBars: null,
    priorEndingBars: null,
    wrinkleOutcomeId: null,
    goalProgressIds: [],
    rewardIds: [],
    journalEntryId: null,
  };
}

function migrateLegacyRecap(
  legacy: z.infer<typeof LegacyRecapSchema>,
): DailyRecap {
  return {
    ...newDailyRecap(legacy.forDay),
    completedActivityIds: [...legacy.completedActivityIds],
    missedAnchorIds: [...legacy.missedAnchorIds],
    practicePoints100: legacy.practicePoints100,
    practiceSessions: legacy.completedActivityIds.filter(
      (activityId) => activityId === 'practice',
    ).length,
    mealCount: legacy.completedActivityIds.filter(
      (activityId) => activityId === 'meal',
    ).length,
  };
}

export function migrateLegacySession(raw: unknown): SessionState {
  const legacy = LegacySessionStateSchema.parse(raw);
  const baseline = newSession();
  const legacyMeet =
    legacy.goals['meet-the-routine'] ?? legacy.goals['meet-you'];
  return SessionStateSchema.parse({
    ...baseline,
    goals: {
      ...baseline.goals,
      ...(legacyMeet === undefined
        ? {}
        : { 'meet-the-routine': legacyMeet }),
      ...(legacy.goals['change-of-plans'] === undefined
        ? {}
        : {
            'change-of-plans': legacy.goals['change-of-plans'],
          }),
    },
    observations: legacy.observations,
    wrinkles: {
      ...baseline.wrinkles,
      ...legacy.wrinkles,
    },
    decorations: legacy.decorations,
    unlocks: {
      ...baseline.unlocks,
      journal: legacy.unlocks.journal,
    },
    recap: migrateLegacyRecap(legacy.recap),
    morningRecap:
      legacy.morningRecap === null
        ? null
        : migrateLegacyRecap(legacy.morningRecap),
  });
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
      'meet-the-routine': {
        status: 'active',
        counters: { activitiesCompleted: 0, whyLineOpened: 0 },
      },
      'change-of-plans': {
        status: 'active',
        counters: { queueEdits: 0, forecastChangesSeen: 0 },
      },
      'handle-the-wrinkle': {
        status: 'active',
        counters: { resolvedDaysWithoutUrgent: 0 },
      },
      'first-chord': {
        status: 'active',
        counters: { practiceLevel: 0 },
      },
      'find-the-rhythm': {
        status: 'active',
        counters: { intentionBiasDays: 0 },
      },
      'balanced-week': {
        status: 'active',
        counters: { consecutiveBalancedDays: 0 },
      },
      'holidays-over': {
        status: 'locked',
        counters: { letterAccepted: 0 },
      },
    },
    observations: { whyLineOpened: false, forecastChangeObserved: false },
    wrinkles: {
      firedIds: [],
      pendingId: null,
      choiceReadyId: null,
      resolvedIds: [],
      remainingDeckIds: [],
      recentDealtIds: [],
      dealt: [],
      announced: null,
    },
    intentions: { today: null, history: [] },
    decorations: { grantedIds: [] },
    unlocks: { journal: false, routineMemory: false },
    journal: { nextEntrySeq: 0, entries: [] },
    calendarLedger: { days: [] },
    routineMemory: {
      absentDaySentinel: 1_000_000,
      completedDays: [],
    },
    letter: {
      status: 'not-due',
      lastOfferedDay: null,
      nextOfferDay: null,
      acceptedAtDay: null,
      promisedStartDay: null,
      preparedPerformerLevel: null,
      preparedPerformerBonusPercent: null,
    },
    recap: newDailyRecap(1),
    morningRecap: null,
  };
}
