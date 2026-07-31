import { z } from 'zod';
import { activeIdleVariantId } from '../game/idle-variant';
import type { GameAction } from '../game/tick';
import {
  SessionStateSchema,
  newSession,
  restoreSession,
  type SessionState,
} from '../game/session';
import type { Command } from '../sim/step';
import type { QueueCard } from '../sim/queue';
import {
  PrngSnapshotSchema,
  PrngStreams,
  type PrngSnapshot,
} from '../sim/prng';
import {
  SimStateSchema,
  restoreSimState,
  type SimState,
} from '../sim/state';
import { ENGINE_VERSION } from '../sim/version';
import {
  AutonomyModeSchema,
  restoreSimRules,
  type AutonomyMode,
  type SimRules,
} from '../sim/rules';
import type { ContentRegistry } from '../sim/content';
import {
  dayNumber,
  targetsFor,
  TICKS_PER_DAY,
} from '../sim/clock';

const Uint32Schema = z.number().int().min(0).max(0xffffffff);

export const PronounsSchema = z.strictObject({
  subject: z.string().trim().min(1).max(24),
  object: z.string().trim().min(1).max(24),
  possessive: z.string().trim().min(1).max(24),
});

export const IdentityStateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(40),
    pronouns: PronounsSchema,
    appearancePresetId: z.string().min(1),
    activePreferenceCategoryIds: z.array(z.string().min(1)).length(2),
    foodMoodId: z.string().min(1).nullable(),
    idlePreferenceId: z.string().min(1).nullable(),
  })
  .superRefine((identity, ctx) => {
    if (
      new Set(identity.activePreferenceCategoryIds).size !==
      identity.activePreferenceCategoryIds.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'active preference categories must be unique',
      });
    }
    if (!identity.activePreferenceCategoryIds.includes('chronotype')) {
      ctx.addIssue({
        code: 'custom',
        message: 'chronotype must always be active',
      });
    }
    if (
      identity.activePreferenceCategoryIds.includes('food') !==
      (identity.foodMoodId !== null)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'food mood exists exactly when its category is active',
      });
    }
    if (
      identity.activePreferenceCategoryIds.includes('idle') !==
      (identity.idlePreferenceId !== null)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'idle preference exists exactly when its category is active',
      });
    }
  });
export type IdentityState = z.infer<typeof IdentityStateSchema>;

export const AppPreferencesSchema = z.strictObject({
  audio: z.strictObject({
    master: z.number().min(0).max(1),
    music: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    muted: z.boolean(),
  }),
  gameplay: z.strictObject({
    defaultSpeed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
    sleepAutoSkip: z.boolean(),
    dailyIntentionPrompt: z.boolean(),
  }),
  display: z.strictObject({
    reducedMotion: z.enum(['system', 'on', 'off']),
    hudTextScale: z.number().min(0.75).max(1.5),
    fractionalScaling: z.boolean(),
  }),
  accessibility: z.strictObject({
    nonColorUrgency: z.boolean(),
    screenReaderVerbosity: z.enum(['brief', 'full']),
  }),
});
export type AppPreferences = z.infer<typeof AppPreferencesSchema>;

export const AppPreferencesEnvelopeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  preferences: AppPreferencesSchema,
});
export type AppPreferencesEnvelope = z.infer<
  typeof AppPreferencesEnvelopeSchema
>;

export const DEFAULT_APP_PREFERENCES: AppPreferences = Object.freeze({
  audio: Object.freeze({
    master: 1,
    music: 0.8,
    sfx: 0.8,
    muted: false,
  }),
  gameplay: Object.freeze({
    defaultSpeed: 1,
    sleepAutoSkip: true,
    dailyIntentionPrompt: true,
  }),
  display: Object.freeze({
    reducedMotion: 'system',
    hudTextScale: 1,
    fractionalScaling: false,
  }),
  accessibility: Object.freeze({
    nonColorUrgency: true,
    screenReaderVerbosity: 'brief',
  }),
});

export function newAppPreferencesEnvelope(): AppPreferencesEnvelope {
  return AppPreferencesEnvelopeSchema.parse({
    schemaVersion: 1,
    preferences: DEFAULT_APP_PREFERENCES,
  });
}

