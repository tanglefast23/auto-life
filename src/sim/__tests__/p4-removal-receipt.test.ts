import { dayNumber } from '../clock';
import { content, objectForActivity } from '../content';
import { toFixed } from '../fixed';
import { PrngStreams } from '../prng';
import { PLAYER_CARD_CAP, playerCardCount, type QueueCard } from '../queue';
import { newGameState, restoreSimState, type SimState } from '../state';
import { step } from '../step';

const fresh = (): SimState =>
  newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

const card = (over: Partial<QueueCard> & { id: string; activityId: string }): QueueCard => ({
  owner: 'AUTO',
  urgent: false,
  source: 'reactive',
  enqueuedTick: 0,
  ...over,
});

const player = (id: string, activityId = 'practice', enqueuedTick = 0): QueueCard =>
  card({ id, activityId, owner: 'PINNED', source: 'player', enqueuedTick });

const at = (activityId: string): { x: number; y: number } => {
  const [x, y] = objectForActivity(activityId).interactPoint;
  return { x, y };
};

const prepared = (): SimState => {
  const s = fresh();
  s.clock.absoluteMinute = 600;
  s.bars = {
    energy: toFixed(80),
    nutrition: toFixed(80),
    movement: toFixed(80),
    hygiene: toFixed(80),
  };
  const today = dayNumber(s.clock.absoluteMinute);
  for (const anchor of content.anchors.anchors) s.anchorsConsumedOnDay[anchor.id] = today;
  return s;
};

const withRunningPractice = (tail: QueueCard[]): SimState => {
  const s = prepared();
  s.position = at('practice');
  s.queue = [player('running', 'practice', 1), ...tail];
  const started = step(s, [], content).next;
  if (started.current?.cardId !== 'running') throw new Error('practice did not start');
  return started;
};

test('remove issues one opaque receipt containing the complete card, index, and both neighbours', () => {
  const removed = player('removed', 'snack', 3);
  const s = withRunningPractice([
    player('left', 'meal', 2),
    removed,
    player('right', 'stretch', 4),
  ]);

  const r = step(s, [{ type: 'removeCard', cardId: 'removed' }], content);
  const outcome = r.outcomes[0];
  expect(outcome).toMatchObject({
    type: 'removeCard',
    status: 'accepted',
    effect: 'removed',
    cardId: 'removed',
  });
  if (outcome?.type !== 'removeCard' || outcome.status !== 'accepted' || outcome.effect !== 'removed') {
    throw new Error('remove did not issue a receipt');
  }

  expect(r.next.removalReceipt).toEqual({
    id: outcome.receiptId,
    card: removed,
    originalIndex: 2,
    previousNeighborId: 'left',
    nextNeighborId: 'right',
    suppressionMutation: null,
    anchorMutation: null,
  });
  expect(
    restoreSimState(JSON.parse(JSON.stringify(r.next))).removalReceipt,
  ).toEqual(r.next.removalReceipt);
});

test('undo restores beside a surviving neighbour without discarding intervening queue edits', () => {
  const s = withRunningPractice([
    player('left', 'meal', 2),
    player('removed', 'snack', 3),
    player('right', 'stretch', 4),
    player('moved', 'practice', 5),
  ]);
  const removed = step(s, [{ type: 'removeCard', cardId: 'removed' }], content);
  const receiptId = removed.next.removalReceipt?.id;
  if (receiptId === undefined) throw new Error('missing receipt');

  const edited = step(
    removed.next,
    [{ type: 'moveCard', cardId: 'moved', toIndex: 2 }],
    content,
  );
  expect(edited.next.queue.map((c) => c.id)).toEqual([
    'running',
    'left',
    'moved',
    'right',
  ]);

  const undone = step(
    edited.next,
    [{ type: 'undoLastRemove', receiptId }],
    content,
  );
  expect(undone.next.queue.map((c) => c.id)).toEqual([
    'running',
    'left',
    'removed',
    'moved',
    'right',
  ]);
});

