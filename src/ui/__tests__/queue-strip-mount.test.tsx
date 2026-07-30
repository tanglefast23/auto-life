import { createRef } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, StyleSheet } from 'react-native';
import type { PublishedQueueCard } from '../../application/snapshot';
import {
  QueueStrip,
  type QueueStripHandle,
  type QueueStripProps,
  type QueueStripSnapshot,
} from '../QueueStrip';

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
    ) => callback(0, 700, 1366, 72),
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

test('mounts a 64 px current card with radial progress, Stop, upcoming glyphs, urgency, and predicted starts', () => {
  const { tree, handlers } = setup();
  const current = tree.root.findByProps({ testID: 'queue-current-card' });
  const currentStyle = StyleSheet.flatten(current.props.style);
  expect(currentStyle.width).toBe(64);
  expect(currentStyle.height).toBe(64);
  expect(tree.root.findByProps({ testID: 'queue-current-progress' }).props.accessibilityValue.now).toBe(50);

  press(current);
  expect(handlers.onStopCurrent).toHaveBeenCalledTimes(1);

  expect(tree.root.findByProps({ testID: 'queue-owner:meal' }).props.children).toBe('⌖');
  expect(tree.root.findByProps({ testID: 'queue-owner:urgent-shower' }).props.children).toBe('⚙');
  expect(tree.root.findByProps({ testID: 'queue-urgent:urgent-shower' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'queue-start:meal' }).props.children).toContain('07:30');

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

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:move-earlier' }));
  expect(handlers.onMoveCard).toHaveBeenLastCalledWith('meal', 0);

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:move-later' }));
  expect(handlers.onMoveCard).toHaveBeenLastCalledWith('meal', 2);

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:do-next' }));
  expect(handlers.onMoveCard).toHaveBeenLastCalledWith('meal', 0);

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:details' }));
  expect(tree.root.findByProps({ testID: 'queue-details:meal' })).toBeDefined();

  press(tree.root.findByProps({ testID: 'queue-menu:meal' }));
  press(tree.root.findByProps({ testID: 'queue-action:remove' }));
  expect(handlers.onRemoveCard).toHaveBeenCalledWith('meal');

  act(() => tree.unmount());
});

test('a collapsed anchor block expands before its individual cards can be edited', () => {
  const { tree } = setup();
  const block = tree.root.findByProps({ testID: 'queue-block:wake#1:wake-brush' });
  expect(block).toBeDefined();
  expect(tree.root.findAllByProps({ testID: 'queue-menu:wake-brush' })).toHaveLength(0);

  press(tree.root.findByProps({ testID: 'queue-block-expand:wake#1:wake-brush' }));

  expect(tree.root.findByProps({ testID: 'queue-menu:wake-brush' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'queue-menu:wake-breakfast' })).toBeDefined();

  act(() => tree.unmount());
});

test('the mounted Undo toast has a 44 px action and returns only its opaque receipt id', () => {
  const { tree, handlers } = setup({
    undoToast: { receiptId: 'r9', remainingMs: 5000 },
  });
  const announcement = tree.root.findByProps({
    testID: 'queue-undo-announcement',
  });
  expect(announcement.props.accessibilityLiveRegion).toBe('polite');
  expect(announcement.props.accessibilityLabel).toContain(
    'Undo available for 5 seconds',
  );
  const undo = tree.root.findByProps({ testID: 'queue-undo:r9' });
  const undoStyle = StyleSheet.flatten(undo.props.style);
  expect(undoStyle.minWidth).toBeGreaterThanOrEqual(44);
  expect(undoStyle.minHeight).toBeGreaterThanOrEqual(44);
  press(undo);
  expect(handlers.onUndo).toHaveBeenCalledWith('r9');

  act(() => tree.unmount());
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

test('synthetic PanResponder events reorder, suppress click-through, and remove off-strip', () => {
  const reordered = setup();
  const drag = reordered.tree.root.findByProps({ testID: 'queue-drag:meal' });
  const cardNode = reordered.tree.root.findByProps({ testID: 'queue-card:meal' });
  const start = responderEvent({
    previousX: 0,
    currentX: 0,
    previousY: 730,
    currentY: 730,
    timestamp: 1,
  });
  const moveRight = responderEvent({
    previousX: 0,
    currentX: 132,
    previousY: 730,
    currentY: 730,
    timestamp: 2,
  });

  act(() => {
    drag.props.onResponderGrant(start);
    drag.props.onResponderMove(moveRight);
    drag.props.onResponderRelease(moveRight);
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
  const moveAboveStrip = responderEvent({
    previousX: 0,
    currentX: 0,
    previousY: 730,
    currentY: 650,
    timestamp: 2,
  });
  act(() => {
    removeDrag.props.onResponderGrant(start);
    removeDrag.props.onResponderMove(moveAboveStrip);
    removeDrag.props.onResponderRelease(moveAboveStrip);
  });
  expect(removed.handlers.onRemoveCard).toHaveBeenCalledWith('meal');
  expect(removed.handlers.onMoveCard).not.toHaveBeenCalled();
  act(() => removed.tree.unmount());
});

test('a terminated responder cancels without moving, removing, or opening a menu', () => {
  const { tree, handlers } = setup();
  const drag = tree.root.findByProps({ testID: 'queue-drag:meal' });
  const start = responderEvent({
    previousX: 0,
    currentX: 0,
    previousY: 730,
    currentY: 730,
    timestamp: 1,
  });
  const move = responderEvent({
    previousX: 0,
    currentX: 132,
    previousY: 730,
    currentY: 730,
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

  act(() => {
    expect(imperativeRef.current?.moveFocusedCard(-1)).toBe(true);
  });
  expect(handlers.onMoveCard).toHaveBeenCalledWith('meal', 0);

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
  expect(handlers.onRemoveCard).toHaveBeenCalledWith('meal');

  act(() => {
    imperativeRef.current?.togglePalette();
  });
  expect(tree.root.findByProps({ testID: 'queue-palette' })).toBeDefined();
  act(() => {
    expect(imperativeRef.current?.closePanels()).toBe(true);
  });
  act(() => tree.unmount());
});
