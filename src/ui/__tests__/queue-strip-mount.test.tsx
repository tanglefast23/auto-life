import { createRef } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, StyleSheet, Text } from 'react-native';
import type { PublishedQueueCard } from '../../application/snapshot';
import { QUEUE_W } from '../../render/scale';
import {
  QueueStrip,
  UndoToastNotice,
  type QueueStripHandle,
  type QueueStripProps,
  type QueueStripSnapshot,
} from '../QueueStrip';
import { NoticeColumn } from '../NoticeColumn';
import { MOTION } from '../../render/motion';

const card = (
  id: string,
  activityId: string,
  over: Partial<PublishedQueueCard> = {},
): PublishedQueueCard => ({
  id,
  activityId,
  owner: 'AUTO',
  urgent: false,
  source: 'reactive',
  blockId: undefined,
  enqueuedTick: 0,
  durationTicksAtCurrentSpeed: 30,
  forecast: {
    cardId: id,
    activityId,
    predictedStartMinute: 480,
    reason: null,
    targetObjectId: 'object',
    effects: {},
    capWaste: {},
    bonuses: [],
    conflicts: [],
    wakeConflicts: [],
  },
  ...over,
});

const queue = [
  card('current', 'practice', {
    owner: 'PINNED',
    source: 'player',
    forecast: {
      cardId: 'current',
      activityId: 'practice',
      predictedStartMinute: 420,
      reason: null,
      targetObjectId: 'guitar',
      effects: {},
      capWaste: {},
      bonuses: [],
      conflicts: [],
      wakeConflicts: [],
    },
  }),
  card('meal', 'meal', {
    owner: 'PINNED',
    source: 'player',
    forecast: {
      cardId: 'meal',
      activityId: 'meal',
      predictedStartMinute: 450,
      reason: null,
      targetObjectId: 'microwave',
      effects: { nutrition: 35 },
      capWaste: { nutrition: 25 },
      bonuses: [],
      conflicts: [],
      wakeConflicts: [
        {
          wakeMinute: 420,
          responsibleCardIds: ['meal'],
        },
      ],
    },
  }),
  card('urgent-shower', 'shower', {
    urgent: true,
    forecast: {
      cardId: 'urgent-shower',
      activityId: 'shower',
      predictedStartMinute: 500,
      reason: {
        kind: 'reactiveTrigger',
        bar: 'hygiene',
        threshold: 40,
        atMinute: 480,
      },
      targetObjectId: 'shower',
      effects: { hygiene: 40 },
      capWaste: { hygiene: 5.100000000000001 },
      bonuses: [
        {
          kind: 'adjacency',
          pairId: 'warmed-up',
          effect: { kind: 'halveDuration' },
        },
      ],
      conflicts: [
        {
          bar: 'hygiene',
          atMinute: 510,
          responsibleCardIds: ['urgent-shower'],
        },
      ],
      wakeConflicts: [],
    },
  }),
  card('wake-brush', 'brush', {
    source: 'anchor',
    blockId: 'wake#1',
  }),
  card('wake-breakfast', 'meal', {
    source: 'anchor',
    blockId: 'wake#1',
  }),
];

const snapshot: QueueStripSnapshot = {
  queue,
  currentCardId: 'current',
  currentProgress: 0.5,
  forecastRevision: 1,
  bars: {
    energy: 80,
    nutrition: 75,
    movement: 70,
    hygiene: 65,
  },
};

function setup(
  over: Partial<QueueStripProps> = {},
  imperativeRef?: ReturnType<typeof createRef<QueueStripHandle | null>>,
) {
  const handlers = {
    onInsertActivity: jest.fn(),
    onStopCurrent: jest.fn(),
    onRemoveCard: jest.fn(),
    onMoveCard: jest.fn(),
    onUndo: jest.fn(),
    onWhyLineOpened: jest.fn(),
    onForecastChangeObserved: jest.fn(),
  };
  const measureInWindow = jest.fn(
    (
      callback: (x: number, y: number, width: number, height: number) => void,
    ) => callback(1142, 148, QUEUE_W, 620),
  );
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <QueueStrip
        ref={imperativeRef}
        snapshot={snapshot}
        undoToast={null}
        {...handlers}
        {...over}
      />,
      {
        createNodeMock: (element) => ({
          focus: jest.fn(),
          measureInWindow,
          testID: (element.props as { testID?: string }).testID,
        }),
      },
    );
  });
  return { tree: tree!, handlers, measureInWindow };
}

