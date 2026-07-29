import { z } from 'zod';

/**
 * The queue model (SPEC §7.4). Anchor blocks share a blockId — that is what makes
 * "one expandable card" and "blocks hold their fixed internal order" expressible
 * without nesting. Every mutation is a pure (queue, args) => queue function so the
 * T12 reducer can compose them.
 */
export const QueueCardSchema = z.strictObject({
  id: z.string().min(1),
  activityId: z.string().min(1),
  owner: z.enum(['AUTO', 'PINNED']),
  urgent: z.boolean(),
  source: z.enum(['anchor', 'reactive', 'player']),
  blockId: z.string().min(1).optional(),
  enqueuedTick: z.number().int().min(0),
});
export type QueueCard = z.infer<typeof QueueCardSchema>;

export const PLAYER_CARD_CAP = 10;

export const playerCardCount = (queue: readonly QueueCard[]): number =>
  queue.filter((c) => c.owner === 'PINNED' && c.source === 'player').length;

/** §7.4 cap row: the PLAYER may hold 10; anchor blocks and urgent cards live outside the cap. */
export function canPlayerInsert(queue: readonly QueueCard[]): boolean {
  return playerCardCount(queue) < PLAYER_CARD_CAP;
}

export interface SuppressionMap {
  [activityId: string]: number; // suppressed-until absoluteMinute
}

export const REMOVE_SUPPRESSION_MIN = 120;
export const STOP_SUPPRESSION_MIN = 60;

export function removeCard(
  queue: readonly QueueCard[],
  cardId: string,
  nowMinute: number,
  suppression: SuppressionMap,
): { queue: QueueCard[]; suppression: SuppressionMap } {
  const card = queue.find((c) => c.id === cardId);
  if (!card) return { queue: [...queue], suppression };
  const next = queue.filter((c) => c.id !== cardId);
  const nextSuppression = { ...suppression };
  if (card.owner === 'AUTO') {
    nextSuppression[card.activityId] = nowMinute + REMOVE_SUPPRESSION_MIN;
  }
  return { queue: next, suppression: nextSuppression };
}

export function isSuppressed(
  activityId: string,
  nowMinute: number,
  suppression: SuppressionMap,
  urgent: boolean,
): boolean {
  if (urgent) return false; // urgency overrides suppression (§7.4)
  const until = suppression[activityId];
  return until !== undefined && nowMinute < until;
}

/** Player insert (append at the end of the player-visible tail). */
export function insertPlayerCard(
  queue: readonly QueueCard[],
  card: Omit<QueueCard, 'owner' | 'source' | 'urgent'>,
): QueueCard[] {
  if (!canPlayerInsert(queue)) throw new Error('player card cap reached (10)');
  return [...queue, { ...card, owner: 'PINNED', source: 'player', urgent: false }];
}

/** Object-click (§7.4): promote an existing queued card for that activity, else insert at the front of the earliest AUTO run. */
export function objectClick(
  queue: readonly QueueCard[],
  activityId: string,
  newId: string,
  enqueuedTick: number,
): QueueCard[] {
  const existing = queue.find((c) => c.activityId === activityId);
  if (existing) {
    const rest = queue.filter((c) => c.id !== existing.id);
    const promoted: QueueCard = { ...existing, owner: 'PINNED', source: 'player' };
    const firstAuto = rest.findIndex((c) => c.owner === 'AUTO');
    const at = firstAuto === -1 ? rest.length : firstAuto;
    return [...rest.slice(0, at), promoted, ...rest.slice(at)];
  }
  if (!canPlayerInsert(queue)) throw new Error('player card cap reached (10)');
  const card: QueueCard = { id: newId, activityId, owner: 'PINNED', source: 'player', urgent: false, enqueuedTick };
  const firstAuto = queue.findIndex((c) => c.owner === 'AUTO');
  const at = firstAuto === -1 ? queue.length : firstAuto;
  return [...queue.slice(0, at), card, ...queue.slice(at)];
}

/** Planner dedup guard: max one AUTO card per activity type (player duplicates are free). */
export function hasAutoCardFor(queue: readonly QueueCard[], activityId: string): boolean {
  return queue.some((c) => c.owner === 'AUTO' && c.activityId === activityId);
}

/** Auto-cleanup (§7.4): unstarted AUTO reactive cards whose bar recovered past trigger+10 poof. */
export function autoCleanup(
  queue: readonly QueueCard[],
  shouldPoof: (card: QueueCard) => boolean,
): QueueCard[] {
  return queue.filter((c) => !(c.owner === 'AUTO' && c.source === 'reactive' && shouldPoof(c)));
}

export const pinnedSubsequence = (queue: readonly QueueCard[]): string[] =>
  queue.filter((c) => c.owner === 'PINNED').map((c) => c.id);
