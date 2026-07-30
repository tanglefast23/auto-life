import type {
  IdentityState,
  StoredCareer,
} from '../application/career-state';
import { content } from '../sim/content';
import type { SimState } from '../sim/state';
import { identityString } from './identity-copy';

export interface ActivePreferenceTag {
  categoryId: string;
  label: string;
  activityIds: readonly string[];
  preferredActivityIds: readonly string[];
  alternativeActivityIds: readonly string[];
}

export interface PreferenceReaction {
  kind: 'happy' | 'grumble';
  label: string;
}

export function activePreferenceTags(
  identity: IdentityState,
  sim: SimState,
): ActivePreferenceTag[] {
  return identity.activePreferenceCategoryIds.flatMap((categoryId) => {
    // `baseline` exists only in synthetic migration/test fixtures and has no
    // player-facing preference. Real new careers always roll early or owl.
    if (categoryId === 'chronotype' && sim.chronotype === 'baseline') {
      return [];
    }
    const category = content.identity.preferenceCategories.find(
      (candidate) => candidate.id === categoryId,
    );
    if (category === undefined) {
      throw new Error(`unknown active preference category "${categoryId}"`);
    }
    const option = category.options.find((candidate) => {
      switch (candidate.mechanic.kind) {
        case 'chronotype':
          return candidate.mechanic.value === sim.chronotype;
        case 'preferred-workout':
          return candidate.mechanic.activityId === sim.preferredWorkout;
        case 'food-mood':
          return candidate.id === identity.foodMoodId;
        case 'idle-variant':
          return candidate.id === identity.idlePreferenceId;
      }
    });
    if (option === undefined) {
      throw new Error(`active preference "${categoryId}" has no value`);
    }
    const activityIds =
      categoryId === 'chronotype'
        ? ['sleep']
        : categoryId === 'workout'
          ? [sim.preferredWorkout]
          : categoryId === 'food'
            ? ['meal', 'snack']
            : ['idle'];
    const preferredActivityIds =
      categoryId === 'chronotype'
        ? ['sleep']
        : categoryId === 'workout'
          ? [sim.preferredWorkout]
          : categoryId === 'food'
            ? option.id === 'proper-meals'
              ? ['meal']
              : ['snack']
            : ['idle'];
    const alternativeActivityIds =
      categoryId === 'workout'
        ? [sim.preferredWorkout === 'weights' ? 'treadmill' : 'weights']
        : categoryId === 'food'
          ? preferredActivityIds[0] === 'meal'
            ? ['snack']
            : ['meal']
          : [];
    return [{
      categoryId,
      label: identityString(option.labelStringId),
      activityIds,
      preferredActivityIds,
      alternativeActivityIds,
    }];
  });
}

export function careerPreferenceTags(
  career: StoredCareer,
): ActivePreferenceTag[] {
  return activePreferenceTags(
    career.payload.identity,
    career.payload.sim,
  );
}

/**
 * Cosmetic only: read completed activities and choose a bubble. No queue or
 * sim command reads this result, so a preference can never disobey the player.
 */
export function preferenceReaction(
  completedActivityIds: readonly string[],
  tags: readonly ActivePreferenceTag[],
): PreferenceReaction | null {
  let latest:
    | { index: number; reaction: PreferenceReaction }
    | null = null;
  for (const tag of tags) {
    const relevant = completedActivityIds
      .map((activityId, index) => ({ activityId, index }))
      .filter(
        ({ activityId }) =>
          tag.preferredActivityIds.includes(activityId) ||
          tag.alternativeActivityIds.includes(activityId),
      );
    const last = relevant.at(-1);
    if (last === undefined) continue;
    let kind: PreferenceReaction['kind'] | null = null;
    if (tag.preferredActivityIds.includes(last.activityId)) {
      kind = 'happy';
    } else {
      const prior = relevant.at(-2);
      if (
        prior !== undefined &&
        tag.alternativeActivityIds.includes(prior.activityId)
      ) {
        kind = 'grumble';
      }
    }
    if (
      kind !== null &&
      (latest === null || last.index > latest.index)
    ) {
      latest = {
        index: last.index,
        reaction: { kind, label: tag.label },
      };
    }
  }
  return latest?.reaction ?? null;
}
