import rawRates from '../../content/rates.json';
import rawActivities from '../../content/activities.json';
import rawAnchors from '../../content/anchors.json';
import rawReactive from '../../content/reactive.json';
import rawAdjacency from '../../content/adjacency.json';
import rawPractice from '../../content/practice.json';
import rawHomeMap from '../../content/home-map.json';
import rawObjects from '../../content/objects.json';
import rawAudio from '../../content/audio.json';
import rawGoals from '../../content/goals.json';
import rawIntentions from '../../content/intentions.json';
import rawWrinkles from '../../content/wrinkles.json';
import rawStorylets from '../../content/storylets.json';
import rawIdentity from '../../content/identity.json';
import rawQueueStrings from '../../content/strings/queue.json';
import rawFirstSessionStrings from '../../content/strings/first-session.json';
import rawGoalStrings from '../../content/strings/goals.json';
import rawIntentionStrings from '../../content/strings/intentions.json';
import rawIdentityStrings from '../../content/strings/identity.json';
import rawWrinkleStrings from '../../content/strings/wrinkles.json';
import rawStoryletStrings from '../../content/strings/storylets.json';
import rawAppShellStrings from '../../content/strings/app-shell.json';
import rawSettingsStrings from '../../content/strings/settings.json';
import rawLetterStrings from '../../content/strings/letter.json';
import { ratePerMinuteFixed } from './fixed';
import {
  ActivitiesSchema,
  AdjacencySchema,
  AnchorsSchema,
  HomeMapSchema,
  ObjectsSchema,
  PracticeSchema,
  RatesSchema,
  ReactiveSchema,
  GoalsSchema,
  IdentitySchema,
  IntentionsSchema,
  StoryletsSchema,
  StringCatalogSchema,
  WrinklesSchema,
  type ActivitiesConfig,
  type AdjacencyConfig,
  type AnchorsConfig,
  type GoalsConfig,
  type HomeMapConfig,
  type IdentityConfig,
  type IntentionsConfig,
  type ObjectsConfig,
  type PracticeConfig,
  type RatesConfig,
  type ReactiveConfig,
  type StoryletsConfig,
  type StringCatalog,
  type WrinkleEffect,
  type WrinklesConfig,
  AudioSchema,
  type AudioConfig,
} from './content-schemas';

/**
 * The one runtime import path for content. Raw JSON is parsed exactly once here;
 * everything else (runtime and tests alike) imports the typed result.
 * New content files register here — never in a second, tests-only list.
 */
export interface ContentRegistry {
  rates: RatesConfig;
  activities: ActivitiesConfig;
  anchors: AnchorsConfig;
  reactive: ReactiveConfig;
  adjacency: AdjacencyConfig;
  practice: PracticeConfig;
  homeMap: HomeMapConfig;
  objects: ObjectsConfig;
  /** SPEC §14 cue bank wiring (P6 T8). Presentation only — never read by the planner. */
  audio: AudioConfig;
  goals: GoalsConfig;
  intentions: IntentionsConfig;
  wrinkles: WrinklesConfig;
  storylets: StoryletsConfig;
  identity: IdentityConfig;
  strings: StringCatalog;
}

/**
 * Cross-file invariants that individual JSON schemas cannot prove. Keep this
 * at the content boundary so a bad authored registry fails validation rather
 * than reaching a live tick, forecast, or UI lookup.
 */
