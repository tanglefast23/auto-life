import { content, objectForActivity } from '../content';
import { dayNumber } from '../clock';
import { toFixed } from '../fixed';
import { sortReactivesAroundBlocks } from '../planner';
import { PrngStreams } from '../prng';
import type { QueueCard } from '../queue';
import { DEFAULT_SIM_RULES } from '../rules';
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

const at = (activityId: string): { x: number; y: number } => {
  const [x, y] = objectForActivity(activityId).interactPoint;
  return { x, y };
};

/** A quiet mid-morning state: no anchor or reactive rule can add surprise cards. */
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

test('an idle wrinkle starts in the same tick and preserves its provenance and structured reason', () => {
  const s = prepared();
  s.nextCardSeq = 20;
  s.position = at('snack');

  const r = step(
    s,
    [{ type: 'insertWrinkle', wrinkleId: 'package-delivery', activityId: 'snack' }],
    content,
  );

  expect(r.outcomes).toEqual([
    {
      type: 'insertWrinkle',
      status: 'accepted',
      cardId: 'c20',
      wrinkleId: 'package-delivery',
      disposition: 'started',
    },
  ]);
  expect(r.next.current?.cardId).toBe('c20');
  expect(r.next.queue.find((c) => c.id === 'c20')).toMatchObject({
    owner: 'AUTO',
    urgent: true,
    source: 'wrinkle',
    reason: { kind: 'wrinkle', wrinkleId: 'package-delivery' },
  });

  // The reason is save/replay truth, not an application-only side table.
  expect(restoreSimState(JSON.parse(JSON.stringify(r.next)))).toEqual(r.next);
});

test('mid-activity inserts at URGENT-front without interrupting, and ordering survives the next tick', () => {
  const s = prepared();
  s.bars.hygiene = toFixed(38); // keep the queued reactive shower from auto-cleanup
  s.position = at('practice');
  s.queue = [
    card({
      id: 'running-pin',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
      enqueuedTick: 1,
    }),
    card({
      id: 'wake-toilet',
      activityId: 'toilet',
      source: 'anchor',
      blockId: 'wake#1',
      enqueuedTick: 2,
    }),
    card({
      id: 'wake-brush',
      activityId: 'brush',
      source: 'anchor',
      blockId: 'wake#1',
      enqueuedTick: 2,
    }),
    card({ id: 'reactive-shower', activityId: 'shower', enqueuedTick: 3 }),
  ];

  const started = step(s, [], content);
  expect(started.next.current?.cardId).toBe('running-pin');

  const inserted = step(
    started.next,
    [{ type: 'insertWrinkle', wrinkleId: 'package-delivery', activityId: 'snack' }],
    content,
  );
  const wrinkleOutcome = inserted.outcomes[0];
  const wrinkleId =
    wrinkleOutcome?.type === 'insertWrinkle' && wrinkleOutcome.status === 'accepted'
      ? wrinkleOutcome.cardId
      : 'missing';

  // The currently-running PINNED unit is a hard barrier and keeps running.
  expect(inserted.next.current?.cardId).toBe('running-pin');
  expect(inserted.outcomes[0]).toMatchObject({
    type: 'insertWrinkle',
    status: 'accepted',
    disposition: 'queued',
  });
  expect(inserted.next.queue.map((c) => c.id)).toEqual([
    'running-pin',
    wrinkleId,
    'wake-toilet',
    'wake-brush',
    'reactive-shower',
  ]);

  // A front insertion that the ordinary planner immediately sorts away is not a fix.
  const nextTick = step(inserted.next, [], content);
  expect(nextTick.next.current?.cardId).toBe('running-pin');
  expect(nextTick.next.queue.map((c) => c.id)).toEqual([
    'running-pin',
    wrinkleId,
    'wake-toilet',
    'wake-brush',
    'reactive-shower',
  ]);
});

test('generic urgent ordering is per AUTO run and never crosses a PINNED barrier', () => {
  const q: QueueCard[] = [
    card({ id: 'block-a', activityId: 'toilet', source: 'anchor', blockId: 'wake#1' }),
    card({
      id: 'wrinkle-a',
      activityId: 'practice',
      urgent: true,
      source: 'wrinkle',
      reason: { kind: 'wrinkle', wrinkleId: 'package-a' },
      enqueuedTick: 1,
    }),
    card({
      id: 'pin',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
      enqueuedTick: 2,
    }),
    card({ id: 'block-b', activityId: 'brush', source: 'anchor', blockId: 'bedtime#1' }),
    card({
      id: 'wrinkle-b',
      activityId: 'practice',
      urgent: true,
      source: 'wrinkle',
      reason: { kind: 'wrinkle', wrinkleId: 'package-b' },
      enqueuedTick: 3,
    }),
  ];

  const sorted = sortReactivesAroundBlocks(q, prepared().bars, content.reactive);
  expect(sorted.map((c) => c.id)).toEqual([
    'wrinkle-a',
    'block-a',
    'pin',
    'wrinkle-b',
    'block-b',
  ]);
});

test('invalid or inapplicable commands return typed rejections instead of corrupting the tick', () => {
  const s = prepared();
  const r = step(
    s,
    [
      { type: 'insertWrinkle', wrinkleId: 'bad-package', activityId: 'missing' },
      { type: 'insertPlayer', activityId: 'missing' },
      { type: 'objectClick', activityId: 'missing' },
      { type: 'moveCard', cardId: 'missing', toIndex: 0 },
      { type: 'removeCard', cardId: 'missing' },
      { type: 'stopCurrent' },
    ],
    content,
    {
      ...DEFAULT_SIM_RULES,
      key: 'invalid-commands-without-routine-refill',
      autonomy: 'reactive-only',
    },
  );

  expect(r.outcomes).toEqual([
    { type: 'insertWrinkle', status: 'rejected', reason: 'unknownActivity' },
    { type: 'insertPlayer', status: 'rejected', reason: 'unknownActivity' },
    { type: 'objectClick', status: 'rejected', reason: 'unknownActivity' },
    { type: 'moveCard', status: 'rejected', reason: 'unknownCard' },
    { type: 'removeCard', status: 'rejected', reason: 'unknownCard' },
    { type: 'stopCurrent', status: 'rejected', reason: 'nothingRunning' },
  ]);
  expect(r.next.queue).toEqual([]);
  expect(r.next.current).toBeNull();
  expect(r.next.nextCardSeq).toBe(s.nextCardSeq);
});

test('the package activity is wrinkle-only and cannot leak into player pickers', () => {
  const s = prepared();
  const r = step(
    s,
    [
      { type: 'insertPlayer', activityId: 'package' },
      { type: 'objectClick', activityId: 'package' },
      {
        type: 'insertWrinkle',
        wrinkleId: 'package-delivery',
        activityId: 'package',
      },
    ],
    content,
  );

  expect(r.outcomes.slice(0, 2)).toEqual([
    {
      type: 'insertPlayer',
      status: 'rejected',
      reason: 'unavailableActivity',
    },
    {
      type: 'objectClick',
      status: 'rejected',
      reason: 'unavailableActivity',
    },
  ]);
  expect(r.outcomes[2]).toMatchObject({
    type: 'insertWrinkle',
    status: 'accepted',
    wrinkleId: 'package-delivery',
  });
});
