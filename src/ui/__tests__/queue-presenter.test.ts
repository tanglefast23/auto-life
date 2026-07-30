import type { PublishedQueueCard } from '../../application/snapshot';
import {
  engineIndexForVisualMove,
  groupQueueForStrip,
  queueVisualRows,
} from '../queue-presenter';

const card = (
  id: string,
  over: Partial<PublishedQueueCard> = {},
): PublishedQueueCard => {
  const activityId = over.activityId ?? 'practice';
  return {
    id,
    activityId,
    owner: 'AUTO',
    urgent: false,
    source: 'anchor',
    blockId: undefined,
    enqueuedTick: 0,
    durationTicksAtCurrentSpeed: 60,
    forecast: {
      cardId: id,
      activityId,
      predictedStartMinute: 480,
      reason: null,
      targetObjectId: 'guitar',
      effects: {},
      capWaste: {},
      bonuses: [],
      conflicts: [],
      wakeConflicts: [],
    },
    ...over,
  };
};

test('the running card is removed and every upcoming action keeps its own row', () => {
  const queue = [
    card('wake-running', { blockId: 'wake#1', activityId: 'toilet' }),
    card('wake-brush', { blockId: 'wake#1', activityId: 'brush' }),
    card('wake-shower', { blockId: 'wake#1', activityId: 'shower' }),
    card('player', {
      owner: 'PINNED',
      source: 'player',
      activityId: 'practice',
    }),
  ];

  const items = groupQueueForStrip(queue, 'wake-running');

  expect(items).toHaveLength(3);
  expect(items).toEqual([
    expect.objectContaining({
      kind: 'card',
      card: expect.objectContaining({ id: 'wake-brush' }),
    }),
    expect.objectContaining({
      kind: 'card',
      card: expect.objectContaining({ id: 'wake-shower' }),
    }),
    expect.objectContaining({
      kind: 'card',
      card: expect.objectContaining({ id: 'player' }),
    }),
  ]);
  expect(
    items.flatMap((item) =>
      item.kind === 'block' ? item.cards.map((c) => c.id) : [item.card.id],
    ),
  ).not.toContain('wake-running');
});

test('block membership never hides individual actions', () => {
  const queue = [
    card('wake-a', { blockId: 'wake#1', activityId: 'toilet' }),
    card('wake-b', { blockId: 'wake#1', activityId: 'brush' }),
    card('moved-pin', {
      blockId: 'wake#1',
      owner: 'PINNED',
      activityId: 'shower',
    }),
    card('wake-c', { blockId: 'wake#1', activityId: 'meal' }),
    card('wake-d', { blockId: 'wake#1', activityId: 'brush' }),
  ];

  const items = groupQueueForStrip(queue, null);

  expect(items).toHaveLength(5);
  expect(
    items.map((item) =>
      item.kind === 'card' ? item.card.id : item.key,
    ),
  ).toEqual(['wake-a', 'wake-b', 'moved-pin', 'wake-c', 'wake-d']);
});

test('a PINNED card retaining a block id is always rendered as an individual card', () => {
  const items = groupQueueForStrip(
    [
      card('only', {
        blockId: 'wake#1',
        owner: 'PINNED',
        source: 'anchor',
      }),
    ],
    null,
  );

  expect(items).toEqual([
    expect.objectContaining({ kind: 'card', card: expect.objectContaining({ id: 'only' }) }),
  ]);
});

test('visual movement targets the exact visible action row', () => {
  const queue = [
    card('current', {
      owner: 'PINNED',
      source: 'player',
      activityId: 'practice',
    }),
    card('loose-before', {
      owner: 'PINNED',
      source: 'player',
      activityId: 'meal',
    }),
    card('wake-a', { blockId: 'wake#1', activityId: 'brush' }),
    card('wake-b', { blockId: 'wake#1', activityId: 'meal' }),
    card('loose-after', {
      owner: 'PINNED',
      source: 'player',
      activityId: 'stretch',
    }),
  ];
  const rows = queueVisualRows(
    groupQueueForStrip(queue, 'current'),
    new Set(),
  );

  expect(
    engineIndexForVisualMove(
      queue,
      'current',
      rows,
      'loose-before',
      1,
    ),
  ).toBe(2);
  expect(
    engineIndexForVisualMove(
      queue,
      'current',
      rows,
      'loose-after',
      0,
    ),
  ).toBe(1);
});

test('Do next stays after the running card', () => {
  const queue = [
    card('current', {
      owner: 'PINNED',
      source: 'player',
    }),
    card('first'),
    card('later'),
  ];
  const rows = queueVisualRows(
    groupQueueForStrip(queue, 'current'),
    new Set(),
  );

  expect(
    engineIndexForVisualMove(
      queue,
      'current',
      rows,
      'later',
      0,
    ),
  ).toBe(1);
});