const CommandSchema: z.ZodType<Command> = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('insertPlayer'),
    activityId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('insertWrinkle'),
    wrinkleId: z.string().min(1),
    activityId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('removeCard'),
    cardId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('undoLastRemove'),
    receiptId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('expireRemovalReceipt'),
    receiptId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('moveCard'),
    cardId: z.string().min(1),
    toIndex: z.number().int().min(0),
  }),
  z.strictObject({ type: z.literal('stopCurrent') }),
  z.strictObject({
    type: z.literal('objectClick'),
    activityId: z.string().min(1),
  }),
]);

const GameActionSchema: z.ZodType<GameAction> = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('whyLineOpened'),
    cardId: z.string().min(1),
  }),
  z.strictObject({ type: z.literal('forecastChangeObserved') }),
  z.strictObject({
    type: z.literal('intentionSelected'),
    intentionId: z.string().min(1),
    day: z.number().int().positive(),
    deliberate: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('decorationChosen'),
    wrinkleId: z.string().min(1),
    decorationId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('wrinkleAction'),
    wrinkleId: z.string().min(1),
    actionId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('goalRewardChosen'),
    goalId: z.string().min(1),
    choiceId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('letterResponded'),
    decision: z.enum(['accept', 'decline']),
  }),
]);

export const CareerPayloadSchema = z
  .strictObject({
    rootSeed: Uint32Schema,
    sim: SimStateSchema,
    game: SessionStateSchema,
    identity: IdentityStateSchema,
    prng: PrngSnapshotSchema,
    autonomy: AutonomyModeSchema,
    pendingCommands: z.array(CommandSchema),
    pendingGameActions: z.array(GameActionSchema),
    rulesRevision: z.number().int().min(0),
  })
  .superRefine((payload, ctx) => {
    if (payload.sim.engineVersion !== ENGINE_VERSION) {
      ctx.addIssue({
        code: 'custom',
        message: `sim engine version must be ${ENGINE_VERSION}`,
      });
    }
    if (payload.prng.rootSeed !== payload.rootSeed) {
      ctx.addIssue({
        code: 'custom',
        message: 'PRNG root seed must match the career root seed',
      });
    }
  });
export type CareerPayload = z.infer<typeof CareerPayloadSchema>;

export const StoredCareerSchema = z.strictObject({
  schemaVersion: z.literal(1),
  engineVersion: z.literal(ENGINE_VERSION),
  generation: z.number().int().min(0),
  savedAtEpochMs: z.number().int().min(0),
  careerId: z.string().min(1),
  writerId: z.string().min(1),
  resetFence: z.number().int().min(0),
  payload: CareerPayloadSchema,
});
export type StoredCareer = z.infer<typeof StoredCareerSchema>;
export type CareerState = StoredCareer;

export interface NewCareerInput {
  rootSeed: number;
  sim: SimState;
  identity?: IdentityState;
  game?: SessionState;
  prng?: PrngSnapshot;
  autonomy?: AutonomyMode;
  careerId?: string;
}

export function defaultIdentity(): IdentityState {
  return {
    name: 'Alex',
    pronouns: {
      subject: 'they',
      object: 'them',
      possessive: 'their',
    },
    appearancePresetId: 'morning-blue',
    activePreferenceCategoryIds: ['chronotype', 'workout'],
    foodMoodId: null,
    idlePreferenceId: null,
  };
}

export function newCareerState(input: NewCareerInput): StoredCareer {
  const rootSeed = input.rootSeed >>> 0;
  return StoredCareerSchema.parse({
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    generation: 0,
    savedAtEpochMs: 0,
    careerId: input.careerId ?? `career-${rootSeed}`,
    writerId: 'unowned',
    resetFence: 0,
    payload: {
      rootSeed,
      sim: input.sim,
      game: input.game ?? newSession(),
      identity: input.identity ?? defaultIdentity(),
      prng: input.prng ?? PrngStreams.create(rootSeed).serialize(),
      autonomy: input.autonomy ?? 'full-routine',
      pendingCommands: [],
      pendingGameActions: [],
      rulesRevision: 0,
    },
  });
}

export function restoreCareerState(raw: unknown): StoredCareer {
  return StoredCareerSchema.parse(raw);
}

export function canonicalCareerPayload(payload: CareerPayload): string {
  return JSON.stringify(CareerPayloadSchema.parse(payload));
}

function hashKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Derives the exact announced mechanics for one boundary. No draw happens
 * here; undealt wrinkles are absent from SessionState and therefore invisible.
 */
