import { theme } from './theme';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
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
import { MOTION } from '../render/motion';
import { squashInterpolation, useMotionRun, type QueueGhost } from './use-motion';

type QueueStyles = Record<string, any>;

const BLUE = theme.color.water;
const CREAM_SHADOW = theme.color.creamShadow;

/**
 * design.md §10's card slide+squash, on the unit that just mounted (P6 T11).
 *
 * Arrival needs no diff: a card that entered the queue is a component that mounted. The
 * reduced-motion branch lives in `useMotionRun`, not here, so this wrapper cannot drift
 * out of step with the other seven motions.
 */
function EnteringUnit({
  reducedMotion,
  style,
  testID,
  children,
}: {
  reducedMotion: boolean;
  style: unknown;
  testID?: string;
  children: ReactNode;
}) {
  const driver = useMotionRun(MOTION.cardSlide, reducedMotion);
  const scale = squashInterpolation(MOTION.cardSlide, driver, reducedMotion);
  return (
    <Animated.View
      testID={testID}
      style={[style as never, { opacity: driver, transform: [{ scale }] }]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A card that has already left the queue, drawn for as long as its motion runs.
 *
 * Deliberately inert: no testID that collides with a live card, no accessibility
 * presence, and no place in the focus order. It exists so a removal reads as a departure
 * and a completion gets SPEC §11.3's poof — nothing more. The screen reader was already
 * told the card is gone by the live region; announcing a ghost would say it twice.
 */
export function GhostCard({
  ghost,
  styles,
}: {
  ghost: QueueGhost;
  styles: QueueStyles;
}) {
  const copy = activityCopy(ghost.event.activityId);
  const driver = useMotionRun(ghost.motion, false, ghost.key);
  const scale = squashInterpolation(ghost.motion, driver, false);
  const opacity = driver.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      testID={`queue-ghost:${ghost.event.kind}:${ghost.event.cardId}`}
      style={[styles.cardUnit, { opacity, transform: [{ scale }] }]}
    >
      <View style={styles.upcomingCard}>
        <Text style={styles.cardGlyph}>{copy.glyph}</Text>
      </View>
      {/* Outside the card, which clips its overflow — a poof that stays inside the
          border it is bursting out of is just a flicker. */}
      {ghost.frame !== null && <Poof frame={ghost.frame} styles={styles} />}
    </Animated.View>
  );
}

/**
 * design.md §10's four-frame completion poof.
 *
 * Four square puffs pushing outward on the 4px grid — squares rather than a soft burst,
 * because design.md §13 rejects anti-aliased edges and a blurred gradient here would be
 * the one un-pixel thing on the screen. Cream shadow, per `MOTION.poof.color`: gold is
 * reserved for rewards and this is not one.
 */
const POOF_OFFSET = [4, 8, 12, 16] as const;
const POOF_SIZE = [8, 8, 4, 4] as const;

function Poof({ frame, styles }: { frame: number; styles: QueueStyles }) {
  const step = Math.max(0, Math.min(POOF_OFFSET.length - 1, frame));
  const distance = POOF_OFFSET[step]!;
  const size = POOF_SIZE[step]!;
  return (
    <View pointerEvents="none" style={styles.poof} testID={`queue-poof-frame:${step}`}>
      {[
        { left: -distance, top: -distance },
        { left: distance, top: -distance },
        { left: -distance, top: distance },
        { left: distance, top: distance },
      ].map((at, index) => (
        <View
          key={index}
          style={[styles.poofPuff, { width: size, height: size, ...at }]}
        />
      ))}
    </View>
  );
}

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
  reducedMotion = false,
  onMenu,
  onDragStart,
  onDragRelease,
  focusRef,
  onFocus,
  styles,
}: {
  card: PublishedQueueCard;
  pulse: Animated.Value;
  reducedMotion?: boolean;
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
    <EnteringUnit reducedMotion={reducedMotion} style={styles.cardUnit}>
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
    </EnteringUnit>
  );
}

export function CollapsedBlock({
  item,
  pulse,
  reducedMotion = false,
  onExpand,
  onMenu,
  focusRef,
  onFocus,
  styles,
}: {
  item: QueueStripBlockItem;
  pulse: Animated.Value;
  reducedMotion?: boolean;
  onExpand: () => void;
  onMenu: () => void;
  focusRef: (node: View | null) => void;
  onFocus: () => void;
  styles: QueueStyles;
}) {
  const urgent = item.cards.some((card) => card.urgent);
  const firstId = item.cards[0]!.id;
  return (
    <EnteringUnit
      reducedMotion={reducedMotion}
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
    </EnteringUnit>
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
