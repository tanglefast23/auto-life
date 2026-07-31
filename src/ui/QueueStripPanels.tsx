import { Pressable, ScrollView, Text, View } from 'react-native';
import type { PublishedQueueCard } from '../application/snapshot';
import { activityDurationTicksAtCurrentSpeed } from '../sim/activities';
import { activityByIdIn, content } from '../sim/content';
import { toFixed } from '../sim/fixed';
import {
  activityCopy,
  blockLabel,
  type QueueStripBlockItem,
} from './queue-presenter';
import {
  bonusDetail,
  capWasteDetail,
  conflictDetail,
  startConstraintDetail,
  wakeConflictDetail,
  whyLine,
} from './queue-copy';
import type { ActivePreferenceTag } from './preference-tags';
import type { QueueStripSnapshot } from './QueueStrip';
import { theme } from './theme';

type QueueStyles = Record<string, any>;

export interface PaletteActivity {
  id: string;
  label: string;
  glyph: string;
  duration: string;
  effect: string;
  preferenceLabels: string[];
}

export interface PaletteGroup {
  room: string;
  activities: PaletteActivity[];
}

const INK = theme.color.ink;
const ROOM_ORDER = [
  'bedroom',
  'bathroom',
  'kitchen',
  'living',
] as const;
const ROOM_ACCENT: Record<string, string> = {
  bedroom: theme.color.plum,
  bathroom: theme.color.water,
  kitchen: theme.color.leaf,
  living: theme.color.terracotta,
};