export function validateContentRegistry(registry: ContentRegistry): void {
  const activitiesById = new Map(
    registry.activities.activities.map((activity) => [
      activity.id,
      activity,
    ]),
  );
  const objectsById = new Map(
    registry.objects.objects.map((object) => [object.id, object]),
  );
  const ownersByActivity = new Map<string, string[]>();
  const requireActivity = (
    activityId: string,
    owner: string,
  ): void => {
    if (!activitiesById.has(activityId)) {
      throw new Error(
        `invalid content registry: ${owner} references unknown activity "${activityId}"`,
      );
    }
  };
  const requireObject = (objectId: string, owner: string): void => {
    if (!objectsById.has(objectId)) {
      throw new Error(
        `invalid content registry: ${owner} references unknown object "${objectId}"`,
      );
    }
  };
  const anchorsById = new Map(
    registry.anchors.anchors.map((anchor) => [anchor.id, anchor]),
  );
  const requireAnchor = (anchorId: string, owner: string): void => {
    if (!anchorsById.has(anchorId)) {
      throw new Error(
        `invalid content registry: ${owner} references unknown anchor "${anchorId}"`,
      );
    }
  };
  const stringIds = new Set(registry.strings.ids);
  if (stringIds.size !== registry.strings.ids.length) {
    throw new Error('invalid content registry: duplicate string IDs');
  }
  const requireString = (stringId: string, owner: string): void => {
    if (!stringIds.has(stringId)) {
      throw new Error(
        `invalid content registry: ${owner} references unknown string "${stringId}"`,
      );
    }
  };
  const requireUniqueIds = (
    values: readonly { id: string }[],
    owner: string,
  ): void => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value.id)) {
        throw new Error(
          `invalid content registry: duplicate ${owner} id "${value.id}"`,
        );
      }
      seen.add(value.id);
    }
  };
  const requireWindow = (
    window: readonly [number, number],
    owner: string,
  ): void => {
    if (
      !Number.isInteger(window[0]) ||
      !Number.isInteger(window[1]) ||
      window[0] < -1439 ||
      window[1] > 1439 ||
      window[0] >= window[1]
    ) {
      throw new Error(
        `invalid content registry: ${owner} has invalid window ${window[0]}..${window[1]}`,
      );
    }
  };

  /**
   * Activity ids the engine itself names, rather than reading from content.
   *
   * The routine planner maps a need to a fixed id (`snack`, `quickwash`, `stretch`) and
   * falls back to `read` for productive free time. Those four were the only engine-
   * referenced ids nothing validated, so renaming one in `activities.json` passed every
   * content gate and then produced a routine plan of cards for activities that do not
   * exist — a failure that surfaces during play rather than at the content boundary, which
   * is the whole reason this function exists.
   */
  for (const activityId of ['read', 'snack', 'quickwash', 'stretch']) {
    requireActivity(activityId, 'the routine planner');
  }

  for (const object of registry.objects.objects) {
    for (const activityId of object.activities) {
      requireActivity(activityId, `object "${object.id}"`);
      const owners = ownersByActivity.get(activityId) ?? [];
      owners.push(object.id);
      ownersByActivity.set(activityId, owners);
    }
  }

  for (const activity of registry.activities.activities) {
    if (!objectsById.has(activity.object)) {
      throw new Error(
        `invalid content registry: activity "${activity.id}" references unknown object "${activity.object}"`,
      );
    }
    const owners = ownersByActivity.get(activity.id) ?? [];
    if (owners.length !== 1 || owners[0] !== activity.object) {
      throw new Error(
        `invalid content registry: activity "${activity.id}" must be owned exactly once by object "${activity.object}", found ${owners.join(', ') || 'none'}`,
      );
    }
  }

  for (const anchor of registry.anchors.anchors) {
    for (const activityId of anchor.block) {
      if (activityId === '__preferredWorkout') {
        requireActivity('weights', `anchor "${anchor.id}"`);
        requireActivity('treadmill', `anchor "${anchor.id}"`);
      } else {
        requireActivity(activityId, `anchor "${anchor.id}"`);
      }
    }
  }

  for (const rule of registry.reactive.rules) {
    requireActivity(rule.activity, `reactive rule "${rule.id}"`);
    if (rule.supersededBelow !== undefined) {
      requireActivity(
        rule.supersededBelow.activity,
        `reactive rule "${rule.id}"`,
      );
    }
  }

  for (const pair of registry.adjacency.pairs) {
    if (pair.first !== undefined) {
      requireActivity(pair.first, `adjacency pair "${pair.id}"`);
    } else if (
      !registry.activities.activities.some((activity) =>
        activity.kind === 'timed' &&
        activity.tags?.includes(pair.firstTag!),
      )
    ) {
      throw new Error(
        `invalid content registry: adjacency pair "${pair.id}" references unused first tag "${pair.firstTag}"`,
      );
    }
    if (pair.second !== undefined) {
      requireActivity(pair.second, `adjacency pair "${pair.id}"`);
    } else if (
      !registry.activities.activities.some((activity) =>
        activity.kind === 'timed' &&
        activity.tags?.includes(pair.secondTag!),
      )
    ) {
      throw new Error(
        `invalid content registry: adjacency pair "${pair.id}" references unused second tag "${pair.secondTag}"`,
      );
    }
  }

  for (const bar of ['energy', 'nutrition', 'movement', 'hygiene'] as const) {
    const modifiers = registry.adjacency.pairs.flatMap((pair) =>
      pair.effect.kind === 'scaleDecay' && pair.effect.bar === bar
        ? [{ id: pair.id, factor: pair.effect.factor }]
        : [],
    );
    if (modifiers.length === 0) continue;
    for (const mode of ['awake', 'asleep'] as const) {
      const rate = registry.rates.rates[bar][mode];
      const reachableDeltas = new Set<number>([
        ratePerMinuteFixed(rate),
      ]);
      for (const modifier of modifiers) {
        const priorDeltas = [...reachableDeltas];
        for (const delta of priorDeltas) {
          const scaled = delta * modifier.factor;
          if (!Number.isInteger(scaled)) {
            throw new Error(
              `invalid content registry: scaleDecay "${modifier.id}" does not preserve the integer fixed-point grid for ${bar}.${mode} (${delta} × ${modifier.factor})`,
            );
          }
          reachableDeltas.add(scaled);
        }
      }
    }
  }

  requireUniqueIds(registry.goals.rewards, 'reward');
  requireUniqueIds(registry.goals.goals, 'goal');
  const rewardsById = new Map(
    registry.goals.rewards.map((reward) => [reward.id, reward]),
  );
  const goalsById = new Map(
    registry.goals.goals.map((goal) => [goal.id, goal]),
  );
  const goalOrders = new Set<number>();
  for (const reward of registry.goals.rewards) {
    requireString(reward.labelStringId, `reward "${reward.id}"`);
  }
  for (const goal of registry.goals.goals) {
    if (goalOrders.has(goal.order)) {
      throw new Error(
        `invalid content registry: duplicate goal order "${goal.order}"`,
      );
    }
    goalOrders.add(goal.order);
    if (!rewardsById.has(goal.rewardId)) {
      throw new Error(
        `invalid content registry: goal "${goal.id}" references unknown reward "${goal.rewardId}"`,
      );
    }
    requireString(goal.titleStringId, `goal "${goal.id}"`);
    requireString(goal.instructionStringId, `goal "${goal.id}"`);
    if (
      goal.condition.kind === 'balanced-streak' &&
      (goal.condition.days < 2 ||
        goal.condition.practiceSessionsPerDay < 1 ||
        goal.condition.sampleAtWakeOffset < 0)
    ) {
      throw new Error(
        `invalid content registry: goal "${goal.id}" has an impossible success condition`,
      );
    }
  }

  requireUniqueIds(registry.intentions.intentions, 'intention');
  const intentionsById = new Map(
    registry.intentions.intentions.map((intention) => [
      intention.id,
      intention,
    ]),
  );
  if (!intentionsById.has(registry.intentions.defaultId)) {
    throw new Error(
      `invalid content registry: unknown default intention "${registry.intentions.defaultId}"`,
    );
  }
  for (const intention of registry.intentions.intentions) {
    requireString(intention.labelStringId, `intention "${intention.id}"`);
    requireString(
      intention.descriptionStringId,
      `intention "${intention.id}"`,
    );
    switch (intention.policy.kind) {
      case 'balanced':
        break;
      case 'take-it-easy':
        requireAnchor(
          intention.policy.suppressAnchorId,
          `intention "${intention.id}"`,
        );
        break;
      case 'get-moving':
        requireActivity(
          intention.policy.suggestActivityId,
          `intention "${intention.id}"`,
        );
        break;
      case 'eat-properly':
        requireActivity(
          intention.policy.preferActivityId,
          `intention "${intention.id}"`,
        );
        break;
      case 'practice-focus':
        requireActivity(
          intention.policy.suggestedActivityId,
          `intention "${intention.id}"`,
        );
        break;
    }
    if (intention.biasTarget.kind === 'activity') {
      for (const activityId of intention.biasTarget.activityIds) {
        requireActivity(activityId, `intention "${intention.id}"`);
      }
    } else if (intention.biasTarget.kind === 'activity-tag') {
      const tag = intention.biasTarget.tag;
      if (
        !registry.activities.activities.some(
          (activity) =>
            activity.kind === 'timed' && activity.tags?.includes(tag),
        )
      ) {
        throw new Error(
          `invalid content registry: intention "${intention.id}" references unused activity tag "${tag}"`,
        );
      }
    }
  }

  requireUniqueIds(registry.identity.appearancePresets, 'appearance preset');
  requireUniqueIds(
    registry.identity.preferenceCategories,
    'preference category',
  );
  const chronotypeCategory = registry.identity.preferenceCategories.find(
    (category) => category.id === 'chronotype',
  );
  if (
    chronotypeCategory === undefined ||
    !chronotypeCategory.alwaysActive ||
    chronotypeCategory.options.length !== 2 ||
    chronotypeCategory.options.some(
      (option) => option.mechanic.kind !== 'chronotype',
    )
  ) {
    throw new Error(
      'invalid content registry: chronotype must be the always-active two-option preference',
    );
  }
  const preferenceOptionIds = new Set<string>();
  for (const preset of registry.identity.appearancePresets) {
    requireString(
      preset.labelStringId,
      `appearance preset "${preset.id}"`,
    );
  }
  for (const category of registry.identity.preferenceCategories) {
    requireString(
      category.labelStringId,
      `preference category "${category.id}"`,
    );
    for (const option of category.options) {
      if (preferenceOptionIds.has(option.id)) {
        throw new Error(
          `invalid content registry: duplicate preference option id "${option.id}"`,
        );
      }
      preferenceOptionIds.add(option.id);
      requireString(
        option.labelStringId,
        `preference option "${option.id}"`,
      );
      if (option.mechanic.kind === 'preferred-workout') {
        requireActivity(
          option.mechanic.activityId,
          `preference option "${option.id}"`,
        );
      }
    }
  }

  requireUniqueIds(registry.wrinkles.entries, 'wrinkle');
  const wrinklesById = new Map(
    registry.wrinkles.entries.map((wrinkle) => [wrinkle.id, wrinkle]),
  );
  const expectedSuccess: Record<
    WrinkleEffect['kind'],
    string
  > = {
    visitor: 'queue-slot-free',
    'blocked-object': 'one-of-activities-completed',
    'timed-window': 'anchor-rescheduled',
    'slowed-activity': 'activity-completed',
    'free-time': 'activity-completed',
    'forced-substitution': 'activity-completed',
    'availability-gate': 'activity-completed',
    'wake-modifier': 'activity-completed',
  };
  const expectedAction: Record<
    WrinkleEffect['kind'],
    string
  > = {
    visitor: 'keep-slot-free',
    'blocked-object': 'reroute-or-reschedule',
    'timed-window': 'reschedule-anchor',
    'slowed-activity': 'schedule-recovery',
    'free-time': 'use-free-time',
    'forced-substitution': 'plan-recovery',
    'availability-gate': 'use-alternative',
    'wake-modifier': 'recover-energy',
  };
  const variantIds = new Set<string>();
  const actionIds = new Set<string>();
  for (const wrinkle of registry.wrinkles.entries) {
    const mechanic = wrinkle.effect.kind as WrinkleEffect['kind'];
    if (!(mechanic in expectedSuccess)) {
      throw new Error(
        `invalid content registry: wrinkle "${wrinkle.id}" has an unowned mechanic "${String(mechanic)}"`,
      );
    }
    if (wrinkle.success.kind !== expectedSuccess[mechanic]) {
      throw new Error(
        `invalid content registry: wrinkle "${wrinkle.id}" has an impossible success condition "${wrinkle.success.kind}" for "${mechanic}"`,
      );
    }
    switch (wrinkle.effect.kind) {
      case 'visitor':
        requireActivity(
          wrinkle.effect.activityId,
          `wrinkle "${wrinkle.id}"`,
        );
        requireWindow(wrinkle.effect.window, `wrinkle "${wrinkle.id}"`);
        if (
          wrinkle.effect.durationMin >
          wrinkle.effect.window[1] - wrinkle.effect.window[0]
        ) {
          throw new Error(
            `invalid content registry: wrinkle "${wrinkle.id}" has an impossible visitor window`,
          );
        }
        break;
      case 'blocked-object': {
        requireObject(wrinkle.effect.objectId, `wrinkle "${wrinkle.id}"`);
        requireWindow(wrinkle.effect.window, `wrinkle "${wrinkle.id}"`);
        requireActivity(
          wrinkle.effect.fallbackActivityId,
          `wrinkle "${wrinkle.id}"`,
        );
        const fallback = activitiesById.get(
          wrinkle.effect.fallbackActivityId,
        );
        if (fallback?.object === wrinkle.effect.objectId) {
          throw new Error(
            `invalid content registry: wrinkle "${wrinkle.id}" blocks its own fallback`,
          );
        }
        break;
      }
      case 'timed-window':
        requireActivity(
          wrinkle.effect.activityId,
          `wrinkle "${wrinkle.id}"`,
        );
        requireWindow(wrinkle.effect.window, `wrinkle "${wrinkle.id}"`);
        requireAnchor(
          wrinkle.effect.collidingAnchorId,
          `wrinkle "${wrinkle.id}"`,
        );
        if (
          wrinkle.effect.replacementTargetOffsets[0] ===
          wrinkle.effect.replacementTargetOffsets[1]
        ) {
          throw new Error(
            `invalid content registry: wrinkle "${wrinkle.id}" needs two distinct anchor choices`,
          );
        }
        break;
      case 'slowed-activity':
        requireActivity(
          wrinkle.effect.clearActivityId,
          `wrinkle "${wrinkle.id}"`,
        );
        {
          const tag = wrinkle.effect.activityTag;
        if (
          !registry.activities.activities.some(
            (activity) =>
              activity.kind === 'timed' &&
                activity.tags?.includes(tag),
          )
        ) {
          throw new Error(
            `invalid content registry: wrinkle "${wrinkle.id}" references an unused activity tag`,
          );
        }
        }
        break;
      case 'free-time':
      case 'wake-modifier':
        break;
      case 'forced-substitution':
        requireActivity(
          wrinkle.effect.targetActivityId,
          `wrinkle "${wrinkle.id}"`,
        );
        break;
      case 'availability-gate':
        for (const activityId of wrinkle.effect.activityIds) {
          requireActivity(activityId, `wrinkle "${wrinkle.id}"`);
        }
        break;
    }
    switch (wrinkle.success.kind) {
      case 'queue-slot-free':
        requireWindow(wrinkle.success.window, `wrinkle "${wrinkle.id}" success`);
        if (
          wrinkle.success.durationMin >
          wrinkle.success.window[1] - wrinkle.success.window[0]
        ) {
          throw new Error(
            `invalid content registry: wrinkle "${wrinkle.id}" has an impossible success window`,
          );
        }
        break;
      case 'activity-completed':
        requireActivity(
          wrinkle.success.activityId,
          `wrinkle "${wrinkle.id}" success`,
        );
        break;
      case 'one-of-activities-completed':
        for (const activityId of wrinkle.success.activityIds) {
          requireActivity(activityId, `wrinkle "${wrinkle.id}" success`);
        }
        break;
      case 'anchor-rescheduled':
        requireAnchor(
          wrinkle.success.anchorId,
          `wrinkle "${wrinkle.id}" success`,
        );
        break;
    }
    for (const variant of wrinkle.variants) {
      if (variantIds.has(variant.id)) {
        throw new Error(
          `invalid content registry: duplicate wrinkle variant id "${variant.id}"`,
        );
      }
      variantIds.add(variant.id);
      if (variant.playerAction === undefined) {
        throw new Error(
          `invalid content registry: wrinkle variant "${variant.id}" has no explicit player action`,
        );
      }
      if (actionIds.has(variant.playerAction.id)) {
        throw new Error(
          `invalid content registry: duplicate wrinkle action id "${variant.playerAction.id}"`,
        );
      }
      actionIds.add(variant.playerAction.id);
      if (variant.playerAction.kind !== expectedAction[mechanic]) {
        throw new Error(
          `invalid content registry: wrinkle variant "${variant.id}" has action "${variant.playerAction.kind}" but mechanic "${mechanic}" requires "${expectedAction[mechanic]}"`,
        );
      }
      requireString(
        variant.titleStringId,
        `wrinkle variant "${variant.id}"`,
      );
      requireString(
        variant.introStringId,
        `wrinkle variant "${variant.id}"`,
      );
      requireString(
        variant.successStringId,
        `wrinkle variant "${variant.id}"`,
      );
      requireString(
        variant.failureStringId,
        `wrinkle variant "${variant.id}"`,
      );
      requireString(
        variant.outcomeStringId,
        `wrinkle variant "${variant.id}"`,
      );
      requireString(
        variant.playerAction.labelStringId,
        `wrinkle action "${variant.playerAction.id}"`,
      );
    }
  }

  requireUniqueIds(registry.storylets.storylets, 'storylet');
  for (const storylet of registry.storylets.storylets) {
    requireString(storylet.stringId, `storylet "${storylet.id}"`);
    switch (storylet.source.kind) {
      case 'wrinkle-outcome':
        if (!wrinklesById.has(storylet.source.wrinkleId)) {
          throw new Error(
            `invalid content registry: storylet "${storylet.id}" references unknown wrinkle "${storylet.source.wrinkleId}"`,
          );
        }
        break;
      case 'idle-moment':
        requireActivity(
          storylet.source.activityId,
          `storylet "${storylet.id}"`,
        );
        break;
      case 'milestone':
        if (!goalsById.has(storylet.source.goalId)) {
          throw new Error(
            `invalid content registry: storylet "${storylet.id}" references unknown goal "${storylet.source.goalId}"`,
          );
        }
        break;
    }
  }
}