const press = (node: ReactTestInstance) => {
  act(() => {
    node.props.onPress();
  });
};

const responderEvent = ({
  previousX,
  currentX,
  previousY,
  currentY,
  timestamp,
}: {
  previousX: number;
  currentX: number;
  previousY: number;
  currentY: number;
  timestamp: number;
}) => ({
  nativeEvent: { touches: [{}] },
  touchHistory: {
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: timestamp,
    touchBank: [
      {
        touchActive: true,
        startPageX: previousX,
        startPageY: previousY,
        startTimeStamp: 1,
        currentPageX: currentX,
        currentPageY: currentY,
        currentTimeStamp: timestamp,
        previousPageX: previousX,
        previousPageY: previousY,
        previousTimeStamp: Math.max(0, timestamp - 1),
      },
    ],
  },
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.spyOn(Animated, 'loop').mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  } as unknown as ReturnType<typeof Animated.loop>);
});

test('names the active activity beside its radial progress and Stop control', () => {
  const { tree, handlers } = setup();
  const current = tree.root.findByProps({ testID: 'queue-current-card' });
  const currentStyle = StyleSheet.flatten(current.props.style);
  // A fixed box in the row, not a stretching one: box 1 is what is running.
  expect(currentStyle.width).toBeGreaterThan(0);
  expect(currentStyle.height).toBe(64);
  expect(
    tree.root.findByProps({ testID: 'queue-current-label' }).props.children,
  ).toBe('Practice');
  expect(tree.root.findByProps({ testID: 'queue-current-progress' }).props.accessibilityValue.now).toBe(50);

  press(current);
  expect(handlers.onStopCurrent).toHaveBeenCalledTimes(1);

  expect(tree.root.findByProps({ testID: 'queue-owner:meal' }).props.children).toBe('⌖');
  expect(tree.root.findByProps({ testID: 'queue-owner:urgent-shower' }).props.children).toBe('⚙');
  expect(tree.root.findByProps({ testID: 'queue-urgent:urgent-shower' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'queue-start:meal' }).props.children).toContain('07:30');

  act(() => tree.unmount());
});

test('an upcoming card is as tall as the running one, so its label cannot be clipped', () => {
  const { tree } = setup();
  const height = (testID: string): number =>
    StyleSheet.flatten(
      tree.root.findByProps({ testID }).props.style,
    ).height as number;

  // The card clips its own overflow, so its height is not cosmetic: borders (2 + 4) and
  // padding (3 + 3) take 12px, and the glyph row (14), the pixel-bold label (18) and the
  // start time (16) need 48. At the old 56 that left 44 and the label lost its bottom
  // rows mid-glyph. Asserting the two units match keeps them from drifting apart again.
  const upcoming = height('queue-card:meal');
  expect(upcoming).toBe(height('queue-current-card'));
  expect(upcoming).toBeGreaterThanOrEqual(48 + 2 + 4 + 3 + 3);

  act(() => tree.unmount());
});

