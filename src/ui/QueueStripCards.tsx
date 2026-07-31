import { theme } from './theme';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import type { PublishedQueueCard } from '../application/snapshot';
import { formatTimeOfDay } from './clock-format';
import {
  activityCopy,
  blockLabel,
  type QueueStripBlockItem,
} from './queue-presenter';
import {
  bonusChipLabel,
  bonusDetail,
  capWasteDetail,
  conflictDetail,
  queueStrings,
  startConstraintChip,
  startConstraintDetail,
  wakeConflictDetail,
  whyLine,
} from './queue-copy';
import {
  shouldStartQueueDrag,
  type QueueDragGesture,
} from './queue-drag';

type QueueStyles = Record<string, any>;

const BLUE = theme.color.water;
const CREAM_SHADOW = theme.color.creamShadow;

export function CurrentCard({
  card,
  progress,
  onStop,
  focusRef,
  onFocus,
  styles,
}: {
  card: PublishedQueueCard;
  progress: number;
  onStop: () => void;
  focusRef: (node: View | null) => void;
  onFocus: () => void;
  styles: QueueStyles;
}) {
  const copy = activityCopy(card.activityId);
  const percent = Math.round(
    Math.max(0, Math.min(1, progress)) * 100,
  );
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
                  backgroundColor:
                    index < filled ? BLUE : CREAM_SHADOW,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}
        <Text style={styles.currentGlyph}>{copy.glyph}</Text>
      </View>
      <View style={styles.currentCopy}>
        <Text
          numberOfLines={2}
          style={styles.currentLabel}
          testID="queue-current-label"
        >
          {copy.label}
        </Text>
        <Text numberOfLines={1} style={styles.currentFoot}>
          STOP
        </Text>
      </View>
    </Pressable>
  );
}

export function UpcomingCard({
  card,
  pulse,
  onMenu,
  onDragStart,
  onDragRelease,
  focusRef,
  onFocus,
  styles,
}: {
  card: PublishedQueueCard;
  pulse: Animated.Value;
  onMenu: () => void;
  onDragStart: () => void;
  onDragRelease: (gesture: QueueDragGesture) => void;
  focusRef: (node: View | null) => void;
  onFocus: () => void;
  styles: QueueStyles;
}) {
  const copy = activityCopy(card.activityId);
  const start =
    card.forecast.predictedStartMinute === null
      ? 'LATER'
      : formatTimeOfDay(card.forecast.predictedStartMinute);
  const forecastLabel = forecastAccessibilityLabel(card);
  const drag = useRef(new Animated.ValueXY()).current;
  const suppressPress = useRef(false);
  const suppressPressTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);
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
            moveX: gesture.moveX,
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
      <ForecastChips cards={[card]} styles={styles} />
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
          style={[
            styles.upcomingCard,
            card.urgent && styles.urgentCard,
          ]}
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
            <Text
              style={styles.ownerGlyph}
              testID={`queue-owner:${card.id}`}
            >
              {card.owner === 'PINNED' ? '⌖' : '⚙'}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.cardLabel}>
            {copy.label}
          </Text>
          <Text
            style={styles.cardStart}
            testID={`queue-start:${card.id}`}
          >
            {`~${start}`}
          </Text>
        </Pressable>
      </Animated.View>
      <MenuButton
        cardId={card.id}
        label={`Open ${copy.label} menu`}
        onPress={onMenu}
        styles={styles}
      />
    </View>
  );
}

export function CollapsedBlock({
  item,
  pulse,
  onExpand,
  onMenu,
  focusRef,
  onFocus,
  styles,
}: {
  item: QueueStripBlockItem;
  pulse: Animated.Value;
  onExpand: () => void;
  onMenu: () => void;
  focusRef: (node: View | null) => void;
  onFocus: () => void;
  styles: QueueStyles;
}) {
  const urgent = item.cards.some((card) => card.urgent);
  const firstId = item.cards[0]!.id;
  return (
    <View
      style={styles.cardUnit}
      testID={`queue-block:${item.blockId}:${firstId}`}
    >
      <ForecastChips cards={item.cards} styles={styles} />
      <Pressable
        ref={focusRef}
        onPress={onExpand}
        onFocus={onFocus}
        accessibilityRole="button"
        accessibilityLabel={`${blockLabel(item.blockId)}, ${item.cards.length} steps, expand`}
        accessibilityState={{ expanded: false }}
        testID={`queue-block-expand:${item.blockId}:${firstId}`}
        style={[
          styles.blockCard,
          urgent && styles.urgentCard,
        ]}
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
        <Text style={styles.blockCount}>
          {`▸ ×${item.cards.length}`}
        </Text>
      </Pressable>
      <MenuButton
        cardId={item.key}
        label={`Open ${blockLabel(item.blockId)} menu`}
        onPress={onMenu}
        styles={styles}
      />
    </View>
  );
}

export function MenuButton({
  cardId,
  label,
  onPress,
  styles,
}: {
  cardId: string;
  label: string;
  onPress: () => void;
  styles: QueueStyles;
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

function ForecastChips({
  cards,
  styles,
}: {
  cards: readonly PublishedQueueCard[];
  styles: QueueStyles;
}) {
  const hasAny = cards.some(
    (card) =>
      card.forecast.conflicts.length > 0 ||
      card.forecast.wakeConflicts.length > 0 ||
      card.forecast.bonuses.length > 0 ||
      card.forecast.startConstraint != null,
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
        ...(card.forecast.startConstraint == null
          ? []
          : [
              <Text
                key={`constraint:${card.id}`}
                testID={`queue-start-constraint:${card.id}`}
                style={[
                  styles.forecastChip,
                  card.forecast.startConstraint.kind === 'reroute'
                    ? styles.bonusChip
                    : styles.warningChip,
                ]}
              >
                {startConstraintChip(
                  card.forecast.startConstraint,
                )}
              </Text>,
            ]),
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

function forecastAccessibilityLabel(
  card: PublishedQueueCard,
): string {
  const details = [
    whyLine(card.forecast.reason),
    card.forecast.startConstraint == null
      ? null
      : startConstraintDetail(card.forecast.startConstraint),
    ...card.forecast.conflicts.map(conflictDetail),
    ...card.forecast.wakeConflicts.map(wakeConflictDetail),
    ...card.forecast.bonuses.map(bonusDetail),
    ...Object.entries(card.forecast.capWaste).map(([bar, amount]) =>
      capWasteDetail(bar, amount ?? 0),
    ),
  ].filter((value): value is string => value !== null);
  return details.length === 0 ? '' : `, ${details.join(' ')}`;
}