export function PalettePanel({
  groups,
  firstItemRef,
  onChoose,
  onClose,
  styles,
}: {
  groups: PaletteGroup[];
  firstItemRef: (node: View | null) => void;
  onChoose: (activityId: string) => void;
  onClose: () => void;
  styles: QueueStyles;
}) {
  return (
    <View style={[styles.popover, styles.palettePanel]} testID="queue-palette">
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.panelEyebrow}>STEER THE DAY</Text>
          <Text style={styles.panelTitle}>Add activity</Text>
        </View>
        <CloseButton onPress={onClose} styles={styles} />
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
              <Text style={styles.roomLabel}>
                {group.room.toUpperCase()}
              </Text>
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
                  accessibilityLabel={`Add ${activity.label}, ${activity.duration}, ${activity.effect}${activity.preferenceLabels.length > 0 ? `, ${activity.preferenceLabels.join(', ')}` : ''}`}
                  testID={`queue-palette-item:${activity.id}`}
                  style={styles.paletteItem}
                >
                  <Text style={styles.paletteGlyph}>
                    {activity.glyph}
                  </Text>
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
                    {activity.preferenceLabels.map((label) => (
                      <Text
                        key={label}
                        style={styles.preferenceTag}
                        testID={`queue-preference:${activity.id}`}
                      >
                        {label}
                      </Text>
                    ))}
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

export function CardMenu({
  current,
  canMoveEarlier,
  canMoveLater,
  onStop,
  onAction,
  firstActionRef,
  onClose,
  styles,
}: {
  current: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onStop: () => void;
  onAction: (
    action: 'earlier' | 'later' | 'next' | 'remove' | 'details',
  ) => void;
  firstActionRef: (node: View | null) => void;
  onClose: () => void;
  styles: QueueStyles;
}) {
  return (
    <View style={[styles.popover, styles.menuPanel]} testID="queue-card-menu">
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>
          {current ? 'Current activity' : 'Queue card'}
        </Text>
        <CloseButton onPress={onClose} styles={styles} />
      </View>
      {current ? (
        <ActionButton
          label="Stop"
          testID="queue-action:stop"
          destructive
          focusRef={firstActionRef}
          onPress={onStop}
          styles={styles}
        />
      ) : (
        <>
          <ActionButton
            label="Move earlier"
            testID="queue-action:move-earlier"
            disabled={!canMoveEarlier}
            focusRef={canMoveEarlier ? firstActionRef : undefined}
            onPress={() => onAction('earlier')}
            styles={styles}
          />
          <ActionButton
            label="Move later"
            testID="queue-action:move-later"
            disabled={!canMoveLater}
            focusRef={
              !canMoveEarlier && canMoveLater
                ? firstActionRef
                : undefined
            }
            onPress={() => onAction('later')}
            styles={styles}
          />
          <ActionButton
            label="Do next"
            testID="queue-action:do-next"
            focusRef={
              !canMoveEarlier && !canMoveLater
                ? firstActionRef
                : undefined
            }
            onPress={() => onAction('next')}
            styles={styles}
          />
          <ActionButton
            label="Remove"
            testID="queue-action:remove"
            destructive
            onPress={() => onAction('remove')}
            styles={styles}
          />
        </>
      )}
      <ActionButton
        label="Details"
        testID="queue-action:details"
        onPress={() => onAction('details')}
        styles={styles}
      />
    </View>
  );
}

export function BlockMenu({
  block,
  onExpand,
  onDetails,
  firstActionRef,
  onClose,
  styles,
}: {
  block: QueueStripBlockItem;
  onExpand: () => void;
  onDetails: () => void;
  firstActionRef: (node: View | null) => void;
  onClose: () => void;
  styles: QueueStyles;
}) {
  return (
    <View style={[styles.popover, styles.menuPanel]} testID="queue-block-menu">
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{blockLabel(block.blockId)}</Text>
        <CloseButton onPress={onClose} styles={styles} />
      </View>
      <Text style={styles.menuHint}>
        Expand this routine before editing a step.
      </Text>
      <ActionButton
        label="Expand to edit"
        testID="queue-action:expand-block"
        focusRef={firstActionRef}
        onPress={onExpand}
        styles={styles}
      />
      <ActionButton
        label="Details"
        testID="queue-action:block-details"
        onPress={onDetails}
        styles={styles}
      />
    </View>
  );
}

export function DetailsPanel({
  card,
  block,
  onClose,
  styles,
}: {
  card: PublishedQueueCard | null;
  block: QueueStripBlockItem | null;
  onClose: () => void;
  styles: QueueStyles;
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
          <CloseButton onPress={onClose} styles={styles} />
        </View>
        <Text style={styles.detailLine}>
          {card.durationTicksAtCurrentSpeed === null
            ? 'Open-ended'
            : `${card.durationTicksAtCurrentSpeed} min at current energy`}
        </Text>
        <Text style={styles.detailLine}>
          {`At ${card.forecast.targetObjectId}`}
        </Text>
        <Text style={styles.detailLine}>
          {effectCopy(card.forecast.effects)}
        </Text>
        {why !== null && (
          <Text style={styles.detailLine} testID={`queue-why:${card.id}`}>
            {why}
          </Text>
        )}
        {card.forecast.startConstraint != null && (
          <Text
            style={[
              styles.detailLine,
              card.forecast.startConstraint.kind === 'reroute'
                ? styles.bonusDetail
                : styles.warningDetail,
            ]}
            testID={`queue-start-constraint-detail:${card.id}`}
          >
            {startConstraintDetail(
              card.forecast.startConstraint,
            )}
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
            key={
              bonus.kind === 'adjacency'
                ? bonus.pairId
                : `block-${index}`
            }
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
        <Text style={styles.panelTitle}>
          {blockLabel(block.blockId)}
        </Text>
        <CloseButton onPress={onClose} styles={styles} />
      </View>
      {block.cards.map((step, index) => {
        const why = whyLine(step.forecast.reason);
        return (
          <View key={step.id}>
            <Text style={styles.detailLine}>
              {`${index + 1}. ${activityCopy(step.activityId).label}`}
            </Text>
            {why !== null && (
              <Text
                style={styles.detailLine}
                testID={`queue-why:${step.id}`}
              >
                {why}
              </Text>
            )}
            {step.forecast.startConstraint != null && (
              <Text
                style={[
                  styles.detailLine,
                  step.forecast.startConstraint.kind === 'reroute'
                    ? styles.bonusDetail
                    : styles.warningDetail,
                ]}
                testID={`queue-start-constraint-detail:${step.id}`}
              >
                {startConstraintDetail(
                  step.forecast.startConstraint,
                )}
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
  styles,
  destructive = false,
  disabled = false,
  focusRef,
}: {
  label: string;
  testID: string;
  onPress: () => void;
  styles: QueueStyles;
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
      <Text
        style={[
          styles.actionText,
          destructive && styles.actionDestructiveText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CloseButton({
  onPress,
  styles,
}: {
  onPress: () => void;
  styles: QueueStyles;
}) {
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

export function buildPaletteGroups(
  snapshot: QueueStripSnapshot | null,
  preferenceTags: readonly ActivePreferenceTag[],
): PaletteGroup[] {
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
      if (activityId === 'idle' || def.playerSelectable === false) {
        continue;
      }
      const duration = activityDurationTicksAtCurrentSpeed(
        def,
        fixedBars,
      );
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
        preferenceLabels: preferenceTags
          .filter((tag) => tag.activityIds.includes(activityId))
          .map((tag) => tag.label),
      });
      grouped.set(object.room, list);
    }
  }

  return ROOM_ORDER.flatMap((room) => {
    const activities = grouped.get(room);
    return activities === undefined ? [] : [{ room, activities }];
  });
}

function effectCopy(
  effects: Partial<Record<string, number>>,
): string {
  const entries = Object.entries(effects).filter(
    ([, value]) => value !== 0,
  );
  if (entries.length === 0) return 'No bar change';
  return entries
    .map(
      ([bar, value]) =>
        `${value! > 0 ? '+' : ''}${value} ${bar}`,
    )
    .join(' · ');
}