export function deriveSimRules(
  payload: CareerPayload,
  content: ContentRegistry,
): SimRules {
  const todayIntention = payload.game.intentions.today;
  const currentDay = dayNumber(payload.sim.clock.absoluteMinute);
  const intentionDef =
    todayIntention === null || todayIntention.day !== currentDay
      ? undefined
      : content.intentions.intentions.find(
          (intention) => intention.id === todayIntention.intentionId,
        );
  const intention =
    todayIntention === null || intentionDef === undefined
      ? null
      : {
          id: intentionDef.id,
          selectedDay: todayIntention.day,
          deliberate: todayIntention.deliberate,
          policy: intentionDef.policy,
          workoutsCompletedToday:
            payload.game.recap.forDay === currentDay
              ? payload.game.recap.completedActivityIds.filter(
                  (activityId) =>
                    content.activities.activities.some(
                      (activity) =>
                        activity.id === activityId &&
                        'tags' in activity &&
                        activity.tags?.includes('workout'),
                    ),
                ).length
              : 0,
        };

  const objectBlocks: SimRules['objectBlocks'] = [];
  const activitySlowdowns: SimRules['activitySlowdowns'] = [];
  const activityOverrides: SimRules['activityOverrides'] = [];
  const availabilityGates: SimRules['availabilityGates'] = [];
  const anchorOverrides: SimRules['anchorOverrides'] = [];
  let wakeModifier: SimRules['wakeModifier'] = null;
  const announced = payload.game.wrinkles.announced;
  if (announced !== null) {
    const wrinkle = content.wrinkles.entries.find(
      (entry) => entry.id === announced.wrinkleId,
    );
    const variant = wrinkle?.variants.find(
      (candidate) => candidate.id === announced.variantId,
    );
    if (wrinkle === undefined || variant === undefined) {
      throw new Error(
        `announced wrinkle "${announced.wrinkleId}/${announced.variantId}" is not registered`,
      );
    }
    const source = {
      wrinkleId: wrinkle.id,
      variantId: variant.id,
      day: announced.day,
    };
    const wakeTarget = targetsFor(
      payload.sim.chronotype,
      content.rates,
    ).wake;
    const wakeAbsolute =
      (announced.day - 1) * TICKS_PER_DAY + wakeTarget;
    switch (wrinkle.effect.kind) {
      case 'visitor':
        break;
      case 'blocked-object':
        objectBlocks.push({
          source,
          objectId: wrinkle.effect.objectId,
          startsAtMinute: wakeAbsolute + wrinkle.effect.window[0],
          endsAtMinute: wakeAbsolute + wrinkle.effect.window[1],
          fallbackActivityId: wrinkle.effect.fallbackActivityId,
        });
        break;
      case 'timed-window': {
        const selectedTarget =
          typeof announced.parameters.targetAtWakeOffset === 'number'
            ? announced.parameters.targetAtWakeOffset
            : wrinkle.effect.replacementTargetOffsets[0];
        anchorOverrides.push({
          source,
          anchorId: wrinkle.effect.collidingAnchorId,
          targetAtWakeOffset: selectedTarget,
          suppressed: false,
        });
        break;
      }
      case 'slowed-activity':
        if (announced.parameters.cleared !== true) {
          activitySlowdowns.push({
            source,
            activityTag: wrinkle.effect.activityTag,
            durationFactor: wrinkle.effect.durationFactor,
            clearActivityId: wrinkle.effect.clearActivityId,
          });
        }
        break;
      case 'free-time':
        wakeModifier = {
          source,
          wakeOffsetMin: wrinkle.effect.wakeOffsetMin,
          energy: wrinkle.effect.energy,
        };
        break;
      case 'forced-substitution':
        if (announced.parameters.effectApplied !== true) {
          activityOverrides.push({
            source,
            activityId: wrinkle.effect.targetActivityId,
            nutritionDelta: wrinkle.effect.nutritionDelta,
            countsAsMeal: wrinkle.effect.countsAsMeal,
          });
        }
        break;
      case 'availability-gate':
        availabilityGates.push({
          source,
          activityIds: [...wrinkle.effect.activityIds],
          availableAtMinute:
            wakeAbsolute + wrinkle.effect.availableAtWakeOffset,
        });
        break;
      case 'wake-modifier':
        wakeModifier = {
          source,
          wakeOffsetMin: 0,
          energy: wrinkle.effect.energy,
        };
        break;
    }
  }

  const mechanics = {
    autonomy: payload.autonomy,
    intention,
    preferences: {
      foodMood: payload.identity.foodMoodId,
      // The *variant*, not the preference option that selects it. `foodMoodId` gets away
      // with being passed straight through because its option id and mechanic value are
      // spelled the same; `window-gazer` and `window-gazing` are not, and a field named
      // `idleVariantId` holding an option id is what made every idle flourish undrawable.
      idleVariantId: activeIdleVariantId(
        payload.identity.idlePreferenceId,
        payload.game.goals,
        content,
      ),
    },
    objectBlocks,
    activitySlowdowns,
    activityOverrides,
    availabilityGates,
    anchorOverrides,
    wakeModifier,
    routineMemory: payload.game.unlocks.routineMemory
      ? deriveRoutineMemoryRules(payload.game, content)
      : null,
  };
  const keyMechanics =
    mechanics.preferences.foodMood === null &&
    mechanics.preferences.idleVariantId === null
      ? (({
          preferences: _preferences,
          ...unchangedMechanics
        }) => unchangedMechanics)(mechanics)
      : mechanics;
  return Object.freeze(
    restoreSimRules({
      revision: payload.rulesRevision,
      key: `rules-v1-${hashKey(JSON.stringify(keyMechanics))}`,
      ...mechanics,
    }),
  );
}