test('the queue is one horizontal row of task boxes, scrolled rather than capped', () => {
  const { tree } = setup({ region: { x: 0, y: 700, width: 1000, height: 128 } });
  const railStyle = StyleSheet.flatten(
    tree.root.findByProps({ testID: 'queue-strip' }).props.style,
  );
  // The bottom bar's left run: box 1 is what is running, box 2 what is next.
  expect(railStyle).toMatchObject({
    flexDirection: 'row',
    left: 0,
    top: 700,
    width: 1000,
    height: 128,
  });

  const scroll = tree.root.findByProps({ testID: 'queue-scroll' });
  expect(scroll.props.horizontal).toBe(true);
  expect(
    StyleSheet.flatten(scroll.props.contentContainerStyle).flexDirection,
  ).toBe('row');

  // Boxes are a fixed width rather than stretching, so a long queue scrolls instead of
  // squeezing every card thinner as it grows.
  for (const id of ['meal', 'urgent-shower']) {
    const cardStyle = StyleSheet.flatten(
      tree.root.findByProps({ testID: `queue-card:${id}` }).props.style,
    );
    expect(cardStyle.flex).toBeUndefined();
    expect(cardStyle.width).toBeGreaterThan(0);
  }

  act(() => tree.unmount());
});

test('the idle current row fills the rail instead of collapsing to its label', () => {
  const { tree } = setup({
    snapshot: {
      ...snapshot,
      currentCardId: null,
      currentProgress: null,
    },
  });
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({ testID: 'queue-current-idle' }).props
        .style,
    ).flex,
  ).toBe(1);
  act(() => tree.unmount());
});

test('the + palette mounts room groups and inserts the selected activity through one semantic callback', () => {
  const { tree, handlers } = setup();
  const toggle = tree.root.findByProps({ testID: 'queue-palette-toggle' });
  const toggleStyle = StyleSheet.flatten(toggle.props.style);
  expect(toggleStyle.minWidth).toBeGreaterThanOrEqual(44);
  expect(toggleStyle.minHeight).toBeGreaterThanOrEqual(44);

  press(toggle);
  for (const room of ['bedroom', 'bathroom', 'kitchen', 'living']) {
    expect(tree.root.findByProps({ testID: `queue-palette-group:${room}` })).toBeDefined();
  }
  const practice = tree.root.findByProps({ testID: 'queue-palette-item:practice' });
  expect(practice.findAllByProps({ testID: 'queue-palette-duration:practice' }).length).toBeGreaterThan(0);
  press(practice);
  expect(handlers.onInsertActivity).toHaveBeenCalledWith('practice');

  act(() => tree.unmount());
});

test('every individual card menu exposes semantic move, do-next, remove, and details actions', () => {
  const { tree, handlers } = setup();
  expect(tree.root.findByProps({ testID: 'queue-menu:current' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'queue-menu:meal' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'queue-menu:urgent-shower' })).toBeDefined();

  press(tree.root.findByProps({ testID: 'queue-menu:urgent-shower' }));
  press(tree.root.findByProps({ testID: 'queue-action:move-earlier' }));
  expect(handlers.onMoveCard).toHaveBeenLastCalledWith(
    'urgent-shower',
    1,
  );

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:move-later' }));
  expect(handlers.onMoveCard).toHaveBeenLastCalledWith('meal', 2);

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:do-next' }));
  expect(handlers.onMoveCard).toHaveBeenLastCalledWith('meal', 1);

  press(tree.root.findByProps({ testID: 'queue-menu:urgent-shower' }));
  press(tree.root.findByProps({ testID: 'queue-action:move-later' }));
  expect(handlers.onMoveCard).toHaveBeenLastCalledWith(
    'urgent-shower',
    3,
  );

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:details' }));
  expect(tree.root.findByProps({ testID: 'queue-details:meal' })).toBeDefined();

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:remove' }));
  expect(handlers.onRemoveCard).toHaveBeenCalledWith('meal');

  act(() => tree.unmount());
});

test('every anchor action is visible and editable without expanding a block', () => {
  const { tree } = setup();
  expect(tree.root.findByProps({ testID: 'queue-menu:wake-brush' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'queue-menu:wake-breakfast' })).toBeDefined();
  expect(
    tree.root.findAllByProps({
      testID: 'queue-block:wake#1:wake-brush',
    }),
  ).toHaveLength(0);

  act(() => tree.unmount());
});

