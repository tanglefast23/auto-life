export const QUEUE_DRAG_THRESHOLD = 8;
export const QUEUE_ROW_STRIDE = 62;
export const QUEUE_DRAG_OFF_STRIP_DISTANCE = 56;

export interface QueueDragGesture {
  dx: number;
  dy: number;
  moveX: number;
  moveY: number;
}

export type QueueDragDecision =
  | { kind: 'cancel' }
  | { kind: 'move'; toIndex: number }
  | { kind: 'remove' };

export function shouldStartQueueDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= QUEUE_DRAG_THRESHOLD;
}

export function reorderIndexFromDrag(
  fromIndex: number,
  dy: number,
  cardCount: number,
  stride = QUEUE_ROW_STRIDE,
): number {
  if (cardCount <= 0) return 0;
  const delta = Math.round(dy / stride);
  return Math.max(0, Math.min(cardCount - 1, fromIndex + delta));
}

export function queueDragDecision({
  gesture,
  fromIndex,
  cardCount,
  stripLeft,
  stripRight,
  stride = QUEUE_ROW_STRIDE,
  offStripDistance = QUEUE_DRAG_OFF_STRIP_DISTANCE,
}: {
  gesture: QueueDragGesture;
  fromIndex: number;
  cardCount: number;
  stripLeft: number | null;
  stripRight: number | null;
  stride?: number;
  offStripDistance?: number;
}): QueueDragDecision {
  if (!shouldStartQueueDrag(gesture.dx, gesture.dy)) {
    return { kind: 'cancel' };
  }
  if (
    stripLeft !== null &&
    stripRight !== null &&
    Number.isFinite(gesture.moveX) &&
    (gesture.moveX < stripLeft || gesture.moveX > stripRight)
  ) {
    return { kind: 'remove' };
  }
  if (
    (stripLeft === null || stripRight === null) &&
    Math.abs(gesture.dx) >= offStripDistance
  ) {
    return { kind: 'remove' };
  }
  return {
    kind: 'move',
    toIndex: reorderIndexFromDrag(
      fromIndex,
      gesture.dy,
      cardCount,
      stride,
    ),
  };
}