function deriveRoutineMemoryRules(
  game: SessionState,
  content: ContentRegistry,
): NonNullable<SimRules['routineMemory']> {
  const days = game.routineMemory.completedDays.slice(-3);
  const missingDays = Math.max(0, 3 - days.length);
  const activityIds = new Set<string>();
  for (const rule of content.reactive.rules) {
    activityIds.add(rule.activity);
    if (rule.supersededBelow !== undefined) {
      activityIds.add(rule.supersededBelow.activity);
    }
  }
  activityIds.add('quickwash');
  const rankByActivity: Record<string, number> = {};
  for (const activityId of activityIds) {
    rankByActivity[activityId] =
      missingDays * game.routineMemory.absentDaySentinel +
      days.reduce(
        (total, day) =>
          total +
          (
            day.firstCompletionPositionByActivity[activityId] ??
            game.routineMemory.absentDaySentinel
          ),
        0,
      );
  }
  return {
    rankByActivity,
    absentRank: 3 * game.routineMemory.absentDaySentinel,
  };
}

/**
 * Every content-backed id the SIM ring persists.
 *
 * The game ring was checked here from the start; the sim ring was not, and an audit
 * proved what the gap costs: a structurally valid save whose queue names an activity the
 * registry has never heard of passes the recovery boundary, constructs a `GameLoop`, and
 * then throws `unknown activity id "…"` out of a frame callback. That is the worst place
 * to learn a save is bad — past the one screen built to hand the player their raw blob.
 *
 * Rejecting here routes exactly that save into the recovery UI instead, or forces a
 * deliberate migration, which is what SPEC §15 asks for.
 */
