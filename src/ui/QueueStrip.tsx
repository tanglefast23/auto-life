import { FONT, TYPE_SCALE, theme } from './theme';
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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GameSnapshot } from '../application/snapshot';
import type { UndoToast } from '../application/loop';
import { HUD_H, QUEUE_W } from '../render/scale';
import {
  activityCopy,
  blockLabel,
  engineIndexForVisualMove,
  groupQueueForStrip,
  queueVisualRows,
  type QueueStripBlockItem,
} from './queue-presenter';
import {
  queueStrings,
  whyLine,
} from './queue-copy';
import {
  queueDragDecision,
  type QueueDragGesture,
} from './queue-drag';
import type { ActivePreferenceTag } from './preference-tags';
import {
  CollapsedBlock,
  CurrentCard,
  MenuButton,
  UpcomingCard,
} from './QueueStripCards';
import {
  BlockMenu,
  CardMenu,
  DetailsPanel,
  PalettePanel,
  buildPaletteGroups,
} from './QueueStripPanels';

export { buildPaletteGroups } from './QueueStripPanels';

export type QueueStripSnapshot = Pick<
  GameSnapshot,
  'queue' | 'currentCardId' | 'currentProgress' | 'bars' | 'forecastRevision'
>;

export interface QueueStripProps {
  snapshot: QueueStripSnapshot | null;
  topInset?: number;
  undoToast: UndoToast | null;
  onInsertActivity: (activityId: string) => void;
  onStopCurrent: () => void;
  onRemoveCard: (cardId: string) => void;
  onMoveCard: (cardId: string, toIndex: number) => void;
  onUndo: (receiptId: string) => void;
  onWhyLineOpened: (cardId: string) => void;
  onForecastChangeObserved: () => void;
  reducedMotion?: boolean;
  preferenceTags?: readonly ActivePreferenceTag[];
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

const cardFocusToken = (cardId: string): string => `card:${cardId}`;

const CREAM_LIGHT = theme.color.creamLight;
const CREAM_BASE = theme.color.creamBase;
const CREAM_SHADOW = theme.color.creamShadow;
const INK = theme.color.ink;
const RED = theme.color.red;
const RED_LIGHT = theme.color.redLight;
const BLUE = theme.color.water;
const BLUE_LIGHT = theme.color.waterLight;
const PLUM = theme.color.plum;

export const QueueStrip = forwardRef<QueueStripHandle, QueueStripProps>(
  function QueueStrip(
    {
      snapshot,
      topInset = HUD_H,
      undoToast,
      onInsertActivity,
      onStopCurrent,
      onRemoveCard,
      onMoveCard,
      onUndo,
      onWhyLineOpened,
      onForecastChangeObserved,
      reducedMotion = false,
      preferenceTags = [],
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
  const stripBounds = useRef<{ left: number; right: number } | null>(null);

  const queue = snapshot?.queue ?? [];
  const current =
    snapshot?.currentCardId === null || snapshot?.currentCardId === undefined
      ? null
      : queue.find((card) => card.id === snapshot.currentCardId) ?? null;
  const items = useMemo(
    () => groupQueueForStrip(queue, snapshot?.currentCardId ?? null),
    [queue, snapshot?.currentCardId],
  );
  const visualRows = useMemo(
    () => queueVisualRows(items, expandedBlocks),
    [expandedBlocks, items],
  );
  const hasUrgent = queue.some((card) => card.urgent);
  const paletteGroups = useMemo(
    () => buildPaletteGroups(snapshot, preferenceTags),
    [
      preferenceTags,
      snapshot?.bars.energy,
      snapshot?.bars.hygiene,
      snapshot?.bars.movement,
      snapshot?.bars.nutrition,
    ],
  );
  const atPlayerCap = queue.filter((card) => card.source === 'player').length >= 10;
  const focusTokens = useMemo(() => {
    const tokens: string[] = [];
    if (current !== null) tokens.push(cardFocusToken(current.id));
    tokens.push(...visualRows.map((row) => row.key));
    return tokens;
  }, [current, visualRows]);

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

  const moveCardToVisualRow = (
    cardId: string,
    toRowIndex: number,
  ): boolean => {
    const toIndex = engineIndexForVisualMove(
      queue,
      snapshot?.currentCardId ?? null,
      visualRows,
      cardId,
      toRowIndex,
    );
    if (toIndex === null) return false;
    onMoveCard(cardId, toIndex);
    return true;
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
        const rowIndex = visualRows.findIndex((row) =>
          row.cardIds.includes(cardId),
        );
        if (rowIndex === -1) return false;
        const target = Math.max(
          0,
          Math.min(visualRows.length - 1, rowIndex + direction),
        );
        if (target === rowIndex) return false;
        return moveCardToVisualRow(cardId, target);
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
      visualRows,
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
    const rowIndex = visualRows.findIndex((row) =>
      row.cardIds.includes(menuCard.id),
    );
    if (action === 'earlier' && rowIndex > 0) {
      moveCardToVisualRow(menuCard.id, rowIndex - 1);
    } else if (
      action === 'later' &&
      rowIndex >= 0 &&
      rowIndex < visualRows.length - 1
    ) {
      moveCardToVisualRow(menuCard.id, rowIndex + 1);
    } else if (action === 'next' && rowIndex >= 0) {
      moveCardToVisualRow(menuCard.id, 0);
    }
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
    stripRef.current?.measureInWindow((x, _y, width, _height) => {
      stripBounds.current = { left: x, right: x + width };
    });
  };

  const finishCardDrag = (cardId: string, gesture: QueueDragGesture) => {
    const fromIndex = visualRows.findIndex((row) =>
      row.cardIds.includes(cardId),
    );
    if (fromIndex === -1) return;
    const decision = queueDragDecision({
      gesture,
      fromIndex,
      cardCount: visualRows.length,
      stripLeft: stripBounds.current?.left ?? null,
      stripRight: stripBounds.current?.right ?? null,
    });
    if (decision.kind === 'remove') onRemoveCard(cardId);
    else if (decision.kind === 'move') {
      moveCardToVisualRow(cardId, decision.toIndex);
    }
  };

  return (
    <View
      ref={stripRef}
      style={[styles.root, { top: topInset }]}
      testID="queue-strip"
    >
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
              styles={styles}
              focusRef={registerFocus(cardFocusToken(current.id))}
              onFocus={() => {
                focusedToken.current = cardFocusToken(current.id);
              }}
            />
            <MenuButton
              cardId={current.id}
              label={`Open ${activityCopy(current.activityId).label} menu`}
              onPress={() => openCardMenu(current.id)}
              styles={styles}
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
        showsVerticalScrollIndicator
        testID="queue-scroll"
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
              styles={styles}
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
                  styles={styles}
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
              styles={styles}
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
          styles={styles}
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
          styles={styles}
          canMoveEarlier={
            visualRows.findIndex((row) =>
              row.cardIds.includes(menuCard.id),
            ) > 0
          }
          canMoveLater={(() => {
            const rowIndex = visualRows.findIndex((row) =>
              row.cardIds.includes(menuCard.id),
            );
            return (
              rowIndex >= 0 &&
              rowIndex < visualRows.length - 1
            );
          })()}
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
          styles={styles}
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
          styles={styles}
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

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: QUEUE_W,
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: CREAM_BASE,
    borderLeftWidth: 3,
    borderLeftColor: INK,
    padding: 6,
    zIndex: 20,
  },
  currentSlot: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  currentCard: {
    flex: 1,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 5,
  },
  idleCard: {
    backgroundColor: CREAM_SHADOW,
    flex: 1,
  },
  idleGlyph: { color: INK, fontFamily: FONT.pixel, fontSize: TYPE_SCALE.heading.fontSize, lineHeight: 24 },
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
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
    lineHeight: 20,
  },
  currentCopy: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
  },
  currentLabel: {
    color: INK,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  currentFoot: {
    color: INK,
    ...TYPE_SCALE.caption,
    letterSpacing: 1,
  },
  rule: {
    width: '100%',
    height: 2,
    backgroundColor: CREAM_SHADOW,
    marginVertical: 6,
  },
  queueScroll: { flex: 1, width: '100%' },
  queueContent: {
    alignItems: 'stretch',
    gap: 6,
    paddingBottom: 6,
    paddingTop: 2,
    width: '100%',
  },
  emptyQueue: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: CREAM_SHADOW,
  },
  emptyQueueText: {
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
    letterSpacing: 1,
  },
  cardUnit: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
    minWidth: '100%',
    width: '100%',
  },
  dragSurface: {
    flex: 1,
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
    ...TYPE_SCALE.caption,
    overflow: 'hidden',
  },
  warningChip: {
    backgroundColor: RED_LIGHT,
    color: CREAM_LIGHT,
  },
  bonusChip: {
    backgroundColor: theme.color.gold,
  },
  expandedBlock: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
    backgroundColor: CREAM_SHADOW,
    borderWidth: 2,
    borderColor: theme.color.woodShadow,
    borderRadius: 5,
    padding: 4,
    width: '100%',
  },
  collapseButton: {
    width: '100%',
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
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
  },
  upcomingCard: {
    flex: 1,
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
    borderColor: theme.color.redShadow,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
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
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
    lineHeight: 14,
  },
  ownerGlyph: {
    color: INK,
    ...TYPE_SCALE.caption,
  },
  cardLabel: {
    color: INK,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  cardStart: {
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
    fontVariant: ['tabular-nums'],
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
    ...TYPE_SCALE.caption,
    letterSpacing: -1,
  },
  blockCard: {
    flex: 1,
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
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
    letterSpacing: 1,
  },
  blockLabel: {
    color: INK,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  blockCount: {
    color: PLUM,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  paletteToggle: {
    width: '100%',
    minWidth: 44,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_LIGHT,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 5,
    marginTop: 4,
  },
  palettePlus: {
    color: INK,
    fontSize: TYPE_SCALE.heading.fontSize,
    fontFamily: FONT.pixelBold,
    lineHeight: 22,
  },
  paletteCount: {
    color: INK,
    ...TYPE_SCALE.caption,
    fontVariant: ['tabular-nums'],
  },
  controlDisabled: { opacity: 0.4 },
  popover: {
    position: 'absolute',
    bottom: 8,
    right: QUEUE_W - 3,
    backgroundColor: CREAM_BASE,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: INK,
    borderRadius: 6,
    padding: 8,
    zIndex: 40,
  },
  palettePanel: {
    width: 620,
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
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
    letterSpacing: 1,
  },
  panelTitle: {
    color: INK,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
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
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
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
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
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
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
    textAlign: 'center',
  },
  paletteCopy: { flex: 1 },
  paletteLabel: {
    color: INK,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  paletteMeta: {
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
    fontVariant: ['tabular-nums'],
  },
  paletteEffect: {
    color: theme.color.leafShadow,
    ...TYPE_SCALE.caption,
  },
  preferenceTag: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.creamBase,
    borderRadius: 99,
    color: theme.color.plumShadow,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  menuPanel: { width: 220 },
  menuHint: {
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
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
  actionDestructive: { backgroundColor: RED, borderColor: theme.color.redShadow },
  actionText: {
    color: INK,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  actionDestructiveText: { color: CREAM_LIGHT },
  detailsPanel: { width: 280 },
  detailLine: {
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
  },
  warningDetail: { color: RED },
  bonusDetail: { color: theme.color.wood },
  srOnly: {
    position: 'absolute',
    left: -10000,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  toast: {
    position: 'absolute',
    right: QUEUE_W + 10,
    bottom: 10,
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
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
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
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
    letterSpacing: 1,
  },
});