test('the mounted Undo toast has a 44 px action and returns only its opaque receipt id', () => {
  // The toast is a NOTICE entry now, not a rail surface — it used to anchor itself at
  // `right: QUEUE_W + 10` beside the rail. Its markup, ids and live region are unchanged;
  // only who positions it moved, so this mounts it where it now lives.
  const onUndo = jest.fn();
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <NoticeColumn
        region={{ x: 8, y: 400, width: 320, height: 200 }}
        items={[
          {
            id: 'undo:r9',
            node: (
              <UndoToastNotice
                undoToast={{ receiptId: 'r9', remainingMs: 5000 }}
                onUndo={onUndo}
              />
            ),
          },
        ]}
      />,
    );
  });
  const announcement = tree!.root.findByProps({
    testID: 'queue-undo-announcement',
  });
  expect(announcement.props.accessibilityLiveRegion).toBe('polite');
  expect(announcement.props.accessibilityLabel).toContain(
    'Undo available for 5 seconds',
  );
  const undo = tree!.root.findByProps({ testID: 'queue-undo:r9' });
  const undoStyle = StyleSheet.flatten(undo.props.style);
  expect(undoStyle.minWidth).toBeGreaterThanOrEqual(44);
  expect(undoStyle.minHeight).toBeGreaterThanOrEqual(44);
  press(undo);
  expect(onUndo).toHaveBeenCalledWith('r9');

  act(() => tree!.unmount());
});

test('the NOTICE stack shows at most three, then collapses the rest to a count', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: `n${i}`,
    node: <Text testID={`notice-body:${i}`}>{`notice ${i}`}</Text>,
  }));
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <NoticeColumn region={{ x: 8, y: 400, width: 320, height: 200 }} items={items} />,
    );
  });
  // An uncapped alert column is how RimWorld's right edge became a wall.
  expect(tree!.root.findAllByProps({ testID: 'notice-body:0' }).length).toBeGreaterThan(0);
  expect(tree!.root.findAllByProps({ testID: 'notice-body:2' }).length).toBeGreaterThan(0);
  expect(tree!.root.findAllByProps({ testID: 'notice-body:3' })).toHaveLength(0);
  expect(tree!.root.findByProps({ testID: 'notice-overflow' }).props.children).toBe('+2 more');

  act(() => tree!.unmount());
});

test('reduced motion removes animation while urgency keeps a visible non-colour badge', () => {
  const { tree } = setup({ reducedMotion: true });
  expect(Animated.loop).not.toHaveBeenCalled();
  expect(
    tree.root.findByProps({ testID: 'queue-urgent-badge:urgent-shower' }).props.children,
  ).toBe('!');
  const urgent = tree.root.findByProps({ testID: 'queue-card:urgent-shower' });
  expect(urgent.props.accessibilityRole).toBe('button');
  expect(urgent.props.accessibilityLabel).toContain('urgent');
  act(() => tree.unmount());
});

