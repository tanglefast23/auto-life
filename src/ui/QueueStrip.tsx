import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GameSnapshot, PublishedQueueCard } from '../application/snapshot';
import type { UndoToast } from '../application/loop';
import { activityDurationTicksAtCurrentSpeed } from '../sim/activities';
import { activityByIdIn, content } from '../sim/content';
import { toFixed } from '../sim/fixed';
import { QUEUE_H } from '../render/scale';
import { formatTimeOfDay } from './clock-format';
import {
  activityCopy,
  blockLabel,
  groupQueueForStrip,
  type QueueStripBlockItem,
} from './queue-presenter';
import {
  bonusChipLabel,
  bonusDetail,
  capWasteDetail,
  conflictDetail,
  queueStrings,
  wakeConflictDetail,
  whyLine,
} from './queue-copy';
import {
  queueDragDecision,
  shouldStartQueueDrag,
  type QueueDragGesture,
} from './queue-drag';

export type QueueStripSnapshot = Pick<
  GameSnapshot,
  'queue' | 'currentCardId' | 'currentProgress' | 'bars' | 'forecastRevision'
>;

export interface QueueStripProps {
  snapshot: QueueStripSnapshot | null;
  undoToast: UndoToast | null;
  onInsertActivity: (activityId: string) => void;
  onStopCurrent: () => void;
  onRemoveCard: (cardId: string) => void;
  onMoveCard: (cardId: string, toIndex: number) => void;
  onUndo: (receiptId: string) => void;
  onWhyLineOpened: (cardId: string) => void;
  onForecastChangeObserved: () => void;
  reducedMotion?: boolean;
}

export interface QueueStripHandle {
  focusQueue: () => boolean;
  hasQueueFocus: () => boolean;
  moveQueueFocus: (direction: -1 | 1) => boolean;
  moveFocusedCard: (direction: -1 | 1) => boolean;
  openFocusedMenu: () => boolean;
  removeFocused: () => boolean;
  togglePalette: () => void;
  closePanels: () => boolean;
}

type MenuTarget =
  | { kind: 'card'; cardId: string }
  | { kind: 'block'; itemKey: string };

interface PaletteActivity {
  id: string;
  label: string;
  glyph: string;
  duration: string;
  effect: string;
}

interface PaletteGroup {
  room: string;
  activities: PaletteActivity[];
}

const cardFocusToken = (cardId: string): string => `card:${cardId}`;

const CREAM_LIGHT = '#faf1dc';
const CREAM_BASE = '#f2e4c2';
const CREAM_SHADOW = '#d9c493';
const INK = '#2e2119';
const RED = '#c8402e';
const RED_LIGHT = '#e8705a';
const BLUE = '#5b95c0';
const BLUE_LIGHT = '#a8d0e8';
const PLUM = '#6b4f74';
const ROOM_ORDER = ['bedroom', 'bathroom', 'kitchen', 'living'] as const;
const ROOM_ACCENT: Record<string, string> = {
  bedroom: '#6b4f74',
  bathroom: '#5b95c0',
  kitchen: '#5ca860',
  living: '#bc6b42',
};

