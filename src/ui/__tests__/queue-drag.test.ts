import {
  QUEUE_DRAG_THRESHOLD,
  queueDragDecision,
  reorderIndexFromDrag,
  shouldStartQueueDrag,
} from '../queue-drag';
import { content } from '../../sim/content';
import { toFixed } from '../../sim/fixed';
import { sortReactivesAroundBlocks } from '../../sim/planner';
import {
  moveCard,
  pinnedSubsequence,
  type QueueCard,
} from '../../sim/queue';

test('the drag threshold keeps taps and small pointer wobble as taps', () => {
  expect(shouldStartQueueDrag(QUEUE_DRAG_THRESHOLD - 0.1, 0)).toBe(false);
  expect(shouldStartQueueDrag(0, QUEUE_DRAG_THRESHOLD)).toBe(true);
  expect(shouldStartQueueDrag(6, 6)).toBe(true);
});

test('vertical drag rounds by row stride and clamps at both queue edges', () => {
  expect(reorderIndexFromDrag(3, -61, 6)).toBe(2);
  expect(reorderIndexFromDrag(3, 61, 6)).toBe(4);
  expect(reorderIndexFromDrag(3, -9999, 6)).toBe(0);
  expect(reorderIndexFromDrag(3, 9999, 6)).toBe(5);
  expect(reorderIndexFromDrag(3, 10, 6)).toBe(3);
});

test('leaving the measured rail removes; staying inside issues a move even at one index', () => {
  expect(
    queueDragDecision({
      gesture: { dx: -100, dy: 0, moveX: 1000, moveY: 300 },
      fromIndex: 2,
      cardCount: 5,
      stripLeft: 1100,
      stripRight: 1324,
    }),
  ).toEqual({ kind: 'remove' });
  expect(
    queueDragDecision({
      gesture: { dx: 100, dy: 0, moveX: 1340, moveY: 300 },
      fromIndex: 2,
      cardCount: 5,
      stripLeft: 1100,
      stripRight: 1324,
    }),
  ).toEqual({ kind: 'remove' });
  expect(
    queueDragDecision({
      gesture: { dx: 0, dy: 12, moveX: 1200, moveY: 300 },
      fromIndex: 2,
      cardCount: 5,
      stripLeft: 1100,
      stripRight: 1324,
    }),
  ).toEqual({ kind: 'move', toIndex: 2 });
  expect(
    queueDragDecision({
      gesture: { dx: -56, dy: 0, moveX: 0, moveY: 0 },
      fromIndex: 2,
      cardCount: 5,
      stripLeft: null,
      stripRight: null,
    }),
  ).toEqual({ kind: 'remove' });
});

test('a release below the activation threshold cancels without editing', () => {
  expect(
    queueDragDecision({
      gesture: { dx: 2, dy: 2, moveX: 1200, moveY: 300 },
      fromIndex: 2,
      cardCount: 5,
      stripLeft: 1100,
      stripRight: 1324,
    }),
  ).toEqual({ kind: 'cancel' });
});

test('drag-generated moves pin AUTO cards and planner passes preserve the resulting PINNED order', () => {
  let nextId = 3;
  let seed = 8675309;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const auto = (id: string, activityId: string): QueueCard => ({
    id,
    activityId,
    owner: 'AUTO',
    urgent: false,
    source: 'reactive',
    enqueuedTick: 0,
  });
  let queue: QueueCard[] = [
    auto('a0', 'snack'),
    auto('a1', 'shower'),
    auto('a2', 'stretch'),
  ];
  const bars = {
    energy: toFixed(50),
    nutrition: toFixed(30),
    movement: toFixed(40),
    hygiene: toFixed(35),
  };

  for (let i = 0; i < 1_000; i++) {
    if (i % 25 === 0 && queue.length < 40) {
      queue.push(auto(`a${nextId++}`, i % 50 === 0 ? 'snack' : 'shower'));
    }
    const fromIndex = Math.floor(random() * queue.length);
    const card = queue[fromIndex]!;
    const direction = random() < 0.5 ? -1 : 1;
    const dy = direction * (1 + Math.floor(random() * 5)) * 62;
    const decision = queueDragDecision({
      gesture: { dx: 0, dy, moveX: 1200, moveY: 300 },
      fromIndex,
      cardCount: queue.length,
      stripLeft: 1100,
      stripRight: 1324,
    });
    if (decision.kind !== 'move') throw new Error('vertical drag must move');
    queue = moveCard(queue, card.id, decision.toIndex);
    expect(queue.find((candidate) => candidate.id === card.id)?.owner).toBe(
      'PINNED',
    );

    const pinned = pinnedSubsequence(queue);
    queue = sortReactivesAroundBlocks(queue, bars, content.reactive);
    expect(pinnedSubsequence(queue)).toEqual(pinned);
  }
});
