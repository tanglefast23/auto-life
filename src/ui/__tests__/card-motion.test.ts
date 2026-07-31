import { MOTION } from '../../render/motion';
import {
  diffQueueMotions,
  motionForCardEvent,
  queueMotionFrame,
  type QueueMotionFrame,
} from '../card-motion';
import type { GameSnapshot } from '../../application/snapshot';

/**
 * P6 T11 — the departure half of design.md §10's card motions.
 *
 * The entering half needs no diff: a card that enters mounts, so it drives its own slide.
 * Everything here exists because a card that leaves is already gone from the snapshot by
 * the time the strip re-renders.
 */

const frame = (
  cards: readonly [string, string][],
  completedActivityIds: readonly string[] = [],
): QueueMotionFrame => ({
  cards: cards.map(([id, activityId]) => ({ id, activityId })),
  completedActivityIds,
});

describe('what left the queue', () => {
  it('reports nothing on the first publish', () => {
    // A restored save mounts with a full queue. Treating that as a mass departure would
    // poof every card on load.
    expect(diffQueueMotions(null, frame([['a', 'meal']]))).toEqual([]);
  });

  it('reports nothing when the queue is unchanged', () => {
    const before = frame([['a', 'meal'], ['b', 'shower']]);
    expect(diffQueueMotions(before, frame([['a', 'meal'], ['b', 'shower']]))).toEqual([]);
  });

  it('ignores arrivals — those animate themselves', () => {
    const before = frame([['a', 'meal']]);
    expect(diffQueueMotions(before, frame([['a', 'meal'], ['b', 'shower']]))).toEqual([]);
  });

  it('calls a card that vanished with no completion a removal', () => {
    const before = frame([['a', 'meal'], ['b', 'shower']]);
    expect(diffQueueMotions(before, frame([['a', 'meal']]))).toEqual([
      { cardId: 'b', activityId: 'shower', kind: 'exit' },
    ]);
  });

  it('calls a card that vanished alongside its completion a completion', () => {
    const before = frame([['a', 'meal'], ['b', 'shower']]);
    const after = frame([['a', 'meal']], ['shower']);
    expect(diffQueueMotions(before, after)).toEqual([
      { cardId: 'b', activityId: 'shower', kind: 'complete' },
    ]);
  });

  it('does not reward a stopped card with the completion poof', () => {
    // Stop and finish both empty the same slot. Only one of them earned the poof, and
    // `currentCardId` cannot tell them apart — the recap can.
    const before = frame([['a', 'practice']], ['meal']);
    const after = frame([], ['meal']);
    expect(diffQueueMotions(before, after)).toEqual([
      { cardId: 'a', activityId: 'practice', kind: 'exit' },
    ]);
  });

  it('spends one completion on one card when two of the same activity leave together', () => {
    const before = frame([['a', 'snack'], ['b', 'snack']]);
    const after = frame([], ['snack']);
    expect(diffQueueMotions(before, after)).toEqual([
      { cardId: 'a', activityId: 'snack', kind: 'complete' },
      { cardId: 'b', activityId: 'snack', kind: 'exit' },
    ]);
  });

  it('treats the day boundary as a reset, not as a queue full of completions', () => {
    // The recap list is emptied at wake. A shorter list is a new day, not a departure.
    const before = frame([['a', 'meal'], ['b', 'sleep']], ['meal', 'shower', 'practice']);
    const after = frame([['a', 'meal']], []);
    expect(diffQueueMotions(before, after)).toEqual([
      { cardId: 'b', activityId: 'sleep', kind: 'exit' },
    ]);
  });

  it('treats a rewritten recap list as a reset rather than trusting its length', () => {
    const before = frame([['a', 'meal'], ['b', 'sleep']], ['meal']);
    const after = frame([['a', 'meal']], ['shower', 'practice']);
    expect(diffQueueMotions(before, after)).toEqual([
      { cardId: 'b', activityId: 'sleep', kind: 'exit' },
    ]);
  });

  it('reports every departure when the whole queue drains at once', () => {
    const before = frame([['a', 'meal'], ['b', 'shower'], ['c', 'sleep']]);
    expect(diffQueueMotions(before, frame([]))).toHaveLength(3);
  });
});

describe('which motion a departure earns', () => {
  it('poofs a completion for design.md §10’s four frames', () => {
    expect(motionForCardEvent('complete')).toBe(MOTION.poof);
    expect(motionForCardEvent('complete').frames).toBe(4);
  });

  it('squashes a removal inward over 90 ms', () => {
    expect(motionForCardEvent('exit')).toBe(MOTION.cardRemove);
    expect(motionForCardEvent('exit').durationMs).toBe(90);
  });
});

describe('reading the frame off a snapshot', () => {
  it('returns null for no queue, so the first publish seeds silently', () => {
    expect(queueMotionFrame(null, [])).toBeNull();
  });

  it('takes only the card ids, their activities, and the recap list', () => {
    const queue = [
      { id: 'a', activityId: 'meal', urgent: true },
      { id: 'b', activityId: 'shower', urgent: false },
    ] as unknown as GameSnapshot['queue'];
    expect(queueMotionFrame(queue, ['practice'])).toEqual({
      cards: [
        { id: 'a', activityId: 'meal' },
        { id: 'b', activityId: 'shower' },
      ],
      completedActivityIds: ['practice'],
    });
  });
});