test('forecast copy mirrors the read model, while Goal 2 waits for an explicit Details view', () => {
  const { tree, handlers } = setup();

  expect(
    tree.root.findByProps({ testID: 'queue-conflict-chip:urgent-shower:hygiene' }),
  ).toBeDefined();
  expect(
    tree.root.findByProps({ testID: 'queue-bonus-chip:urgent-shower:warmed-up' }),
  ).toBeDefined();
  expect(
    tree.root.findByProps({ testID: 'queue-wake-chip:meal' }),
  ).toBeDefined();

  const shower = tree.root.findByProps({ testID: 'queue-card:urgent-shower' });
  expect(shower.props.accessibilityLabel).toContain(
    'Added: Hygiene drops past 40 around 08:00.',
  );
  expect(shower.props.accessibilityLabel).toContain(
    'Hygiene drops below 15 around 08:30.',
  );
  expect(shower.props.accessibilityLabel).toContain('Takes half the usual time.');

  press(tree.root.findByProps({ testID: 'queue-menu:urgent-shower' }));
  press(tree.root.findByProps({ testID: 'queue-action:details' }));
  expect(
    tree.root.findByProps({ testID: 'queue-why:urgent-shower' }).props.children,
  ).toBe('Added: Hygiene drops past 40 around 08:00.');
  expect(
    tree.root.findByProps({ testID: 'queue-cap-waste:urgent-shower:hygiene' })
      .props.children,
  ).toBe('5.1 Hygiene may be wasted at full.');
  expect(handlers.onWhyLineOpened).toHaveBeenCalledWith('urgent-shower');
  press(
    tree.root
      .findAllByProps({ accessibilityLabel: 'Close' })
      .filter((node) => typeof node.props.onPress === 'function')
      .at(-1)!,
  );

  act(() => {
    tree.update(
      <QueueStrip
        snapshot={{ ...snapshot, forecastRevision: 2 }}
        undoToast={null}
        {...handlers}
      />,
    );
  });
  expect(handlers.onForecastChangeObserved).not.toHaveBeenCalled();
  const announcement = tree.root.findByProps({
    testID: 'queue-forecast-announcement',
  });
  expect(announcement.props.accessibilityLiveRegion).toBe('polite');
  expect(announcement.props.children).toBe('Forecast updated.');

  press(tree.root.findByProps({ testID: 'queue-menu:urgent-shower' }));
  press(tree.root.findByProps({ testID: 'queue-action:details' }));
  expect(handlers.onForecastChangeObserved).toHaveBeenCalledTimes(1);

  act(() => tree.unmount());
});

test('Practice exposes its consecutive-block advantage as a legible chip and detail', () => {
  const blockedPractice = card('blocked-practice', 'practice', {
    owner: 'PINNED',
    source: 'player',
    forecast: {
      cardId: 'blocked-practice',
      activityId: 'practice',
      predictedStartMinute: 560,
      reason: null,
      targetObjectId: 'guitar',
      effects: {},
      capWaste: {},
      bonuses: [
        {
          kind: 'practiceBlock',
          blockFactor: 0.85,
          scatteredFactor: 0.7,
        },
      ],
      conflicts: [],
      wakeConflicts: [],
    },
  });
  const { tree } = setup({
    snapshot: {
      ...snapshot,
      queue: [...queue, blockedPractice],
    },
  });

  expect(
    tree.root.findByProps({
      testID: 'queue-bonus-chip:blocked-practice:practice-block',
    }).props.children,
  ).toBe('Block');

  press(tree.root.findByProps({ testID: 'queue-menu:blocked-practice' }));
  press(tree.root.findByProps({ testID: 'queue-action:details' }));
  expect(
    tree.root.findAll(
      (node) => node.props.children === 'Keeps 85% of base instead of 70%.',
    ).length,
  ).toBeGreaterThan(0);

  act(() => tree.unmount());
});

/**
 * The other half of the same question. A Practice past the day's cap earns exactly zero,
 * and before this chip it looked identical to the day's *first* Practice — the one card
 * where the absence of "Block" means the opposite thing.
 */
test('a Practice past the day’s cap says so, instead of just dropping the Block chip', () => {
  const uncounted = card('spare-practice', 'practice', {
    owner: 'PINNED',
    source: 'player',
    forecast: {
      cardId: 'spare-practice',
      activityId: 'practice',
      predictedStartMinute: 560,
      reason: null,
      targetObjectId: 'guitar',
      effects: {},
      capWaste: {},
      bonuses: [],
      practiceUncounted: true,
      conflicts: [],
      wakeConflicts: [],
    },
  });
  const { tree } = setup({
    snapshot: { ...snapshot, queue: [...queue, uncounted] },
  });

  expect(
    tree.root.findByProps({ testID: 'queue-uncounted-chip:spare-practice' })
      .props.children,
  ).toBe('No points');

  // A card that scores nothing must say so to a screen reader too, not only in pixels.
  expect(
    tree.root.findByProps({ testID: 'queue-card:spare-practice' })
      .props.accessibilityLabel,
  ).toContain('This one earns nothing.');

  act(() => tree.unmount());
});

