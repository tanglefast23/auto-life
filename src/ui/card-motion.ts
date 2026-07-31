import { MOTION, type Motion } from '../render/motion';

/**
 * Which card motion a queue change earned (design.md §10, SPEC §11.3; P6 T11).
 *
 * A card that *enters* animates itself — it mounts, so the component can drive its own
 * slide. A card that *leaves* cannot: by the time the strip re-renders it is gone from
 * the snapshot, and there is nothing left to animate. So departures are diffed here and
 * replayed as short-lived ghosts, which is also the only way SPEC §11.3's completion poof
 * can exist at all.
 *
 * The discriminator between "you removed it" and "she finished it" is
 * `session.recap.completedActivityIds`, which the game ring appends to on the
 * `activityCompleted` event (`game/tick.ts:392`). Using `currentCardId` instead would call
 * a *stopped* card a completion — Stop and finish both empty the same slot — and reward a
 * cancel with the poof that means "well done".
 */

export type CardMotionKind = 'exit' | 'complete';

export interface CardMotionEvent {
  readonly cardId: string;
  readonly activityId: string;
  readonly kind: CardMotionKind;
}

/** The slice of a snapshot this diff reads. Nothing else is needed, so nothing else is taken. */
export interface QueueMotionFrame {
  readonly cards: readonly { readonly id: string; readonly activityId: string }[];
  readonly completedActivityIds: readonly string[];
}

export function queueMotionFrame(
  cards: readonly { readonly id: string; readonly activityId: string }[] | null,
  completedActivityIds: readonly string[],
): QueueMotionFrame | null {
  if (cards === null) return null;
  return {
    cards: cards.map((card) => ({ id: card.id, activityId: card.activityId })),
    completedActivityIds,
  };
}

export function motionForCardEvent(kind: CardMotionKind): Motion {
  return kind === 'complete' ? MOTION.poof : MOTION.cardRemove;
}

/**
 * Activities completed between two frames.
 *
 * The recap list only grows within a day and is emptied at the boundary, so anything that
 * is not a clean extension of the previous list is a new day rather than a completion —
 * returning `[]` there stops every card in the queue from poofing at midnight.
 */
function completedBetween(
  previous: QueueMotionFrame,
  next: QueueMotionFrame,
): string[] {
  const before = previous.completedActivityIds;
  const after = next.completedActivityIds;
  if (after.length <= before.length) return [];
  for (let i = 0; i < before.length; i++) {
    if (after[i] !== before[i]) return [];
  }
  return after.slice(before.length);
}

/**
 * What left the queue, and why.
 *
 * A null previous frame means this is the first publish, and the correct answer is
 * "nothing happened" — treating a fresh mount as a mass departure would poof a whole
 * restored save on load.
 */
export function diffQueueMotions(
  previous: QueueMotionFrame | null,
  next: QueueMotionFrame,
): CardMotionEvent[] {
  if (previous === null) return [];
  const surviving = new Set(next.cards.map((card) => card.id));
  const justCompleted = completedBetween(previous, next);
  return previous.cards
    .filter((card) => !surviving.has(card.id))
    .map((card): CardMotionEvent => {
      const at = justCompleted.indexOf(card.activityId);
      if (at === -1) {
        return { cardId: card.id, activityId: card.activityId, kind: 'exit' };
      }
      // Consumed, so two cards of the same activity leaving on one tick cannot both
      // claim the single completion that actually happened.
      justCompleted.splice(at, 1);
      return { cardId: card.id, activityId: card.activityId, kind: 'complete' };
    });
}