test('undo restores prior suppression only while the exact removal write still owns the entry', () => {
  const beforeStart = prepared();
  beforeStart.bars.hygiene = toFixed(38); // keep the reactive card through the start tick
  beforeStart.position = at('practice');
  beforeStart.queue = [
    player('running', 'practice', 1),
    card({ id: 'auto-shower', activityId: 'shower', enqueuedTick: 2 }),
  ];
  const start = step(beforeStart, [], content).next;
  expect(start.current?.cardId).toBe('running');
  start.suppression.shower = 650;

  const removed = step(start, [{ type: 'removeCard', cardId: 'auto-shower' }], content);
  const outcome = removed.outcomes[0];
  if (outcome?.type !== 'removeCard' || outcome.status !== 'accepted' || outcome.effect !== 'removed') {
    throw new Error('remove did not issue a receipt');
  }
  const written = removed.next.removalReceipt?.suppressionMutation?.writtenUntil;
  expect(written).toBe(removed.next.clock.absoluteMinute - 1 + 120);

  const restored = step(
    removed.next,
    [{ type: 'undoLastRemove', receiptId: outcome.receiptId }],
    content,
  );
  expect(restored.next.suppression.shower).toBe(650);
  expect(restored.next.queue.some((c) => c.id === 'auto-shower')).toBe(true);

  // A different write — older OR newer — owns the key now and must survive.
  for (const intervening of [500, 900]) {
    const changed = JSON.parse(JSON.stringify(removed.next)) as SimState;
    changed.suppression.shower = intervening;
    const guarded = step(
      changed,
      [{ type: 'undoLastRemove', receiptId: outcome.receiptId }],
      content,
    );
    expect(guarded.next.suppression.shower).toBe(intervening);
  }
});

test('undo does not duplicate an urgent AUTO replacement', () => {
  const beforeStart = prepared();
  beforeStart.bars.hygiene = toFixed(5);
  beforeStart.position = at('practice');
  beforeStart.queue = [
    player('running', 'practice', 1),
    card({
      id: 'old-auto-shower',
      activityId: 'shower',
      enqueuedTick: 2,
      urgent: true,
    }),
  ];
  const running = step(beforeStart, [], content).next;

  const removed = step(
    running,
    [{ type: 'removeCard', cardId: 'old-auto-shower' }],
    content,
  );
  const receiptId = removed.next.removalReceipt?.id;
  if (receiptId === undefined) throw new Error('missing receipt');
  expect(
    removed.next.queue.filter(
      (candidate) =>
        candidate.owner === 'AUTO' &&
        candidate.activityId === 'shower',
    ),
  ).toHaveLength(1);

  const undone = step(
    removed.next,
    [{ type: 'undoLastRemove', receiptId }],
    content,
  );
  expect(undone.outcomes[0]).toEqual({
    type: 'undoLastRemove',
    status: 'rejected',
    reason: 'replacementExists',
  });
  expect(
    undone.next.queue.filter(
      (candidate) =>
        candidate.owner === 'AUTO' &&
        candidate.activityId === 'shower',
    ),
  ).toHaveLength(1);
  expect(undone.next.removalReceipt).toBeNull();
});

test('an undone anchor card can still fire the missed-window sweep', () => {
  const s = prepared();
  s.clock.absoluteMinute = 899; // lunch closes at 15:00 / minute 900
  delete s.anchorsConsumedOnDay.lunch;
  s.queue = [
    card({
      id: 'lunch-card',
      activityId: 'meal',
      source: 'anchor',
      blockId: 'lunch#1',
      enqueuedTick: 720,
    }),
  ];

  const removed = step(s, [{ type: 'removeCard', cardId: 'lunch-card' }], content);
  const receiptId = removed.next.removalReceipt?.id;
  if (receiptId === undefined) throw new Error('missing receipt');
  const undone = step(
    removed.next,
    [{ type: 'undoLastRemove', receiptId }],
    content,
  );

  let state = undone.next;
  const events = [...undone.events];
  for (let i = 0; i < 3 && !events.some((e) => e.type === 'anchorMissed'); i++) {
    const r = step(state, [], content);
    state = r.next;
    events.push(...r.events);
  }
  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'anchorMissed', detail: 'lunch' }),
    ]),
  );
});