test('announced wrinkle gates show a non-color chip and a concrete Details line', () => {
  const blocked = card('blocked-shower', 'shower', {
    owner: 'PINNED',
    source: 'player',
    forecast: {
      cardId: 'blocked-shower',
      activityId: 'shower',
      predictedStartMinute: null,
      reason: null,
      targetObjectId: 'shower',
      effects: {},
      capWaste: {},
      bonuses: [],
      conflicts: [],
      wakeConflicts: [],
      startConstraint: {
        kind: 'wait',
        reason: 'object-blocked',
        untilMinute: 570,
        targetId: 'shower',
        source: {
          wrinkleId: 'repair-visit',
          variantId: 'repair-bathroom',
          day: 2,
        },
      },
    },
  });
  const rerouted = card('rerouted-shower', 'shower', {
    forecast: {
      cardId: 'rerouted-shower',
      activityId: 'shower',
      predictedStartMinute: 500,
      reason: null,
      targetObjectId: 'shower',
      effects: {},
      capWaste: {},
      bonuses: [],
      conflicts: [],
      wakeConflicts: [],
      startConstraint: {
        kind: 'reroute',
        reason: 'urgent-hygiene-fallback',
        activityId: 'quickwash',
        source: {
          wrinkleId: 'repair-visit',
          variantId: 'repair-bathroom',
          day: 2,
        },
      },
    },
  });
  const { tree } = setup({
    snapshot: {
      ...snapshot,
      queue: [...queue, blocked, rerouted],
    },
  });

  expect(
    tree.root.findByProps({
      testID: 'queue-start-constraint:blocked-shower',
    }).props.children,
  ).toBe('Blocked');
  expect(
    tree.root.findByProps({
      testID: 'queue-start-constraint:rerouted-shower',
    }).props.children,
  ).toBe('Quick wash');

  press(tree.root.findByProps({ testID: 'queue-menu:blocked-shower' }));
  press(tree.root.findByProps({ testID: 'queue-action:details' }));
  expect(
    tree.root.findByProps({
      testID: 'queue-start-constraint-detail:blocked-shower',
    }).props.children,
  ).toBe('Shower is blocked until 09:30.');

  act(() => tree.unmount());
});

test('synthetic PanResponder events reorder, suppress click-through, and remove off-strip', () => {
  const reordered = setup();
  const drag = reordered.tree.root.findByProps({ testID: 'queue-drag:meal' });
  const cardNode = reordered.tree.root.findByProps({ testID: 'queue-card:meal' });
  const start = responderEvent({
    previousX: 1200,
    currentX: 1200,
    previousY: 250,
    currentY: 250,
    timestamp: 1,
  });
  const moveDown = responderEvent({
    previousX: 1200,
    currentX: 1200,
    previousY: 250,
    currentY: 312,
    timestamp: 2,
  });

  act(() => {
    drag.props.onResponderGrant(start);
    drag.props.onResponderMove(moveDown);
    drag.props.onResponderRelease(moveDown);
    cardNode.props.onPress();
  });

  expect(reordered.handlers.onMoveCard).toHaveBeenCalledWith('meal', 2);
  expect(
    reordered.tree.root.findAllByProps({ testID: 'queue-card-menu' }),
  ).toHaveLength(0);
  act(() => reordered.tree.unmount());

  const removed = setup();
  const removeDrag = removed.tree.root.findByProps({
    testID: 'queue-drag:meal',
  });
  const moveOutsideRail = responderEvent({
    previousX: 1200,
    currentX: 1100,
    previousY: 250,
    currentY: 250,
    timestamp: 2,
  });
  act(() => {
    removeDrag.props.onResponderGrant(start);
    removeDrag.props.onResponderMove(moveOutsideRail);
    removeDrag.props.onResponderRelease(moveOutsideRail);
  });
  expect(removed.handlers.onRemoveCard).toHaveBeenCalledWith('meal');
  expect(removed.handlers.onMoveCard).not.toHaveBeenCalled();
  act(() => removed.tree.unmount());
});

