import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DailyRecap, SessionState } from '../game/session';
import {
  fillFirstSessionCopy,
  firstSessionStrings,
} from './first-session-copy';
import { activityCopy, blockLabel } from './queue-presenter';

export interface FirstSessionUIProps {
  session: SessionState;
  hudHeight: number;
  onChooseDecoration: (decorationId: 'leafy-plant' | 'sunny-vase') => void;
}

export interface FirstSessionUIHandle {
  closePanels: () => boolean;
  openGoals: () => boolean;
}

const CREAM_LIGHT = '#faf1dc';
const CREAM_BASE = '#f2e4c2';
const CREAM_SHADOW = '#d9c493';
const INK = '#2e2119';
const GOLD = '#f0a840';
const GREEN = '#5ca860';

const GOAL_IDS = ['meet-you', 'change-of-plans'] as const;
type GoalId = (typeof GOAL_IDS)[number];

const GOAL_COPY = {
  'meet-you': firstSessionStrings.goals.meetYou,
  'change-of-plans': firstSessionStrings.goals.changeOfPlans,
} as const;

export const FirstSessionUI = forwardRef<
  FirstSessionUIHandle,
  FirstSessionUIProps
>(function FirstSessionUI(
  { session, hudHeight, onChooseDecoration },
  ref,
) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [expandedRecap, setExpandedRecap] = useState(false);
  const [dismissedRecap, setDismissedRecap] =
    useState<DailyRecap | null>(null);
  const recap =
    session.morningRecap !== dismissedRecap
      ? session.morningRecap
      : null;

  useEffect(() => {
    setExpandedRecap(false);
  }, [session.morningRecap]);

  useEffect(() => {
    if (isFreshSession(session)) {
      setGoalsOpen(false);
      setExpandedRecap(false);
      setDismissedRecap(null);
    }
  }, [session]);

  useImperativeHandle(
    ref,
    () => ({
      openGoals: () => {
        setGoalsOpen(true);
        return true;
      },
      closePanels: () => {
        if (goalsOpen) {
          setGoalsOpen(false);
          return true;
        }
        if (expandedRecap) {
          setExpandedRecap(false);
          return true;
        }
        return false;
      },
    }),
    [expandedRecap, goalsOpen],
  );

  const activeGoalId =
    GOAL_IDS.find((goalId) => session.goals[goalId]?.status !== 'complete') ??
    null;
  const goalChipLabel =
    activeGoalId === null
      ? firstSessionStrings.goals.allComplete
      : `${GOAL_COPY[activeGoalId].title}: ${goalProgressLabel(
          activeGoalId,
          session,
        )}`;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityLabel={`${firstSessionStrings.goals.open}. ${goalChipLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: goalsOpen }}
        onPress={() => setGoalsOpen((open) => !open)}
        style={({ pressed }) => [
          styles.goalChip,
          { top: hudHeight + 8 },
          pressed && styles.buttonPressed,
        ]}
        testID="first-session-goal-chip"
      >
        <Text style={styles.goalChipMark}>
          {activeGoalId === null ? '✓' : '◇'}
        </Text>
        <Text numberOfLines={1} style={styles.goalChipText}>
          {goalChipLabel}
        </Text>
      </Pressable>

      {goalsOpen && (
        <View
          accessibilityLabel={firstSessionStrings.goals.panelLabel}
          style={[styles.goalsPanel, { top: hudHeight + 60 }]}
          testID="first-session-goals"
        >
          <PanelHeading
            eyebrow={firstSessionStrings.goals.eyebrow}
            title={firstSessionStrings.goals.title}
            closeLabel={firstSessionStrings.goals.close}
            onClose={() => setGoalsOpen(false)}
          />
          {GOAL_IDS.map((goalId) => (
            <GoalRow
              key={goalId}
              goalId={goalId}
              session={session}
            />
          ))}
        </View>
      )}

      {session.wrinkles.choiceReadyId === 'package-delivery' && (
        <View
          accessible
          accessibilityLabel={`${firstSessionStrings.package.title}. ${firstSessionStrings.package.body}`}
          accessibilityLiveRegion="polite"
          style={[styles.eventCard, { top: hudHeight + 16 }]}
          testID="first-session-package"
        >
          <Text
            accessibilityLiveRegion="polite"
            style={styles.srOnly}
          >
            {firstSessionStrings.package.announcement}
          </Text>
          <Text style={styles.eyebrow}>
            {firstSessionStrings.package.eyebrow}
          </Text>
          <Text style={styles.eventTitle}>
            {firstSessionStrings.package.title}
          </Text>
          <Text style={styles.body}>
            {firstSessionStrings.package.body}
          </Text>
          <DecorationChoice
            id="leafy-plant"
            glyph="♣"
            label={firstSessionStrings.package.choices.leafyPlant.label}
            description={
              firstSessionStrings.package.choices.leafyPlant.description
            }
            onPress={() => onChooseDecoration('leafy-plant')}
          />
          <DecorationChoice
            id="sunny-vase"
            glyph="✦"
            label={firstSessionStrings.package.choices.sunnyVase.label}
            description={
              firstSessionStrings.package.choices.sunnyVase.description
            }
            onPress={() => onChooseDecoration('sunny-vase')}
          />
        </View>
      )}

      {recap !== null && (
        <MorningRecap
          recap={recap}
          expanded={expandedRecap}
          top={hudHeight + 16}
          onToggle={() => setExpandedRecap((expanded) => !expanded)}
          onDone={() => {
            setDismissedRecap(recap);
            setExpandedRecap(false);
          }}
        />
      )}
    </View>
  );
});

function GoalRow({
  goalId,
  session,
}: {
  goalId: GoalId;
  session: SessionState;
}) {
  const goal = session.goals[goalId]!;
  const copy = GOAL_COPY[goalId];
  const complete = goal.status === 'complete';
  return (
    <View
      accessible
      accessibilityLabel={`${copy.title}. ${
        complete
          ? firstSessionStrings.goals.complete
          : goalProgressAccessibility(goalId, session)
      }. ${copy.instruction}. ${copy.reward}`}
      style={[styles.goalRow, complete && styles.goalRowComplete]}
      testID={`first-session-goal:${goalId}`}
    >
      <Text style={[styles.goalStatus, complete && styles.goalStatusComplete]}>
        {complete ? '✓' : '○'}
      </Text>
      <View style={styles.goalCopy}>
        <Text style={styles.goalTitle}>{copy.title}</Text>
        <Text style={styles.goalInstruction}>{copy.instruction}</Text>
        <Text style={styles.goalReward}>{copy.reward}</Text>
      </View>
    </View>
  );
}

function goalProgressLabel(goalId: GoalId, session: SessionState): string {
  const counters = session.goals[goalId]?.counters ?? {};
  if (goalId === 'meet-you') {
    const activities = Math.min(3, counters.activitiesCompleted ?? 0);
    const why =
      (counters.whyLineOpened ?? 0) >= 1
        ? firstSessionStrings.goals.progress.whyOpened
        : firstSessionStrings.goals.progress.openWhy;
    return `${activities}/3 · ${why}`;
  }
  const edited = (counters.queueEdits ?? 0) >= 1;
  const seen = (counters.forecastChangesSeen ?? 0) >= 1;
  return `${
    edited
      ? firstSessionStrings.goals.progress.editDone
      : firstSessionStrings.goals.progress.makeEdit
  } · ${
    seen
      ? firstSessionStrings.goals.progress.forecastSeen
      : firstSessionStrings.goals.progress.checkForecast
  }`;
}

function goalProgressAccessibility(
  goalId: GoalId,
  session: SessionState,
): string {
  const counters = session.goals[goalId]?.counters ?? {};
  if (goalId === 'meet-you') {
    return `${Math.min(3, counters.activitiesCompleted ?? 0)} of 3 activities, ${
      (counters.whyLineOpened ?? 0) >= 1
        ? firstSessionStrings.goals.progress.whyLineOpened
        : firstSessionStrings.goals.progress.whyLineNotOpened
    }`;
  }
  return `${
    (counters.queueEdits ?? 0) >= 1
      ? firstSessionStrings.goals.progress.planEdited
      : firstSessionStrings.goals.progress.planNotEdited
  }, ${
    (counters.forecastChangesSeen ?? 0) >= 1
      ? firstSessionStrings.goals.progress.forecastChangeSeen
      : firstSessionStrings.goals.progress.forecastChangeNotSeen
  }`;
}

function DecorationChoice({
  id,
  glyph,
  label,
  description,
  onPress,
}: {
  id: 'leafy-plant' | 'sunny-vase';
  glyph: string;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        pressed && styles.buttonPressed,
      ]}
      testID={`first-session-package:${id}`}
    >
      <Text style={styles.choiceGlyph}>{glyph}</Text>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceLabel}>{label}</Text>
        <Text style={styles.choiceDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

function MorningRecap({
  recap,
  expanded,
  top,
  onToggle,
  onDone,
}: {
  recap: DailyRecap;
  expanded: boolean;
  top: number;
  onToggle: () => void;
  onDone: () => void;
}) {
  const activityCount = recap.completedActivityIds.length;
  const mealCount = recap.completedActivityIds.filter(
    (activityId) => activityId === 'meal',
  ).length;
  const practicePoints = Math.round(recap.practicePoints100 / 100);
  const missed = missedRoutineCopy(recap);
  const accessibilityLabel = [
    fillFirstSessionCopy(firstSessionStrings.recap.title, {
      day: recap.forDay,
    }),
    fillFirstSessionCopy(firstSessionStrings.recap.activities, {
      count: activityCount,
    }),
    fillFirstSessionCopy(firstSessionStrings.recap.meals, {
      count: mealCount,
    }),
    fillFirstSessionCopy(firstSessionStrings.recap.practice, {
      points: practicePoints,
    }),
    missed,
  ].join('. ');

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.recapCard, { top }]}
      testID="first-session-recap"
    >
      <Text
        accessibilityLiveRegion="polite"
        style={styles.srOnly}
        testID="first-session-recap-announcement"
      >
        {fillFirstSessionCopy(firstSessionStrings.recap.announcement, {
          day: recap.forDay,
        })}
      </Text>
      <Text style={styles.eyebrow}>{firstSessionStrings.recap.eyebrow}</Text>
      <Text style={styles.eventTitle}>
        {fillFirstSessionCopy(firstSessionStrings.recap.title, {
          day: recap.forDay,
        })}
      </Text>
      <View style={styles.recapStats}>
        <Stat
          value={activityCount}
          label={firstSessionStrings.recap.activityLabel}
        />
        <Stat
          value={mealCount}
          label={firstSessionStrings.recap.mealLabel}
        />
        <Stat
          value={practicePoints}
          label={firstSessionStrings.recap.practiceLabel}
        />
      </View>
      <Text
        style={[
          styles.missedLine,
          recap.missedAnchorIds.length > 0 && styles.missedLineAlert,
        ]}
      >
        {missed}
      </Text>
      {expanded && (
        <View style={styles.recapDetails} testID="first-session-recap:expanded">
          <Text style={styles.detailHeading}>
            {firstSessionStrings.recap.finishedHeading}
          </Text>
          <Text style={styles.detailText}>
            {completedActivitiesCopy(recap)}
          </Text>
          <Text style={styles.journalLine}>
            {firstSessionStrings.recap.journalLine}
          </Text>
        </View>
      )}
      <View style={styles.actionRow}>
        <ActionButton
          label={
            expanded
              ? firstSessionStrings.recap.less
              : firstSessionStrings.recap.details
          }
          testID="first-session-recap:details"
          onPress={onToggle}
        />
        <ActionButton
          label={firstSessionStrings.recap.done}
          testID="first-session-recap:done"
          onPress={onDone}
        />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PanelHeading({
  eyebrow,
  title,
  closeLabel,
  onClose,
}: {
  eyebrow: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.panelHeading}>
      <View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      <Pressable
        accessibilityLabel={closeLabel}
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [
          styles.closeButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </View>
  );
}

function ActionButton({
  label,
  testID,
  onPress,
}: {
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.buttonPressed,
      ]}
      testID={testID}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function missedRoutineCopy(recap: DailyRecap): string {
  if (recap.missedAnchorIds.length === 0) {
    return firstSessionStrings.recap.missedNone;
  }
  return fillFirstSessionCopy(firstSessionStrings.recap.missedSome, {
    routines: recap.missedAnchorIds.map(blockLabel).join(', '),
  });
}

function completedActivitiesCopy(recap: DailyRecap): string {
  if (recap.completedActivityIds.length === 0) {
    return firstSessionStrings.recap.noneFinished;
  }
  return recap.completedActivityIds
    .map((activityId) => activityCopy(activityId).label)
    .join(' · ');
}

function isFreshSession(session: SessionState): boolean {
  return (
    session.recap.forDay === 1 &&
    session.morningRecap === null &&
    session.wrinkles.firedIds.length === 0 &&
    session.decorations.grantedIds.length === 0 &&
    !session.observations.whyLineOpened &&
    !session.observations.forecastChangeObserved
  );
}

const styles = StyleSheet.create({
  goalChip: {
    position: 'absolute',
    left: 8,
    width: 264,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 4,
    backgroundColor: CREAM_BASE,
    zIndex: 30,
  },
  goalChipMark: {
    color: GOLD,
    fontFamily: 'monospace',
    fontSize: 16,
  },
  goalChipText: {
    flex: 1,
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
  },
  goalsPanel: {
    position: 'absolute',
    left: 8,
    width: 336,
    padding: 10,
    gap: 8,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 4,
    backgroundColor: CREAM_BASE,
    zIndex: 31,
  },
  panelHeading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
  },
  eyebrow: {
    color: GOLD,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  closeText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 18,
  },
  goalRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: CREAM_SHADOW,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  goalRowComplete: {
    borderColor: GREEN,
  },
  goalStatus: {
    color: CREAM_SHADOW,
    fontFamily: 'monospace',
    fontSize: 18,
  },
  goalStatusComplete: {
    color: GREEN,
  },
  goalCopy: {
    flex: 1,
    gap: 3,
  },
  goalTitle: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
  },
  goalInstruction: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
  goalReward: {
    color: GOLD,
    fontFamily: 'monospace',
    fontSize: 9,
  },
  eventCard: {
    position: 'absolute',
    left: '50%',
    width: 368,
    marginLeft: -184,
    padding: 12,
    gap: 8,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: INK,
    borderRadius: 5,
    backgroundColor: CREAM_BASE,
    zIndex: 50,
  },
  eventTitle: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  choice: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  choiceGlyph: {
    width: 32,
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 22,
    textAlign: 'center',
  },
  choiceCopy: {
    flex: 1,
    gap: 2,
  },
  choiceLabel: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
  },
  choiceDescription: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
  },
  recapCard: {
    position: 'absolute',
    right: 8,
    width: 344,
    padding: 12,
    gap: 8,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: INK,
    borderRadius: 5,
    backgroundColor: CREAM_BASE,
    zIndex: 45,
  },
  recapStats: {
    flexDirection: 'row',
    gap: 6,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: CREAM_SHADOW,
    backgroundColor: CREAM_LIGHT,
  },
  statValue: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 9,
  },
  missedLine: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 10,
  },
  missedLineAlert: {
    color: '#c8402e',
  },
  recapDetails: {
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: CREAM_SHADOW,
  },
  detailHeading: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  detailText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
  journalLine: {
    color: '#6b4f74',
    fontFamily: 'monospace',
    fontSize: 10,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    minWidth: 88,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  actionText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
  buttonPressed: {
    backgroundColor: CREAM_SHADOW,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