export const QueueStrip = forwardRef<QueueStripHandle, QueueStripProps>(
  function QueueStrip(
    {
      snapshot,
      undoToast,
      onInsertActivity,
      onStopCurrent,
      onRemoveCard,
      onMoveCard,
      onUndo,
      onWhyLineOpened,
      onForecastChangeObserved,
      reducedMotion = false,
    },
    imperativeRef,
  ) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<MenuTarget | null>(null);
  const [forecastAnnouncement, setForecastAnnouncement] = useState('');
  const [expandedBlocks, setExpandedBlocks] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pulse = useRef(new Animated.Value(1)).current;
  const focusRefs = useRef(new Map<string, View>());
  const focusedToken = useRef<string | null>(null);
  const paletteToggleRef = useRef<View | null>(null);
  const paletteFirstRef = useRef<View | null>(null);
  const menuFirstRef = useRef<View | null>(null);
  const lastForecastRevision = useRef<number | null>(null);
  const forecastChangeAwaitingView = useRef(false);
  const stripRef = useRef<View | null>(null);
  const stripBounds = useRef<{ top: number; bottom: number } | null>(null);

  const queue = snapshot?.queue ?? [];
  const current =
    snapshot?.currentCardId === null || snapshot?.currentCardId === undefined
      ? null
      : queue.find((card) => card.id === snapshot.currentCardId) ?? null;
  const items = useMemo(
    () => groupQueueForStrip(queue, snapshot?.currentCardId ?? null),
    [queue, snapshot?.currentCardId],
  );
  const hasUrgent = queue.some((card) => card.urgent);
  const paletteGroups = useMemo(
    () => buildPaletteGroups(snapshot),
    [snapshot?.bars.energy, snapshot?.bars.hygiene, snapshot?.bars.movement, snapshot?.bars.nutrition],
  );
  const atPlayerCap = queue.filter((card) => card.source === 'player').length >= 10;
  const focusTokens = useMemo(() => {
    const tokens: string[] = [];
    if (current !== null) tokens.push(cardFocusToken(current.id));
    for (const item of items) {
      if (item.kind === 'card') tokens.push(cardFocusToken(item.card.id));
      else if (expandedBlocks.has(item.key)) {
        tokens.push(...item.cards.map((card) => cardFocusToken(card.id)));
      } else {
        tokens.push(item.key);
      }
    }
    return tokens;
  }, [current, expandedBlocks, items]);

  useEffect(() => {
    if (!hasUrgent || reducedMotion) {
      pulse.setValue(1);
      return;
    }
    const useNativeDriver = Platform.OS !== 'web';
    const phase = (toValue: number) =>
      Animated.timing(pulse, {
        toValue,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver,
      });
    const animation = Animated.loop(
      Animated.sequence([phase(0.25), phase(1)]),
    );
    animation.start();
    return () => animation.stop();
  }, [hasUrgent, pulse, reducedMotion]);

  useEffect(() => {
    if (paletteOpen) paletteFirstRef.current?.focus();
  }, [paletteOpen]);

  useEffect(() => {
    if (menuTarget !== null) menuFirstRef.current?.focus();
  }, [menuTarget]);

  useEffect(() => {
    const revision = snapshot?.forecastRevision;
    if (revision === undefined) {
      lastForecastRevision.current = null;
      forecastChangeAwaitingView.current = false;
      return;
    }
    const previous = lastForecastRevision.current;
    lastForecastRevision.current = revision;
    if (previous !== null && previous !== revision) {
      setForecastAnnouncement(queueStrings.announcements.forecastUpdated);
      forecastChangeAwaitingView.current = true;
    }
  }, [snapshot?.forecastRevision]);

  // The live announcement is automatic, but Goal 2 requires a deliberate
  // observation. Opening Details is the explicit forecast affordance in P4; a
  // cache revision alone must not silently award the goal.
  useEffect(() => {
    if (
      detailsTarget !== null &&
      forecastChangeAwaitingView.current
    ) {
      forecastChangeAwaitingView.current = false;
      onForecastChangeObserved();
    }
  }, [
    detailsTarget,
    onForecastChangeObserved,
    snapshot?.forecastRevision,
  ]);

  const openPalette = () => {
    setMenuTarget(null);
    setDetailsTarget(null);
    if (paletteOpen) {
      setPaletteOpen(false);
      paletteToggleRef.current?.focus();
    } else {
      setPaletteOpen(true);
    }
  };
  const openCardMenu = (cardId: string) => {
    setPaletteOpen(false);
    setDetailsTarget(null);
    setMenuTarget((open) =>
      open?.kind === 'card' && open.cardId === cardId
        ? null
        : { kind: 'card', cardId },
    );
  };
  const openBlockMenu = (itemKey: string) => {
    setPaletteOpen(false);
    setDetailsTarget(null);
    setMenuTarget((open) =>
      open?.kind === 'block' && open.itemKey === itemKey
        ? null
        : { kind: 'block', itemKey },
    );
  };
  const toggleBlock = (itemKey: string) => {
    setExpandedBlocks((prior) => {
      const next = new Set(prior);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
    setMenuTarget(null);
  };

  const closePanelsAndRestoreFocus = (): boolean => {
    const hadOpenPanel =
      paletteOpen || menuTarget !== null || detailsTarget !== null;
    const restorePaletteToggle = paletteOpen;
    setPaletteOpen(false);
    setMenuTarget(null);
    setDetailsTarget(null);
    if (restorePaletteToggle) {
      paletteToggleRef.current?.focus();
    } else {
      const token = focusedToken.current;
      if (token !== null) focusToken(token);
    }
    return hadOpenPanel;
  };

  const registerFocus =
    (token: string) =>
    (node: View | null): void => {
      if (node === null) focusRefs.current.delete(token);
      else focusRefs.current.set(token, node);
    };

  const focusToken = (token: string): boolean => {
    const node = focusRefs.current.get(token);
    if (node === undefined) return false;
    focusedToken.current = token;
    node.focus();
    return true;
  };

  const hasQueueFocus = (): boolean => {
    const token = focusedToken.current;
    if (token === null || !focusTokens.includes(token)) return false;
    if (typeof document === 'undefined') return true;
    return document.activeElement === (focusRefs.current.get(token) as unknown);
  };

  useImperativeHandle(
    imperativeRef,
    (): QueueStripHandle => ({
      focusQueue: () => {
        setPaletteOpen(false);
        setMenuTarget(null);
        setDetailsTarget(null);
        const first = focusTokens[0];
        return first !== undefined && focusToken(first);
      },
      hasQueueFocus,
      moveQueueFocus: (direction) => {
        if (!hasQueueFocus()) return false;
        const at = focusTokens.indexOf(focusedToken.current ?? '');
        if (at === -1) return false;
        const next = Math.max(0, Math.min(focusTokens.length - 1, at + direction));
        return focusToken(focusTokens[next]!);
      },
      moveFocusedCard: (direction) => {
        if (!hasQueueFocus()) return false;
        const token = focusedToken.current;
        if (token === null || !token.startsWith('card:')) return false;
        const cardId = token.slice('card:'.length);
        if (cardId === snapshot?.currentCardId) return false;
        const index = queue.findIndex((card) => card.id === cardId);
        if (index === -1) return false;
        const target = Math.max(0, Math.min(queue.length - 1, index + direction));
        if (target === index) return false;
        onMoveCard(cardId, target);
        return true;
      },
      openFocusedMenu: () => {
        if (!hasQueueFocus()) return false;
        const token = focusedToken.current;
        if (token === null) return false;
        if (token.startsWith('card:')) openCardMenu(token.slice('card:'.length));
        else openBlockMenu(token);
        return true;
      },
      removeFocused: () => {
        if (!hasQueueFocus()) return false;
        const token = focusedToken.current;
        if (token === null) return false;
        if (token.startsWith('card:')) {
          onRemoveCard(token.slice('card:'.length));
        } else {
          // Whole-block removal is out of scope. Its menu leads with "expand to edit."
          openBlockMenu(token);
        }
        return true;
      },
      togglePalette: openPalette,
      closePanels: () => {
        return closePanelsAndRestoreFocus();
      },
    }),
    [
      detailsTarget,
      focusTokens,
      menuTarget,
      onMoveCard,
      onRemoveCard,
      paletteOpen,
      queue,
      snapshot?.currentCardId,
    ],
  );

  const menuCard =
    menuTarget?.kind === 'card'
      ? queue.find((card) => card.id === menuTarget.cardId) ?? null
      : null;
  const menuBlock =
    menuTarget?.kind === 'block'
      ? items.find(
          (item): item is QueueStripBlockItem =>
            item.kind === 'block' && item.key === menuTarget.itemKey,
        ) ?? null
      : null;
  const detailCard =
    detailsTarget?.kind === 'card'
      ? queue.find((card) => card.id === detailsTarget.cardId) ?? null
      : null;
  const detailBlock =
    detailsTarget?.kind === 'block'
      ? items.find(
          (item): item is QueueStripBlockItem =>
            item.kind === 'block' && item.key === detailsTarget.itemKey,
        ) ?? null
      : null;

  const runCardAction = (action: 'earlier' | 'later' | 'next' | 'remove' | 'details') => {
    if (menuCard === null) return;
    const index = queue.findIndex((card) => card.id === menuCard.id);
    if (action === 'earlier') onMoveCard(menuCard.id, Math.max(0, index - 1));
    else if (action === 'later') onMoveCard(menuCard.id, Math.min(queue.length - 1, index + 1));
    else if (action === 'next') onMoveCard(menuCard.id, 0);
    else if (action === 'remove') onRemoveCard(menuCard.id);
    else {
      if (whyLine(menuCard.forecast.reason) !== null) {
        onWhyLineOpened(menuCard.id);
      }
      setDetailsTarget({ kind: 'card', cardId: menuCard.id });
    }
    setMenuTarget(null);
  };

  const measureStrip = () => {
    stripRef.current?.measureInWindow((_x, y, _width, height) => {
      stripBounds.current = { top: y, bottom: y + height };
    });
  };

  const finishCardDrag = (cardId: string, gesture: QueueDragGesture) => {
    const fromIndex = queue.findIndex((card) => card.id === cardId);
    if (fromIndex === -1) return;
    const decision = queueDragDecision({
      gesture,
      fromIndex,
      cardCount: queue.length,
      stripTop: stripBounds.current?.top ?? null,
      stripBottom: stripBounds.current?.bottom ?? null,
    });
    if (decision.kind === 'remove') onRemoveCard(cardId);
    else if (decision.kind === 'move') onMoveCard(cardId, decision.toIndex);
  };

  return (
    <View ref={stripRef} style={styles.root} testID="queue-strip">
      <View style={styles.currentSlot}>
        {current === null ? (
          <View style={[styles.currentCard, styles.idleCard]} testID="queue-current-idle">
            <Text style={styles.idleGlyph}>·</Text>
            <Text style={styles.currentFoot}>IDLE</Text>
          </View>
        ) : (
          <>
            <CurrentCard
              card={current}
              progress={snapshot?.currentProgress ?? 0}
              onStop={onStopCurrent}
              focusRef={registerFocus(cardFocusToken(current.id))}
              onFocus={() => {
                focusedToken.current = cardFocusToken(current.id);
              }}
            />
            <MenuButton
              cardId={current.id}
              label={`Open ${activityCopy(current.activityId).label} menu`}
              onPress={() => openCardMenu(current.id)}
            />
          </>
        )}
      </View>

      <Text
        accessible
        accessibilityLiveRegion="polite"
        testID="queue-forecast-announcement"
        style={styles.srOnly}
      >
        {forecastAnnouncement}
      </Text>

      <View style={styles.rule} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.queueScroll}
        contentContainerStyle={styles.queueContent}
      >
        {items.length === 0 && (
          <View style={styles.emptyQueue}>
            <Text style={styles.emptyQueueText}>QUEUE CLEAR</Text>
          </View>
        )}
        {items.map((item) =>
          item.kind === 'card' ? (
            <UpcomingCard
              key={item.key}
              card={item.card}
              pulse={pulse}
              onMenu={() => openCardMenu(item.card.id)}
              onDragStart={measureStrip}
              onDragRelease={(gesture) =>
                finishCardDrag(item.card.id, gesture)
              }
              focusRef={registerFocus(cardFocusToken(item.card.id))}
              onFocus={() => {
                focusedToken.current = cardFocusToken(item.card.id);
              }}
            />
          ) : expandedBlocks.has(item.key) ? (
            <View key={item.key} style={styles.expandedBlock}>
              <Pressable
                onPress={() => toggleBlock(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`Collapse ${blockLabel(item.blockId)}`}
                testID={`queue-block-collapse:${item.blockId}:${item.cards[0]!.id}`}
                style={styles.collapseButton}
              >
                <Text style={styles.collapseText}>◂</Text>
              </Pressable>
              {item.cards.map((card) => (
                <UpcomingCard
                  key={card.id}
                  card={card}
                  pulse={pulse}
                  onMenu={() => openCardMenu(card.id)}
                  onDragStart={measureStrip}
                  onDragRelease={(gesture) =>
                    finishCardDrag(card.id, gesture)
                  }
                  focusRef={registerFocus(cardFocusToken(card.id))}
                  onFocus={() => {
                    focusedToken.current = cardFocusToken(card.id);
                  }}
                />
              ))}
            </View>
          ) : (
            <CollapsedBlock
              key={item.key}
              item={item}
              pulse={pulse}
              onExpand={() => toggleBlock(item.key)}
              onMenu={() => openBlockMenu(item.key)}
              focusRef={registerFocus(item.key)}
              onFocus={() => {
                focusedToken.current = item.key;
              }}
            />
          ),
        )}
      </ScrollView>

      <Pressable
        ref={(node) => {
          paletteToggleRef.current = node;
        }}
        onPress={openPalette}
        accessibilityRole="button"
        accessibilityLabel="Add an activity"
        accessibilityState={{ expanded: paletteOpen, disabled: atPlayerCap }}
        disabled={atPlayerCap}
        testID="queue-palette-toggle"
        style={[styles.paletteToggle, atPlayerCap && styles.controlDisabled]}
      >
        <Text style={styles.palettePlus}>+</Text>
        <Text style={styles.paletteCount}>{`${queue.filter((card) => card.source === 'player').length}/10`}</Text>
      </Pressable>

      {paletteOpen && (
        <PalettePanel
          groups={paletteGroups}
          firstItemRef={(node) => {
            paletteFirstRef.current = node;
          }}
          onChoose={(activityId) => {
            onInsertActivity(activityId);
            setPaletteOpen(false);
            paletteToggleRef.current?.focus();
          }}
          onClose={closePanelsAndRestoreFocus}
        />
      )}

      {menuCard !== null && (
        <CardMenu
          current={menuCard.id === snapshot?.currentCardId}
          canMoveEarlier={queue.findIndex((card) => card.id === menuCard.id) > 0}
          canMoveLater={queue.findIndex((card) => card.id === menuCard.id) < queue.length - 1}
          onStop={() => {
            onStopCurrent();
            closePanelsAndRestoreFocus();
          }}
          onAction={runCardAction}
          firstActionRef={(node) => {
            menuFirstRef.current = node;
          }}
          onClose={closePanelsAndRestoreFocus}
        />
      )}

      {menuBlock !== null && (
        <BlockMenu
          block={menuBlock}
          onExpand={() => toggleBlock(menuBlock.key)}
          onDetails={() => {
            const reasonCard = menuBlock.cards.find(
              (card) => whyLine(card.forecast.reason) !== null,
            );
            if (reasonCard !== undefined) onWhyLineOpened(reasonCard.id);
            setDetailsTarget({ kind: 'block', itemKey: menuBlock.key });
            setMenuTarget(null);
          }}
          onClose={closePanelsAndRestoreFocus}
          firstActionRef={(node) => {
            menuFirstRef.current = node;
          }}
        />
      )}

      {(detailCard !== null || detailBlock !== null) && (
        <DetailsPanel
          card={detailCard}
          block={detailBlock}
          onClose={closePanelsAndRestoreFocus}
        />
      )}

      {undoToast !== null && (
        <View style={styles.toast} testID="queue-undo-toast">
          <Text
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel="Removed from queue. Undo available for 5 seconds."
            testID="queue-undo-announcement"
            style={styles.toastText}
          >
            Removed from queue
          </Text>
          <Pressable
            onPress={() => onUndo(undoToast.receiptId)}
            accessibilityRole="button"
            accessibilityLabel="Undo removed activity"
            testID={`queue-undo:${undoToast.receiptId}`}
            style={styles.undoButton}
          >
            <Text style={styles.undoText}>UNDO</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
  },
);

function CurrentCard({
  card,
  progress,
  onStop,
  focusRef,
  onFocus,
}: {
  card: PublishedQueueCard;
  progress: number;
  onStop: () => void;
  focusRef: (node: View | null) => void;
  onFocus: () => void;
}) {
  const copy = activityCopy(card.activityId);
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const filled = Math.round((percent / 100) * 8);
  return (
    <Pressable
      ref={focusRef}
      onPress={onStop}
      onFocus={onFocus}
      accessibilityRole="button"
      accessibilityLabel={`Stop ${copy.label}, ${percent} percent complete`}
      testID="queue-current-card"
      style={styles.currentCard}
    >
      <View
        style={styles.progressRing}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        testID="queue-current-progress"
      >
        {Array.from({ length: 8 }, (_, index) => {
          const angle = index * 45;
          const radians = (angle * Math.PI) / 180;
          return (
            <View
              key={angle}
              style={[
                styles.progressPip,
                {
                  left: 20 + Math.sin(radians) * 17,
                  top: 20 - Math.cos(radians) * 17,
                  backgroundColor: index < filled ? BLUE : CREAM_SHADOW,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}
        <Text style={styles.currentGlyph}>{copy.glyph}</Text>
      </View>
      <Text numberOfLines={1} style={styles.currentFoot}>
        STOP
      </Text>
    </Pressable>
  );
}

function UpcomingCard({
  card,
  pulse,
  onMenu,
  onDragStart,
  onDragRelease,
  focusRef,
  onFocus,
}: {
  card: PublishedQueueCard;
  pulse: Animated.Value;
  onMenu: () => void;
  onDragStart: () => void;
  onDragRelease: (gesture: QueueDragGesture) => void;
  focusRef: (node: View | null) => void;
  onFocus: () => void;
}) {
  const copy = activityCopy(card.activityId);
  const start =
    card.forecast.predictedStartMinute === null
      ? 'LATER'
      : formatTimeOfDay(card.forecast.predictedStartMinute);
  const forecastLabel = forecastAccessibilityLabel(card);
  const drag = useRef(new Animated.ValueXY()).current;
  const suppressPress = useRef(false);
  const suppressPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDragStartRef = useRef(onDragStart);
  const onDragReleaseRef = useRef(onDragRelease);
  onDragStartRef.current = onDragStart;
  onDragReleaseRef.current = onDragRelease;
  const clearSuppressionLater = () => {
    if (suppressPressTimer.current !== null) {
      globalThis.clearTimeout(suppressPressTimer.current);
    }
    suppressPressTimer.current = globalThis.setTimeout(() => {
      suppressPress.current = false;
      suppressPressTimer.current = null;
    }, 250);
  };
  useEffect(
    () => () => {
      if (suppressPressTimer.current !== null) {
        globalThis.clearTimeout(suppressPressTimer.current);
      }
    },
    [],
  );
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          shouldStartQueueDrag(gesture.dx, gesture.dy),
        onPanResponderGrant: () => {
          if (suppressPressTimer.current !== null) {
            globalThis.clearTimeout(suppressPressTimer.current);
            suppressPressTimer.current = null;
          }
          suppressPress.current = true;
          drag.setValue({ x: 0, y: 0 });
          onDragStartRef.current();
        },
        onPanResponderMove: (_event, gesture) => {
          drag.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_event, gesture) => {
          drag.setValue({ x: 0, y: 0 });
          onDragReleaseRef.current({
            dx: gesture.dx,
            dy: gesture.dy,
            moveY: gesture.moveY,
          });
          clearSuppressionLater();
        },
        onPanResponderTerminate: () => {
          drag.setValue({ x: 0, y: 0 });
          clearSuppressionLater();
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [drag],
  );
  return (
    <View style={styles.cardUnit}>
      <ForecastChips cards={[card]} />
      <Animated.View
        {...responder.panHandlers}
        testID={`queue-drag:${card.id}`}
        style={[
          styles.dragSurface,
          { transform: drag.getTranslateTransform() },
        ]}
      >
        <Pressable
          ref={focusRef}
          onPress={() => {
            if (!suppressPress.current) onMenu();
          }}
          onFocus={onFocus}
          accessibilityRole="button"
          accessibilityLabel={`${copy.label}, ${card.owner === 'PINNED' ? 'pinned' : 'automatic'}${card.urgent ? ', urgent' : ''}, predicted ${start}${forecastLabel}`}
          testID={`queue-card:${card.id}`}
          style={[styles.upcomingCard, card.urgent && styles.urgentCard]}
        >
          {card.urgent && (
            <>
              <Animated.View
                pointerEvents="none"
                testID={`queue-urgent:${card.id}`}
                style={[styles.urgentPulse, { opacity: pulse }]}
              />
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                testID={`queue-urgent-badge:${card.id}`}
                style={styles.urgentBadge}
              >
                !
              </Text>
            </>
          )}
          <View style={styles.cardTop}>
            <Text style={styles.cardGlyph}>{copy.glyph}</Text>
            <Text style={styles.ownerGlyph} testID={`queue-owner:${card.id}`}>
              {card.owner === 'PINNED' ? '⌖' : '⚙'}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.cardLabel}>
            {copy.label}
          </Text>
          <Text style={styles.cardStart} testID={`queue-start:${card.id}`}>
            {`~${start}`}
          </Text>
        </Pressable>
      </Animated.View>
      <MenuButton
        cardId={card.id}
        label={`Open ${copy.label} menu`}
        onPress={onMenu}
      />
    </View>
  );
}

function MenuButton({
  cardId,
  label,
  onPress,
}: {
  cardId: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`queue-menu:${cardId}`}
      style={styles.menuButton}
    >
      <Text style={styles.menuDots}>•••</Text>
    </Pressable>
  );
}

function CollapsedBlock({
  item,
  pulse,
  onExpand,
  onMenu,
  focusRef,
  onFocus,
}: {
  item: QueueStripBlockItem;
  pulse: Animated.Value;
  onExpand: () => void;
  onMenu: () => void;
  focusRef: (node: View | null) => void;
  onFocus: () => void;
}) {
  const urgent = item.cards.some((card) => card.urgent);
  const firstId = item.cards[0]!.id;
  return (
    <View
      style={styles.cardUnit}
      testID={`queue-block:${item.blockId}:${firstId}`}
    >
      <ForecastChips cards={item.cards} />
      <Pressable
        ref={focusRef}
        onPress={onExpand}
        onFocus={onFocus}
        accessibilityRole="button"
        accessibilityLabel={`${blockLabel(item.blockId)}, ${item.cards.length} steps, expand`}
        accessibilityState={{ expanded: false }}
        testID={`queue-block-expand:${item.blockId}:${firstId}`}
        style={[styles.blockCard, urgent && styles.urgentCard]}
      >
        {urgent && (
          <>
            <Animated.View
              pointerEvents="none"
              style={[styles.urgentPulse, { opacity: pulse }]}
            />
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.urgentBadge}
            >
              !
            </Text>
          </>
        )}
        <Text style={styles.blockKicker}>ROUTINE</Text>
        <Text numberOfLines={1} style={styles.blockLabel}>
          {blockLabel(item.blockId)}
        </Text>
        <Text style={styles.blockCount}>{`▸ ×${item.cards.length}`}</Text>
      </Pressable>
      <MenuButton
        cardId={item.key}
        label={`Open ${blockLabel(item.blockId)} menu`}
        onPress={onMenu}
      />
    </View>
  );
}

function ForecastChips({
  cards,
}: {
  cards: readonly PublishedQueueCard[];
}) {
  const hasAny = cards.some(
    (card) =>
      card.forecast.conflicts.length > 0 ||
      card.forecast.wakeConflicts.length > 0 ||
      card.forecast.bonuses.length > 0,
  );
  if (!hasAny) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.forecastChips}
    >
      {cards.flatMap((card) => [
        ...card.forecast.conflicts.map((conflict) => (
          <Text
            key={`conflict:${card.id}:${conflict.bar}`}
            testID={`queue-conflict-chip:${card.id}:${conflict.bar}`}
            style={[styles.forecastChip, styles.warningChip]}
          >
            {`⚠ ${queueStrings.chips.conflict}`}
          </Text>
        )),
        ...card.forecast.wakeConflicts.map((conflict) => (
          <Text
            key={`wake:${card.id}:${conflict.wakeMinute}`}
            testID={`queue-wake-chip:${card.id}`}
            style={[styles.forecastChip, styles.warningChip]}
          >
            {`⚠ ${queueStrings.chips.wakeConflict}`}
          </Text>
        )),
        ...card.forecast.bonuses.map((bonus, index) => (
          <Text
            key={`bonus:${card.id}:${bonus.kind === 'adjacency' ? bonus.pairId : `block-${index}`}`}
            testID={`queue-bonus-chip:${card.id}:${bonus.kind === 'adjacency' ? bonus.pairId : 'practice-block'}`}
            style={[styles.forecastChip, styles.bonusChip]}
          >
            {bonusChipLabel(bonus)}
          </Text>
        )),
      ])}
    </View>
  );
}

function PalettePanel({
  groups,
  firstItemRef,
  onChoose,
  onClose,
}: {
  groups: PaletteGroup[];
  firstItemRef: (node: View | null) => void;
  onChoose: (activityId: string) => void;
  onClose: () => void;
}) {
  return (
    <View style={[styles.popover, styles.palettePanel]} testID="queue-palette">
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.panelEyebrow}>STEER THE DAY</Text>
          <Text style={styles.panelTitle}>Add activity</Text>
        </View>
        <CloseButton onPress={onClose} />
      </View>
      <ScrollView style={styles.paletteScroll}>
        {groups.map((group, groupIndex) => (
          <View
            key={group.room}
            style={styles.paletteGroup}
            testID={`queue-palette-group:${group.room}`}
          >
            <View style={styles.roomHeading}>
              <View
                style={[
                  styles.roomMark,
                  { backgroundColor: ROOM_ACCENT[group.room] ?? INK },
                ]}
              />
              <Text style={styles.roomLabel}>{group.room.toUpperCase()}</Text>
            </View>
            <View style={styles.paletteGrid}>
              {group.activities.map((activity, activityIndex) => (
                <Pressable
                  ref={
                    groupIndex === 0 && activityIndex === 0
                      ? firstItemRef
                      : undefined
                  }
                  key={activity.id}
                  onPress={() => onChoose(activity.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${activity.label}, ${activity.duration}, ${activity.effect}`}
                  testID={`queue-palette-item:${activity.id}`}
                  style={styles.paletteItem}
                >
                  <Text style={styles.paletteGlyph}>{activity.glyph}</Text>
                  <View style={styles.paletteCopy}>
                    <Text numberOfLines={1} style={styles.paletteLabel}>
                      {activity.label}
                    </Text>
                    <Text
                      style={styles.paletteMeta}
                      testID={`queue-palette-duration:${activity.id}`}
                    >
                      {activity.duration}
                    </Text>
                    <Text numberOfLines={1} style={styles.paletteEffect}>
                      {activity.effect}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function CardMenu({
  current,
  canMoveEarlier,
  canMoveLater,
  onStop,
  onAction,
  firstActionRef,
  onClose,
}: {
  current: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onStop: () => void;
  onAction: (action: 'earlier' | 'later' | 'next' | 'remove' | 'details') => void;
  firstActionRef: (node: View | null) => void;
  onClose: () => void;
}) {
  return (
    <View style={[styles.popover, styles.menuPanel]} testID="queue-card-menu">
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{current ? 'Current activity' : 'Queue card'}</Text>
        <CloseButton onPress={onClose} />
      </View>
      {current ? (
        <ActionButton
          label="Stop"
          testID="queue-action:stop"
          destructive
          focusRef={firstActionRef}
          onPress={onStop}
        />
      ) : (
        <>
          <ActionButton
            label="Move earlier"
            testID="queue-action:move-earlier"
            disabled={!canMoveEarlier}
            focusRef={canMoveEarlier ? firstActionRef : undefined}
            onPress={() => onAction('earlier')}
          />
          <ActionButton
            label="Move later"
            testID="queue-action:move-later"
            disabled={!canMoveLater}
            focusRef={!canMoveEarlier && canMoveLater ? firstActionRef : undefined}
            onPress={() => onAction('later')}
          />
          <ActionButton
            label="Do next"
            testID="queue-action:do-next"
            focusRef={!canMoveEarlier && !canMoveLater ? firstActionRef : undefined}
            onPress={() => onAction('next')}
          />
          <ActionButton
            label="Remove"
            testID="queue-action:remove"
            destructive
            onPress={() => onAction('remove')}
          />
        </>
      )}
      <ActionButton label="Details" testID="queue-action:details" onPress={() => onAction('details')} />
    </View>
  );
}

function BlockMenu({
  block,
  onExpand,
  onDetails,
  firstActionRef,
  onClose,
}: {
  block: QueueStripBlockItem;
  onExpand: () => void;
  onDetails: () => void;
  firstActionRef: (node: View | null) => void;
  onClose: () => void;
}) {
  return (
    <View style={[styles.popover, styles.menuPanel]} testID="queue-block-menu">
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{blockLabel(block.blockId)}</Text>
        <CloseButton onPress={onClose} />
      </View>
      <Text style={styles.menuHint}>Expand this routine before editing a step.</Text>
      <ActionButton
        label="Expand to edit"
        testID="queue-action:expand-block"
        focusRef={firstActionRef}
        onPress={onExpand}
      />
      <ActionButton label="Details" testID="queue-action:block-details" onPress={onDetails} />
    </View>
  );
}

function DetailsPanel({
  card,
  block,
  onClose,
}: {
  card: PublishedQueueCard | null;
  block: QueueStripBlockItem | null;
  onClose: () => void;
}) {
  if (card !== null) {
    const copy = activityCopy(card.activityId);
    const why = whyLine(card.forecast.reason);
    return (
      <View
        style={[styles.popover, styles.detailsPanel]}
        testID={`queue-details:${card.id}`}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{copy.label}</Text>
          <CloseButton onPress={onClose} />
        </View>
        <Text style={styles.detailLine}>
          {card.durationTicksAtCurrentSpeed === null
            ? 'Open-ended'
            : `${card.durationTicksAtCurrentSpeed} min at current energy`}
        </Text>
        <Text style={styles.detailLine}>{`At ${card.forecast.targetObjectId}`}</Text>
        <Text style={styles.detailLine}>{effectCopy(card.forecast.effects)}</Text>
        {why !== null && (
          <Text style={styles.detailLine} testID={`queue-why:${card.id}`}>
            {why}
          </Text>
        )}
        {Object.entries(card.forecast.capWaste).map(([bar, amount]) => (
          <Text
            key={bar}
            style={styles.detailLine}
            testID={`queue-cap-waste:${card.id}:${bar}`}
          >
            {capWasteDetail(bar, amount ?? 0)}
          </Text>
        ))}
        {card.forecast.conflicts.map((conflict) => (
          <Text
            key={`${conflict.bar}:${conflict.atMinute}`}
            style={[styles.detailLine, styles.warningDetail]}
          >
            {conflictDetail(conflict)}
          </Text>
        ))}
        {card.forecast.wakeConflicts.map((conflict) => (
          <Text
            key={conflict.wakeMinute}
            style={[styles.detailLine, styles.warningDetail]}
          >
            {wakeConflictDetail(conflict)}
          </Text>
        ))}
        {card.forecast.bonuses.map((bonus, index) => (
          <Text
            key={bonus.kind === 'adjacency' ? bonus.pairId : `block-${index}`}
            style={[styles.detailLine, styles.bonusDetail]}
          >
            {bonusDetail(bonus)}
          </Text>
        ))}
      </View>
    );
  }
  if (block === null) return null;
  return (
    <View
      style={[styles.popover, styles.detailsPanel]}
      testID={`queue-details:${block.key}`}
    >
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{blockLabel(block.blockId)}</Text>
        <CloseButton onPress={onClose} />
      </View>
      {block.cards.map((step, index) => {
        const why = whyLine(step.forecast.reason);
        return (
          <View key={step.id}>
            <Text style={styles.detailLine}>
              {`${index + 1}. ${activityCopy(step.activityId).label}`}
            </Text>
            {why !== null && (
              <Text style={styles.detailLine} testID={`queue-why:${step.id}`}>
                {why}
              </Text>
            )}
            {step.forecast.conflicts.map((conflict) => (
              <Text
                key={`${conflict.bar}:${conflict.atMinute}`}
                style={[styles.detailLine, styles.warningDetail]}
              >
                {conflictDetail(conflict)}
              </Text>
            ))}
            {step.forecast.wakeConflicts.map((conflict) => (
              <Text
                key={conflict.wakeMinute}
                style={[styles.detailLine, styles.warningDetail]}
              >
                {wakeConflictDetail(conflict)}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function ActionButton({
  label,
  testID,
  onPress,
  destructive = false,
  disabled = false,
  focusRef,
}: {
  label: string;
  testID: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  focusRef?: (node: View | null) => void;
}) {
  return (
    <Pressable
      ref={focusRef}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
      style={[
        styles.actionButton,
        destructive && styles.actionDestructive,
        disabled && styles.controlDisabled,
      ]}
    >
      <Text style={[styles.actionText, destructive && styles.actionDestructiveText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
      style={styles.closeButton}
    >
      <Text style={styles.closeText}>×</Text>
    </Pressable>
  );
}

function buildPaletteGroups(snapshot: QueueStripSnapshot | null): PaletteGroup[] {
  const bars = snapshot?.bars ?? {
    energy: 50,
    nutrition: 50,
    movement: 50,
    hygiene: 50,
  };
  const fixedBars = {
    energy: toFixed(bars.energy),
    nutrition: toFixed(bars.nutrition),
    movement: toFixed(bars.movement),
    hygiene: toFixed(bars.hygiene),
  };
  const grouped = new Map<string, PaletteActivity[]>();

  for (const object of content.objects.objects) {
    for (const activityId of object.activities) {
      const def = activityByIdIn(content, activityId);
      if (activityId === 'idle' || def.playerSelectable === false) continue;
      const duration = activityDurationTicksAtCurrentSpeed(def, fixedBars);
      const copy = activityCopy(activityId);
      const effect =
        def.kind === 'timed'
          ? effectCopy(def.effects)
          : def.kind === 'practice'
            ? '+ Practice points'
            : 'Until wake';
      const list = grouped.get(object.room) ?? [];
      list.push({
        id: activityId,
        label: copy.label,
        glyph: copy.glyph,
        duration: duration === null ? 'Open-ended' : `${duration} min`,
        effect,
      });
      grouped.set(object.room, list);
    }
  }

  return ROOM_ORDER.flatMap((room) => {
    const activities = grouped.get(room);
    return activities === undefined ? [] : [{ room, activities }];
  });
}

function effectCopy(effects: Partial<Record<string, number>>): string {
  const entries = Object.entries(effects).filter(([, value]) => value !== 0);
  if (entries.length === 0) return 'No bar change';
  return entries
    .map(([bar, value]) => `${value! > 0 ? '+' : ''}${value} ${bar}`)
    .join(' · ');
}

function forecastAccessibilityLabel(card: PublishedQueueCard): string {
  const details = [
    whyLine(card.forecast.reason),
    ...card.forecast.conflicts.map(conflictDetail),
    ...card.forecast.wakeConflicts.map(wakeConflictDetail),
    ...card.forecast.bonuses.map(bonusDetail),
    ...Object.entries(card.forecast.capWaste).map(([bar, amount]) =>
      capWasteDetail(bar, amount ?? 0),
    ),
  ].filter((value): value is string => value !== null);
  return details.length === 0 ? '' : `, ${details.join(' ')}`;
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: QUEUE_H,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CREAM_BASE,
    borderTopWidth: 3,
    borderTopColor: INK,
    paddingHorizontal: 6,
    zIndex: 20,
  },
  currentSlot: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentCard: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 5,
  },
  idleCard: { backgroundColor: CREAM_SHADOW },
  idleGlyph: { color: INK, fontFamily: 'monospace', fontSize: 22, lineHeight: 24 },
  progressRing: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPip: {
    position: 'absolute',
    width: 4,
    height: 8,
    borderRadius: 1,
  },
  currentGlyph: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 18,
    lineHeight: 20,
  },
  currentFoot: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  rule: {
    width: 2,
    height: 48,
    backgroundColor: CREAM_SHADOW,
    marginHorizontal: 6,
  },
  queueScroll: { flex: 1, height: 64 },
  queueContent: {
    alignItems: 'center',
    gap: 6,
    paddingRight: 6,
  },
  emptyQueue: {
    minWidth: 112,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: CREAM_SHADOW,
  },
  emptyQueueText: {
    color: '#5d3a1e',
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
  },
  cardUnit: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  dragSurface: {
    zIndex: 2,
  },
  forecastChips: {
    position: 'absolute',
    left: 3,
    top: -6,
    zIndex: 4,
    flexDirection: 'row',
    gap: 2,
  },
  forecastChip: {
    minHeight: 13,
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 4,
    color: INK,
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    lineHeight: 11,
    overflow: 'hidden',
  },
  warningChip: {
    backgroundColor: RED_LIGHT,
    color: CREAM_LIGHT,
  },
  bonusChip: {
    backgroundColor: '#e8bb55',
  },
  expandedBlock: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CREAM_SHADOW,
    borderWidth: 2,
    borderColor: '#5d3a1e',
    borderRadius: 5,
    paddingHorizontal: 4,
  },
  collapseButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 4,
  },
  collapseText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
  },
  upcomingCard: {
    width: 82,
    height: 56,
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  urgentCard: { borderColor: RED },
  urgentPulse: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 1,
    bottom: 1,
    borderWidth: 2,
    borderColor: RED_LIGHT,
  },
  urgentBadge: {
    position: 'absolute',
    left: 3,
    top: 2,
    width: 12,
    height: 12,
    color: CREAM_LIGHT,
    backgroundColor: RED,
    borderWidth: 1,
    borderColor: '#962e20',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 10,
    textAlign: 'center',
    zIndex: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardGlyph: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 14,
  },
  ownerGlyph: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 12,
  },
  cardLabel: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  cardStart: {
    color: '#5d3a1e',
    fontFamily: 'monospace',
    fontSize: 9,
    fontVariant: ['tabular-nums'],
    lineHeight: 11,
  },
  menuButton: {
    minWidth: 44,
    minHeight: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM_SHADOW,
    borderWidth: 2,
    borderLeftWidth: 0,
    borderBottomWidth: 4,
    borderColor: INK,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  menuDots: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: -1,
  },
  blockCard: {
    width: 112,
    height: 56,
    justifyContent: 'center',
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
  blockKicker: {
    color: '#5d3a1e',
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  blockLabel: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
  },
  blockCount: {
    color: PLUM,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
  },
  paletteToggle: {
    minWidth: 54,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 5,
    marginLeft: 4,
  },
  palettePlus: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },
  paletteCount: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 8,
    fontVariant: ['tabular-nums'],
  },
  controlDisabled: { opacity: 0.4 },
  popover: {
    position: 'absolute',
    bottom: QUEUE_H - 2,
    backgroundColor: CREAM_BASE,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: INK,
    borderRadius: 6,
    padding: 8,
    zIndex: 40,
  },
  palettePanel: {
    left: 8,
    width: 620,
    maxWidth: '92%',
    maxHeight: 430,
  },
  panelHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelEyebrow: {
    color: '#5d3a1e',
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  panelTitle: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 4,
  },
  closeText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
  },
  paletteScroll: { maxHeight: 350 },
  paletteGroup: { marginTop: 8 },
  roomHeading: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomMark: { width: 8, height: 16, borderWidth: 1, borderColor: INK },
  roomLabel: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paletteItem: {
    width: 190,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 4,
    padding: 6,
  },
  paletteGlyph: {
    width: 34,
    color: INK,
    fontFamily: 'monospace',
    fontSize: 18,
    textAlign: 'center',
  },
  paletteCopy: { flex: 1 },
  paletteLabel: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
  },
  paletteMeta: {
    color: '#5d3a1e',
    fontFamily: 'monospace',
    fontSize: 9,
    fontVariant: ['tabular-nums'],
  },
  paletteEffect: {
    color: '#3f7a44',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  menuPanel: { right: 70, width: 220 },
  menuHint: {
    color: '#5d3a1e',
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 6,
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 4,
    paddingHorizontal: 10,
    marginTop: 5,
  },
  actionDestructive: { backgroundColor: RED, borderColor: '#962e20' },
  actionText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
  },
  actionDestructiveText: { color: CREAM_LIGHT },
  detailsPanel: { right: 70, width: 280 },
  detailLine: {
    color: '#5d3a1e',
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 15,
  },
  warningDetail: { color: RED },
  bonusDetail: { color: '#7a560f' },
  srOnly: {
    position: 'absolute',
    left: -10000,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  toast: {
    position: 'absolute',
    right: 14,
    bottom: QUEUE_H + 10,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: INK,
    borderWidth: 3,
    borderColor: CREAM_LIGHT,
    borderRadius: 5,
    paddingLeft: 12,
    paddingRight: 4,
    zIndex: 50,
  },
  toastText: {
    color: CREAM_LIGHT,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
  },
  undoButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 4,
  },
  undoText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