test('a terminated responder cancels without moving, removing, or opening a menu', () => {
  const { tree, handlers } = setup();
  const drag = tree.root.findByProps({ testID: 'queue-drag:meal' });
  const start = responderEvent({
    previousX: 1200,
    currentX: 1200,
    previousY: 250,
    currentY: 250,
    timestamp: 1,
  });
  const move = responderEvent({
    previousX: 1200,
    currentX: 1200,
    previousY: 250,
    currentY: 312,
    timestamp: 2,
  });
  act(() => {
    drag.props.onResponderGrant(start);
    drag.props.onResponderMove(move);
    drag.props.onResponderTerminate(move);
  });
  expect(handlers.onMoveCard).not.toHaveBeenCalled();
  expect(handlers.onRemoveCard).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: 'queue-card-menu' })).toHaveLength(0);
  act(() => tree.unmount());
});

test('its imperative keyboard surface focuses, traverses, moves, opens, removes, and closes without a mouse', () => {
  const imperativeRef = createRef<QueueStripHandle | null>();
  const { tree, handlers } = setup({}, imperativeRef);
  expect(imperativeRef.current?.focusQueue()).toBe(true);
  expect(imperativeRef.current?.moveQueueFocus(1)).toBe(true);
  expect(imperativeRef.current?.moveQueueFocus(1)).toBe(true);

  act(() => {
    expect(imperativeRef.current?.moveFocusedCard(-1)).toBe(true);
  });
  expect(handlers.onMoveCard).toHaveBeenCalledWith(
    'urgent-shower',
    1,
  );

  act(() => {
    expect(imperativeRef.current?.openFocusedMenu()).toBe(true);
  });
  expect(tree.root.findByProps({ testID: 'queue-card-menu' })).toBeDefined();
  act(() => {
    expect(imperativeRef.current?.closePanels()).toBe(true);
  });

  act(() => {
    expect(imperativeRef.current?.removeFocused()).toBe(true);
  });
  expect(handlers.onRemoveCard).toHaveBeenCalledWith(
    'urgent-shower',
  );

  act(() => {
    imperativeRef.current?.togglePalette();
  });
  expect(tree.root.findByProps({ testID: 'queue-palette' })).toBeDefined();
  act(() => {
    expect(imperativeRef.current?.closePanels()).toBe(true);
  });
  act(() => tree.unmount());
});

/**
 * P6 T11 — departures, replayed.
 *
 * A card that enters animates itself, so it needs no test beyond mounting. A card that
 * leaves is already gone from the snapshot when the strip re-renders, so the ghost layer
 * is the only place design.md §10's removal squash and SPEC §11.3's completion poof can
 * live — and the only place they can break.
 */