function validateSimContentRefs(
  sim: SimState,
  known: {
    activityIds: ReadonlySet<string>;
    anchorIds: ReadonlySet<string>;
    wrinkleIds: ReadonlySet<string>;
  },
): void {
  const requireActivity = (activityId: string, where: string): void => {
    if (!known.activityIds.has(activityId)) {
      throw new Error(
        `career ${where} references unknown activity "${activityId}"`,
      );
    }
  };
  const requireAnchor = (anchorId: string, where: string): void => {
    if (!known.anchorIds.has(anchorId)) {
      throw new Error(
        `career ${where} references unknown anchor "${anchorId}"`,
      );
    }
  };

  const checkCard = (card: QueueCard, where: string): void => {
    requireActivity(card.activityId, where);
    // A block id is `${anchorId}#${day}`; the engine splits it back apart to consume the
    // anchor, so a card carrying an unknown anchor is as broken as an unknown activity.
    if (card.blockId !== undefined) {
      requireAnchor(card.blockId.split('#')[0] ?? '', `${where} block`);
    }
    if (card.reason?.kind === 'anchorWindow') {
      requireAnchor(card.reason.anchorId, `${where} reason`);
    }
    if (card.reason?.kind === 'wrinkle' && !known.wrinkleIds.has(card.reason.wrinkleId)) {
      throw new Error(
        `career queue reason references unknown wrinkle "${card.reason.wrinkleId}"`,
      );
    }
  };

  for (const card of sim.queue) checkCard(card, 'queued card');
  if (sim.removalReceipt !== null) {
    checkCard(sim.removalReceipt.card, 'removal receipt card');
    const anchorId = sim.removalReceipt.anchorMutation?.anchorId;
    if (anchorId !== undefined) requireAnchor(anchorId, 'removal receipt');
  }
  if (sim.current?.type === 'activity') {
    requireActivity(sim.current.dto.activityId, 'current activity');
  }
  if (sim.lastCompletion !== null) {
    requireActivity(sim.lastCompletion.activityId, 'last completion');
  }
  for (const activityId of Object.keys(sim.suppression)) {
    requireActivity(activityId, 'suppression');
  }
  for (const anchorId of [
    ...Object.keys(sim.anchorsConsumedOnDay),
    ...Object.keys(sim.anchorMutationGenerations),
  ]) {
    requireAnchor(anchorId, 'anchor ledger');
  }
}

export function validateCareerContentRefs(
  career: StoredCareer,
  content: ContentRegistry,
): void {
  const payload = career.payload;
  const goalIds = new Set(content.goals.goals.map((goal) => goal.id));
  const intentionIds = new Set(
    content.intentions.intentions.map((intention) => intention.id),
  );
  const wrinkleIds = new Set(
    content.wrinkles.entries.map((wrinkle) => wrinkle.id),
  );
  const wrinkleActionKeys = new Set(
    content.wrinkles.entries.flatMap((wrinkle) =>
      wrinkle.variants.map(
        (variant) =>
          `${wrinkle.id}/${variant.playerAction.id}`,
      ),
    ),
  );
  const decorationIds = new Set(
    [
      'leafy-plant',
      'sunny-vase',
      ...content.goals.rewards.flatMap((reward) =>
        reward.kind === 'decoration' ? reward.decorationIds : [],
      ),
    ],
  );
  const goalRewardChoiceKeys = new Set(
    content.goals.goals.flatMap((goal) => {
      const reward = content.goals.rewards.find(
        (candidate) => candidate.id === goal.rewardId,
      );
      return reward?.kind === 'decoration'
        ? reward.decorationIds.map(
            (decorationId) => `${goal.id}/${decorationId}`,
          )
        : [];
    }),
  );
  const storyletIds = new Set(
    content.storylets.storylets.map((storylet) => storylet.id),
  );
  const stringIds = new Set(content.strings.ids);
  const activityIds = new Set(
    content.activities.activities.map((activity) => activity.id),
  );
  const appearanceIds = new Set(
    content.identity.appearancePresets.map((preset) => preset.id),
  );
  const categoriesById = new Map(
    content.identity.preferenceCategories.map((category) => [
      category.id,
      category,
    ]),
  );
  for (const goalId of Object.keys(payload.game.goals)) {
    if (!goalIds.has(goalId)) {
      throw new Error(`career references unknown goal "${goalId}"`);
    }
  }
  for (const decorationId of payload.game.decorations.grantedIds) {
    if (!decorationIds.has(decorationId)) {
      throw new Error(
        `career references unknown decoration "${decorationId}"`,
      );
    }
  }
  const intention = payload.game.intentions.today;
  if (intention !== null && !intentionIds.has(intention.intentionId)) {
    throw new Error(
      `career references unknown intention "${intention.intentionId}"`,
    );
  }
  for (const id of [
    ...payload.game.wrinkles.firedIds,
    ...payload.game.wrinkles.resolvedIds,
    ...payload.game.wrinkles.recentDealtIds,
    ...payload.game.wrinkles.remainingDeckIds,
  ]) {
    if (!wrinkleIds.has(id)) {
      throw new Error(`career references unknown wrinkle "${id}"`);
    }
  }
  if (!appearanceIds.has(payload.identity.appearancePresetId)) {
    throw new Error(
      `career references unknown appearance preset "${payload.identity.appearancePresetId}"`,
    );
  }
  for (const categoryId of payload.identity.activePreferenceCategoryIds) {
    if (!categoriesById.has(categoryId)) {
      throw new Error(
        `career references unknown preference category "${categoryId}"`,
      );
    }
  }
  for (const entry of payload.game.journal.entries) {
    if (!stringIds.has(entry.stringId)) {
      throw new Error(
        `career journal references unknown string "${entry.stringId}"`,
      );
    }
    if (!storyletIds.has(entry.sourceId)) {
      throw new Error(
        `career journal references unknown storylet "${entry.sourceId}"`,
      );
    }
  }
  for (const command of payload.pendingCommands) {
    if (
      (command.type === 'insertPlayer' ||
        command.type === 'objectClick' ||
        command.type === 'insertWrinkle') &&
      !activityIds.has(command.activityId)
    ) {
      throw new Error(
        `career pending command references unknown activity "${command.activityId}"`,
      );
    }
  }
  validateSimContentRefs(payload.sim, {
    activityIds,
    anchorIds: new Set(content.anchors.anchors.map((anchor) => anchor.id)),
    wrinkleIds,
  });
  for (const action of payload.pendingGameActions) {
    if (
      action.type === 'intentionSelected' &&
      !intentionIds.has(action.intentionId)
    ) {
      throw new Error(
        `career pending action references unknown intention "${action.intentionId}"`,
      );
    }
    if (
      action.type === 'wrinkleAction' &&
      !wrinkleActionKeys.has(
        `${action.wrinkleId}/${action.actionId}`,
      )
    ) {
      throw new Error(
        `career pending action references unknown wrinkle action "${action.wrinkleId}/${action.actionId}"`,
      );
    }
    if (
      action.type === 'goalRewardChosen' &&
      !goalRewardChoiceKeys.has(
        `${action.goalId}/${action.choiceId}`,
      )
    ) {
      throw new Error(
        `career pending action references unknown goal reward choice "${action.goalId}/${action.choiceId}"`,
      );
    }
  }
  deriveSimRules(payload, content);
}