function authoredStringIds(
  file: string,
  value: unknown,
  path: string[] = [],
): string[] {
  if (typeof value === 'string') {
    return [`${file}:${path.join('.')}`];
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `invalid authored string catalog at "${file}:${path.join('.')}"`,
    );
  }
  return Object.entries(value).flatMap(([key, child]) =>
    authoredStringIds(file, child, [...path, key]),
  );
}

const parsedContent: ContentRegistry = {
  rates: RatesSchema.parse(rawRates),
  activities: ActivitiesSchema.parse(rawActivities),
  anchors: AnchorsSchema.parse(rawAnchors),
  reactive: ReactiveSchema.parse(rawReactive),
  adjacency: AdjacencySchema.parse(rawAdjacency),
  practice: PracticeSchema.parse(rawPractice),
  homeMap: HomeMapSchema.parse(rawHomeMap),
  objects: ObjectsSchema.parse(rawObjects),
  audio: AudioSchema.parse(rawAudio),
  goals: GoalsSchema.parse(rawGoals),
  intentions: IntentionsSchema.parse(rawIntentions),
  wrinkles: WrinklesSchema.parse(rawWrinkles),
  storylets: StoryletsSchema.parse(rawStorylets),
  identity: IdentitySchema.parse(rawIdentity),
  strings: StringCatalogSchema.parse({
    ids: [
      ...authoredStringIds('queue', rawQueueStrings),
      ...authoredStringIds('first-session', rawFirstSessionStrings),
      ...authoredStringIds('goals', rawGoalStrings),
      ...authoredStringIds('intentions', rawIntentionStrings),
      ...authoredStringIds('identity', rawIdentityStrings),
      ...authoredStringIds('wrinkles', rawWrinkleStrings),
      ...authoredStringIds('storylets', rawStoryletStrings),
      ...authoredStringIds('app-shell', rawAppShellStrings),
      ...authoredStringIds('settings', rawSettingsStrings),
      ...authoredStringIds('letter', rawLetterStrings),
    ],
  }),
};
validateContentRegistry(parsedContent);
export const content = parsedContent;

/** Registry-scoped lookups: the engine resolves ONLY through these — a step()
 * caller's registry is the single source of truth (audit round 3: the globals
 * silently shadowed injected content for activities/objects). */
export function objectForActivityIn(registry: ContentRegistry, activityId: string) {
  const owners = registry.objects.objects.filter((o) => o.activities.includes(activityId));
  if (owners.length !== 1) throw new Error(`activity "${activityId}" must have exactly one object owner, found ${owners.length}`);
  const owner = owners[0];
  if (!owner) throw new Error('unreachable');
  return owner;
}

export function objectForActivity(activityId: string) {
  return objectForActivityIn(content, activityId);
}

export function activityByIdIn(registry: ContentRegistry, id: string) {
  const def = registry.activities.activities.find((a) => a.id === id);
  if (!def) throw new Error(`unknown activity id "${id}"`);
  return def;
}

export function activityById(id: string) {
  return activityByIdIn(content, id);
}
