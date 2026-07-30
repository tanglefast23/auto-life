import type { PublishedQueueCard } from '../application/snapshot';

export interface QueueStripCardItem {
  kind: 'card';
  key: string;
  card: PublishedQueueCard;
}

export interface QueueStripBlockItem {
  kind: 'block';
  key: string;
  blockId: string;
  cards: PublishedQueueCard[];
}

export type QueueStripItem = QueueStripCardItem | QueueStripBlockItem;

export interface QueueVisualRow {
  key: string;
  cardIds: string[];
}

/** Every upcoming action gets its own row; the current card is shown separately. */
export function groupQueueForStrip(
  queue: readonly PublishedQueueCard[],
  currentCardId: string | null,
): QueueStripItem[] {
  return queue
    .filter((card) => card.id !== currentCardId)
    .map((card) => ({
      kind: 'card',
      key: `card:${card.id}`,
      card,
    }));
}

/** One visible rail row. Collapsed blocks remain one indivisible movement unit. */
export function queueVisualRows(
  items: readonly QueueStripItem[],
  expandedBlockKeys: ReadonlySet<string>,
): QueueVisualRow[] {
  return items.flatMap((item) => {
    if (item.kind === 'card') {
      return [{ key: item.key, cardIds: [item.card.id] }];
    }
    if (expandedBlockKeys.has(item.key)) {
      return item.cards.map((card) => ({
        key: `card:${card.id}`,
        cardIds: [card.id],
      }));
    }
    return [{
      key: item.key,
      cardIds: item.cards.map((card) => card.id),
    }];
  });
}

/**
 * Convert a final visual-row position to the engine's raw insertion index.
 * The running card remains first, and a collapsed block can only be crossed as
 * a whole—never split by a loose card.
 */
export function engineIndexForVisualMove(
  queue: readonly Pick<PublishedQueueCard, 'id'>[],
  currentCardId: string | null,
  rows: readonly QueueVisualRow[],
  cardId: string,
  toRowIndex: number,
): number | null {
  if (!queue.some((card) => card.id === cardId)) return null;
  const rest = queue.filter((card) => card.id !== cardId);
  const rowsWithoutCard = rows.flatMap((row) => {
    const cardIds = row.cardIds.filter((id) => id !== cardId);
    return cardIds.length === 0
      ? []
      : [{ key: row.key, cardIds }];
  });
  const at = Math.max(
    0,
    Math.min(Math.trunc(toRowIndex), rowsWithoutCard.length),
  );
  let engineIndex = rest.length;
  const targetId = rowsWithoutCard[at]?.cardIds[0];
  if (targetId !== undefined) {
    const found = rest.findIndex((card) => card.id === targetId);
    if (found !== -1) engineIndex = found;
  }
  const currentIndex = currentCardId === null
    ? -1
    : rest.findIndex((card) => card.id === currentCardId);
  return Math.max(currentIndex + 1, engineIndex);
}

const ACTIVITY_COPY: Record<string, { label: string; glyph: string }> = {
  sleep: { label: 'Sleep', glyph: '☾' },
  nap: { label: 'Nap', glyph: 'z' },
  meal: { label: 'Meal', glyph: '▣' },
  snack: { label: 'Snack', glyph: '◇' },
  weights: { label: 'Weights', glyph: 'W' },
  treadmill: { label: 'Treadmill', glyph: 'R' },
  stretch: { label: 'Stretch', glyph: 'S' },
  shower: { label: 'Shower', glyph: '≋' },
  quickwash: { label: 'Quick wash', glyph: '≈' },
  brush: { label: 'Brush teeth', glyph: '✦' },
  toilet: { label: 'Use toilet', glyph: 'T' },
  package: { label: 'Pick up package', glyph: '▤' },
  read: { label: 'Read a book', glyph: 'B' },
  practice: { label: 'Practice', glyph: '♪' },
  idle: { label: 'Sit', glyph: '·' },
};

export function activityCopy(activityId: string): { label: string; glyph: string } {
  return (
    ACTIVITY_COPY[activityId] ?? {
      label: activityId.replace(/(^|[-_])(\w)/g, (_all, _sep, c: string) => ` ${c.toUpperCase()}`).trim(),
      glyph: '•',
    }
  );
}

const BLOCK_COPY: Record<string, string> = {
  wake: 'Morning routine',
  lunch: 'Lunch routine',
  workout: 'Workout routine',
  dinner: 'Dinner routine',
  bedtime: 'Night routine',
};

export function blockLabel(blockId: string): string {
  const anchorId = blockId.split('#')[0] ?? blockId;
  return BLOCK_COPY[anchorId] ?? `${activityCopy(anchorId).label} routine`;
}