const LegacyFixtureSchema = z.looseObject({
  fixtureVersion: z.literal(1),
  sourceEngineVersion: z.union([z.literal(6), z.literal(7)]),
  synthetic: z.literal(true),
  rootSeed: Uint32Schema,
  sim: z.unknown(),
  game: z.unknown(),
});

const EngineV8CareerSchema = z.looseObject({
  schemaVersion: z.literal(1),
  engineVersion: z.literal(8),
  payload: z.looseObject({
    sim: z.looseObject({
      engineVersion: z.literal(8),
    }),
  }),
});

/**
 * Relocates the untouched five PRNG records from legacy SimState into the P5
 * career envelope. No stream is replayed and no draw count is inferred.
 */
export function migrateLegacyCareerFixture(
  raw: unknown,
  content: ContentRegistry,
): StoredCareer {
  const legacy = LegacyFixtureSchema.parse(raw);
  if (
    legacy.sim === null ||
    typeof legacy.sim !== 'object' ||
    Array.isArray(legacy.sim)
  ) {
    throw new Error('legacy fixture sim is not an object');
  }
  const simRecord = {
    ...(legacy.sim as Record<string, unknown>),
  };
  const prng = PrngSnapshotSchema.parse(simRecord.prng);
  delete simRecord.prng;
  simRecord.engineVersion = ENGINE_VERSION;
  const sim = restoreSimState(simRecord);
  const career = newCareerState({
    rootSeed: legacy.rootSeed,
    sim,
    game: restoreSession(legacy.game),
    prng,
    careerId: `synthetic-v${legacy.sourceEngineVersion}`,
  });
  validateCareerContentRefs(career, content);
  return career;
}

/**
 * Accepts only explicitly known older formats. Unknown future engine versions
 * still fail closed and remain available through the recovery UI.
 */
export function migrateKnownCareer(
  raw: unknown,
  content: ContentRegistry,
): StoredCareer {
  const engineV8 = EngineV8CareerSchema.safeParse(raw);
  if (!engineV8.success) {
    return migrateLegacyCareerFixture(raw, content);
  }
  const career = restoreCareerState({
    ...engineV8.data,
    engineVersion: ENGINE_VERSION,
    payload: {
      ...engineV8.data.payload,
      sim: {
        ...engineV8.data.payload.sim,
        engineVersion: ENGINE_VERSION,
      },
    },
  });
  validateCareerContentRefs(career, content);
  return career;
}
