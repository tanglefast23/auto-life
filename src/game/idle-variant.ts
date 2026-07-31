import type { ContentRegistry } from '../sim/content';
import { rewardForGoal } from './goals';
import type { SessionState } from './session';

/**
 * Which idle flourish the sim is currently wearing (SPEC §12 Goal 4, §11.6 identity).
 *
 * Three ids spell one concept and none of them lined up. Identity stores a *preference
 * option* id (`window-gazer`), the atlas packs a *variant* pose (`idle-window-gazing`),
 * and Goal 4's reward names a third (`air-guitar`). `ApplicationRoot` handed the option
 * id straight to `WorldScene`, which looked up `idle-window-gazer`, found no frames, and
 * fell back to the plain idle pose — the quietest possible failure, because a missing
 * flourish raises nothing. Goal 4 was worse off still: `tick.ts` marked the reward
 * applied and stopped there, so "First chord" granted a behaviour that was written down
 * nowhere at all. All four authored idle sprites were unreachable through this path.
 *
 * Nothing new is persisted to fix it. A rewarded goal is already durable session state,
 * so the active variant is **derived** rather than stored: one source of truth, and no
 * save migration for a cosmetic.
 */

/**
 * Every idle variant v1 content can put on the sim, in authored order.
 *
 * Both halves are read from content rather than listed here, so authoring a new variant
 * — as an identity option or as a goal reward — extends the fallback pool by itself.
 */
export function authoredIdleVariantIds(content: ContentRegistry): string[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const category of content.identity.preferenceCategories) {
    for (const option of category.options) {
      if (option.mechanic.kind === 'idle-variant') add(option.mechanic.idleVariantId);
    }
  }
  for (const reward of content.goals.rewards) {
    if (reward.kind === 'idle-variant') add(reward.idleVariantId);
  }
  return ids;
}

/**
 * The variant a creation-time identity preference selects, or null when the idle
 * category never rolled.
 *
 * An unknown option id resolves to null rather than throwing: a save may carry an option
 * from a later version, and a cosmetic must never take a session down.
 */
export function preferredIdleVariantId(
  idlePreferenceId: string | null,
  content: ContentRegistry,
): string | null {
  if (idlePreferenceId === null) return null;
  for (const category of content.identity.preferenceCategories) {
    for (const option of category.options) {
      if (option.id !== idlePreferenceId) continue;
      return option.mechanic.kind === 'idle-variant'
        ? option.mechanic.idleVariantId
        : null;
    }
  }
  return null;
}

/**
 * `fallback: 'next-available'` — the first authored variant the player is not already
 * wearing, so a reward can never grant what it already gave.
 */
export function nextAvailableIdleVariantId(
  content: ContentRegistry,
  taken: readonly (string | null)[],
): string | null {
  return authoredIdleVariantIds(content).find((id) => !taken.includes(id)) ?? null;
}

/**
 * The variant to draw: the newest one earned, else the one rolled at creation.
 *
 * Newest-wins is what makes SPEC §12's reward legible — the point of Goal 4 is that the
 * player *sees* something change. Goals are walked in authored order so a later chapter
 * adding a second idle reward supersedes this one rather than racing it.
 */
export function activeIdleVariantId(
  idlePreferenceId: string | null,
  goals: SessionState['goals'],
  content: ContentRegistry,
): string | null {
  const preferred = preferredIdleVariantId(idlePreferenceId, content);
  let granted: string | null = null;
  const ordered = [...content.goals.goals].sort((a, b) => a.order - b.order);
  for (const goal of ordered) {
    if (goals[goal.id]?.status !== 'rewarded') continue;
    const reward = rewardForGoal(goal, content.goals.rewards);
    if (reward.kind !== 'idle-variant') continue;
    granted =
      reward.idleVariantId === preferred
        ? nextAvailableIdleVariantId(content, [preferred, granted])
        : reward.idleVariantId;
  }
  return granted ?? preferred;
}