test('wake-boundary generation guard never erases a newer anchor consumption', () => {
  const s = fresh();
  s.clock.absoluteMinute = 419; // 06:59, immediately before Day 1 wake
  s.position = at('toilet');
  s.queue = [
    card({
      id: 'stale-wake',
      activityId: 'toilet',
      source: 'anchor',
      blockId: 'wake#0',
      enqueuedTick: 1,
    }),
  ];

  const removed = step(s, [{ type: 'removeCard', cardId: 'stale-wake' }], content);
  const receiptId = removed.next.removalReceipt?.id;
  if (receiptId === undefined) throw new Error('missing receipt');

  // At 07:00 the real wake#1 block starts and writes a newer generation.
  const wakeStarted = step(removed.next, [], content);
  expect(wakeStarted.next.anchorsConsumedOnDay.wake).toBe(1);
  const generation = wakeStarted.next.anchorMutationGenerations.wake;

  const undone = step(
    wakeStarted.next,
    [{ type: 'undoLastRemove', receiptId }],
    content,
  );
  expect(undone.next.anchorsConsumedOnDay.wake).toBe(1);
  expect(undone.next.anchorMutationGenerations.wake).toBe(generation);
});

test('running and travel-target cards stop without creating an undo receipt', () => {
  const running = withRunningPractice([]);
  const stopped = step(running, [{ type: 'removeCard', cardId: 'running' }], content);
  expect(stopped.outcomes[0]).toMatchObject({
    type: 'removeCard',
    status: 'accepted',
    effect: 'stopped',
  });
  expect(stopped.next.removalReceipt).toBeNull();

  const travelling = prepared();
  travelling.position = at('practice');
  travelling.queue = [player('travel-target', 'meal')];
  const onTheWay = step(travelling, [], content).next;
  expect(onTheWay.current?.type).toBe('travel');
  const travelStopped = step(
    onTheWay,
    [{ type: 'removeCard', cardId: 'travel-target' }],
    content,
  );
  expect(travelStopped.outcomes[0]).toMatchObject({
    type: 'removeCard',
    status: 'accepted',
    effect: 'stopped',
  });
  expect(travelStopped.next.removalReceipt).toBeNull();
});

test('the receipt is single-depth and only its opaque id can restore the card', () => {
  const s = withRunningPractice([
    player('first', 'snack', 2),
    player('second', 'meal', 3),
  ]);
  const first = step(s, [{ type: 'removeCard', cardId: 'first' }], content);
  const firstId = first.next.removalReceipt?.id;
  if (firstId === undefined) throw new Error('missing first receipt');
  const second = step(
    first.next,
    [{ type: 'removeCard', cardId: 'second' }],
    content,
  );
  const secondId = second.next.removalReceipt?.id;
  if (secondId === undefined) throw new Error('missing second receipt');

  const stale = step(
    second.next,
    [{ type: 'undoLastRemove', receiptId: firstId }],
    content,
  );
  expect(stale.outcomes[0]).toEqual({
    type: 'undoLastRemove',
    status: 'rejected',
    reason: 'unknownReceipt',
  });
  expect(stale.next.removalReceipt?.id).toBe(secondId);

  const restored = step(
    stale.next,
    [{ type: 'undoLastRemove', receiptId: secondId }],
    content,
  );
  expect(restored.outcomes[0]).toMatchObject({
    type: 'undoLastRemove',
    status: 'accepted',
    cardId: 'second',
  });
  expect(restored.next.queue.map((c) => c.id)).toEqual([
    'running',
    'second',
  ]);
  expect(restored.next.removalReceipt).toBeNull();
});

test('refilling the player cap voids a player-card receipt instead of exceeding ten', () => {
  const s = withRunningPractice([player('removed', 'snack', 2)]);
  const removed = step(s, [{ type: 'removeCard', cardId: 'removed' }], content);
  const receiptId = removed.next.removalReceipt?.id;
  if (receiptId === undefined) throw new Error('missing receipt');

  const full = JSON.parse(JSON.stringify(removed.next)) as SimState;
  while (playerCardCount(full.queue) < PLAYER_CARD_CAP) {
    const i = playerCardCount(full.queue);
    full.queue.push(player(`refill-${i}`, 'practice', 10 + i));
  }
  const rejected = step(
    full,
    [{ type: 'undoLastRemove', receiptId }],
    content,
  );
  expect(rejected.outcomes[0]).toEqual({
    type: 'undoLastRemove',
    status: 'rejected',
    reason: 'playerCardCap',
  });
  expect(playerCardCount(rejected.next.queue)).toBe(PLAYER_CARD_CAP);
  expect(rejected.next.removalReceipt).toBeNull();
});
