export const QUEUE_DRAG_THRESHOLD = 8;
export const QUEUE_CARD_STRIDE = 132;
export const QUEUE_DRAG_OFF_STRIP_DISTANCE = 56;

export interface QueueDragGesture {
  dx: number;
  dy: number;
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
  dx: number,
  cardCount: number,
  stride = QUEUE_CARD_STRIDE,
): number {
  if (cardCount <= 0) return 0;
  const delta = Math.round(dx / stride);
  return Math.max(0, Math.min(cardCount - 1, fromIndex + delta));
}

export function queueDragDecision({
  gesture,
  fromIndex,
  cardCount,
  stripTop,
  stripBottom,
  stride = QUEUE_CARD_STRIDE,
  offStripDistance = QUEUE_DRAG_OFF_STRIP_DISTANCE,
}: {
  gesture: QueueDragGesture;
  fromIndex: number;
  cardCount: number;
  stripTop: number | null;
  stripBottom: number | null;
  stride?: number;
  offStripDistance?: number;
}): QueueDragDecision {
  if (!shouldStartQueueDrag(gesture.dx, gesture.dy)) {
    return { kind: 'cancel' };
  }
  if (
    stripTop !== null &&
    stripBottom !== null &&
    Number.isFinite(gesture.moveY) &&
    (gesture.moveY < stripTop || gesture.moveY > stripBottom)
  ) {
    return { kind: 'remove' };
  }
  if (
    (stripTop === null || stripBottom === null) &&
    Math.abs(gesture.dy) >= offStripDistance
  ) {
    return { kind: 'remove' };
  }
  return {
    kind: 'move',
    toIndex: reorderIndexFromDrag(
      fromIndex,
      gesture.dx,
      cardCount,
      stride,
    ),
  };
}