describe('departing cards (design.md §10, SPEC §11.3)', () => {
  const twoCards: QueueStripSnapshot = {
    ...snapshot,
    currentCardId: null,
    queue: [card('a', 'meal'), card('b', 'shower')],
  };
  const oneCard: QueueStripSnapshot = { ...twoCards, queue: [card('a', 'meal')] };

  const render = (props: Partial<QueueStripProps> = {}) => {
    const handlers = {
      onInsertActivity: jest.fn(),
      onStopCurrent: jest.fn(),
      onRemoveCard: jest.fn(),
      onMoveCard: jest.fn(),
      onUndo: jest.fn(),
      onWhyLineOpened: jest.fn(),
      onForecastChangeObserved: jest.fn(),
    };
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <QueueStrip snapshot={twoCards} undoToast={null} {...handlers} {...props} />,
        { createNodeMock: () => ({ focus: jest.fn(), measureInWindow: jest.fn() }) },
      );
    });
    return { tree: tree!, handlers };
  };

  const ghosts = (tree: ReactTestRenderer) =>
    tree.root.findAll(
      (node) =>
        typeof (node.props as { testID?: string }).testID === 'string' &&
        (node.props as { testID: string }).testID.startsWith('queue-ghost:'),
      { deep: false },
    );

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('a removed card squashes out and then stops existing', () => {
    const { tree } = render();
    expect(ghosts(tree)).toHaveLength(0);

    act(() => {
      tree.update(
        <QueueStrip
          snapshot={oneCard}
          undoToast={null}
          onInsertActivity={jest.fn()}
          onStopCurrent={jest.fn()}
          onRemoveCard={jest.fn()}
          onMoveCard={jest.fn()}
          onUndo={jest.fn()}
          onWhyLineOpened={jest.fn()}
          onForecastChangeObserved={jest.fn()}
        />,
      );
    });
    const live = ghosts(tree);
    expect(live).toHaveLength(1);
    expect((live[0]!.props as { testID: string }).testID).toBe('queue-ghost:exit:b');

    // 90 ms later it is gone, and nothing is left holding a slot in the strip.
    act(() => {
      jest.advanceTimersByTime(MOTION.cardRemove.durationMs + 1);
    });
    expect(ghosts(tree)).toHaveLength(0);
    act(() => tree.unmount());
  });

  test('a completed card poofs instead, and only because the recap says so', () => {
    const { tree } = render();
    act(() => {
      tree.update(
        <QueueStrip
          snapshot={oneCard}
          undoToast={null}
          completedActivityIds={['shower']}
          onInsertActivity={jest.fn()}
          onStopCurrent={jest.fn()}
          onRemoveCard={jest.fn()}
          onMoveCard={jest.fn()}
          onUndo={jest.fn()}
          onWhyLineOpened={jest.fn()}
          onForecastChangeObserved={jest.fn()}
        />,
      );
    });
    const live = ghosts(tree);
    expect(live).toHaveLength(1);
    expect((live[0]!.props as { testID: string }).testID).toBe('queue-ghost:complete:b');
    expect(
      tree.root.findAll(
        (n) => String(n.props.testID).startsWith('queue-poof-frame:'),
        { deep: false },
      ),
    ).toHaveLength(1);
    act(() => tree.unmount());
  });

  test('a ghost is inert: no focus, no announcement, no colliding test id', () => {
    const { tree } = render();
    act(() => {
      tree.update(
        <QueueStrip
          snapshot={oneCard}
          undoToast={null}
          onInsertActivity={jest.fn()}
          onStopCurrent={jest.fn()}
          onRemoveCard={jest.fn()}
          onMoveCard={jest.fn()}
          onUndo={jest.fn()}
          onWhyLineOpened={jest.fn()}
          onForecastChangeObserved={jest.fn()}
        />,
      );
    });
    const ghost = ghosts(tree)[0]!;
    expect(ghost.props.importantForAccessibility).toBe('no');
    expect(ghost.props.accessibilityElementsHidden).toBe(true);
    expect(ghost.props.pointerEvents).toBe('none');
    // The live card's id is gone from the tree entirely — a ghost that reused it would
    // make every existing findByProps in this file ambiguous.
    expect(tree.root.findAll((n) => n.props.testID === 'queue-card:b')).toHaveLength(0);
    act(() => tree.unmount());
  });

  test('reduced motion removes the card without a ghost at all (SPEC §11.6)', () => {
    const { tree } = render({ reducedMotion: true });
    act(() => {
      tree.update(
        <QueueStrip
          snapshot={oneCard}
          undoToast={null}
          reducedMotion
          completedActivityIds={['shower']}
          onInsertActivity={jest.fn()}
          onStopCurrent={jest.fn()}
          onRemoveCard={jest.fn()}
          onMoveCard={jest.fn()}
          onUndo={jest.fn()}
          onWhyLineOpened={jest.fn()}
          onForecastChangeObserved={jest.fn()}
        />,
      );
    });
    // The state change the setting promises to keep has already happened: the card is gone.
    expect(ghosts(tree)).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props.testID === 'queue-card:b')).toHaveLength(0);
    act(() => tree.unmount());
  });

  test('the urgency pulse is timed by the motion table, not by a local constant', () => {
    expect(MOTION.urgentPulse.durationMs).toBeGreaterThan(0);
    expect(MOTION.urgentPulse.decorative).toBe(true);
  });
});
