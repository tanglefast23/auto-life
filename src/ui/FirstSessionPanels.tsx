import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { DailyRecap, SessionState } from '../game/session';
import type { AutonomyMode } from '../sim/rules';
import { content } from '../sim/content';
import type {
  GoalDef,
  IntentionDef,
  WrinkleDef,
} from '../sim/content-schemas';
import {
  fillFirstSessionCopy,
  firstSessionStrings,
} from './first-session-copy';
import {
  intentionString,
  intentionStrings,
} from './intention-copy';
import { activityCopy, blockLabel } from './queue-presenter';
import {
  fillWrinkleCopy,
  wrinkleString,
  wrinkleStrings,
} from './wrinkle-copy';
import {
  decorationChoiceLabel,
  fillGoalCopy,
  goalProgressCopy,
  goalString,
  goalStrings,
} from './goal-copy';
import { storyletString } from './storylet-copy';
import { toDisplay } from '../sim/fixed';
import { BAR_ICON, BAR_ORDER } from './bands';
import { practiceLevel } from '../sim/practice-level';
import { preparedPerformerBonusPercent } from '../game/letter';
import { weekdayForDay } from './clock-format';
import {
  fillLetterCopy,
  letterStrings,
} from './letter-copy';

type FirstSessionStyles = Record<string, any>;

export function goalChipCopy(
  session: SessionState,
  autonomy: AutonomyMode = 'full-routine',
): {
  label: string;
  complete: boolean;
} {
  const goals = [...content.goals.goals].sort(
    (a, b) => a.order - b.order,
  );
  const activeGoal =
    goals.find((goal) => {
      const status = session.goals[goal.id]?.status;
      return status === 'active' || status === 'complete';
    }) ??
    goals.find(
      (goal) => session.goals[goal.id]?.status === 'locked',
    ) ??
    null;
  const complete = activeGoal === null;
  const requiresFull =
    activeGoal?.requiresAutonomy === 'full-routine' &&
    autonomy !== 'full-routine';
  return {
    label:
      activeGoal === null
        ? goalStrings.ui.allComplete
        : `${goalString(activeGoal.titleStringId)}: ${
            requiresFull
              ? goalStrings.ui.requiresFullRoutine
              : session.goals[activeGoal.id]?.status === 'locked'
                ? goalStrings.ui.statuses.locked
                : goalProgressCopy(activeGoal, session)
          }`,
    complete,
  };
}

export function GoalsPanel({
  session,
  preferenceLabels,
  intentionDef,
  autonomy,
  practicePoints100,
  canAddProtectedPractice,
  onChooseIntention,
  onAddProtectedPractice,
  onChooseGoalReward,
  onClose,
  top,
  styles,
}: {
  session: SessionState;
  preferenceLabels: readonly string[];
  intentionDef: IntentionDef | null;
  autonomy: AutonomyMode;
  practicePoints100: number;
  canAddProtectedPractice: boolean;
  onChooseIntention: () => void;
  onAddProtectedPractice?: () => void;
  onChooseGoalReward?: (
    goalId: string,
    choiceId: string,
  ) => void;
  onClose: () => void;
  top: number;
  styles: FirstSessionStyles;
}) {
  const [goalFilter, setGoalFilter] = useState<
    'current' | 'all'
  >('all');
  const sortedGoals = [...content.goals.goals].sort(
    (a, b) => a.order - b.order,
  );
  const visibleGoals =
    goalFilter === 'all'
      ? sortedGoals
      : sortedGoals.filter((goal) => {
          const status = session.goals[goal.id]?.status;
          return status === 'active' || status === 'complete';
        });
  const currentDay = session.recap.forDay;
  const currentDeal = session.wrinkles.dealt.find(
    (deal) => deal.day === currentDay,
  );
  const currentWrinkle =
    currentDeal?.wrinkleId === null ||
    currentDeal?.wrinkleId === undefined
      ? null
      : content.wrinkles.entries.find(
          (wrinkle) => wrinkle.id === currentDeal.wrinkleId,
        ) ?? null;
  const currentVariant =
    currentWrinkle?.variants.find(
      (variant) => variant.id === currentDeal?.variantId,
    ) ?? null;

  return (
    <View
      accessibilityLabel={goalStrings.ui.panelLabel}
      style={[styles.goalsPanel, { top }]}
      testID="first-session-goals"
    >
      <PanelHeading
        eyebrow={goalStrings.ui.eyebrow}
        title={goalStrings.ui.title}
        closeLabel={goalStrings.ui.close}
        onClose={onClose}
        styles={styles}
      />
      <ScrollView
        contentContainerStyle={styles.goalsList}
        style={styles.goalsScroll}
      >
        <Text
          accessible
          accessibilityLabel={fillGoalCopy(
            goalStrings.ui.practiceAccessibility,
            {
              level:
                session.goals['first-chord']?.counters
                  .practiceLevel ?? 0,
              points: Math.round(practicePoints100 / 100),
            },
          )}
          style={styles.practiceSummary}
          testID="goals-practice-level"
        >
          {fillGoalCopy(goalStrings.ui.practiceSummary, {
            level:
              session.goals['first-chord']?.counters
                .practiceLevel ?? 0,
            points: Math.round(practicePoints100 / 100),
          })}
        </Text>
        {session.unlocks.routineMemory && (
          <Text
            style={styles.routineMemoryCopy}
            testID="goals-routine-memory"
          >
            {goalStrings.ui.routineMemory}
          </Text>
        )}
        {(session.letter.status === 'accepted' ||
          session.letter.status === 'declined') && (
          <View
            style={styles.journalSection}
            testID="goals-letter-summary"
          >
            <Text style={styles.detailHeading}>
              {goalString(
                content.goals.goals.find(
                  (goal) => goal.id === 'holidays-over',
                )!.titleStringId,
              )}
            </Text>
            <Text style={styles.detailText}>
              {letterSummaryCopy(session)}
            </Text>
          </View>
        )}
        {preferenceLabels.length > 0 && (
          <View
            accessibilityLabel={preferenceLabels.join(', ')}
            style={styles.preferenceTags}
            testID="goals-preference-tags"
          >
            {preferenceLabels.map((label) => (
              <Text key={label} style={styles.preferenceTag}>
                {label}
              </Text>
            ))}
          </View>
        )}
        <View
          style={styles.intentionSummary}
          testID="goals-daily-intention"
        >
          <Text style={styles.detailHeading}>
            {intentionStrings.prompt.selected}
          </Text>
          {intentionDef === null ? (
            <ActionButton
              label={intentionStrings.prompt.manual}
              testID="goals-choose-intention"
              onPress={onChooseIntention}
              styles={styles}
            />
          ) : (
            <>
              <Text style={styles.goalTitle}>
                {intentionString(intentionDef.labelStringId)}
              </Text>
              <Text style={styles.goalInstruction}>
                {intentionString(intentionDef.descriptionStringId)}
              </Text>
              <Text style={styles.goalReward}>
                {intentionStrings.prompt.locked}
              </Text>
              {intentionDef.id === 'practice-focus' &&
                onAddProtectedPractice !== undefined && (
                  <ActionButton
                    disabled={!canAddProtectedPractice}
                    label={
                      canAddProtectedPractice
                        ? intentionStrings.prompt.addPracticeBlock
                        : intentionStrings.prompt.practiceBlockFull
                    }
                    testID="goals-add-practice-block"
                    onPress={onAddProtectedPractice}
                    styles={styles}
                  />
                )}
            </>
          )}
        </View>
        <View
          style={styles.goalFilters}
          testID="goal-filters"
        >
          {(['current', 'all'] as const).map((filter) => (
            <Pressable
              key={filter}
              accessibilityRole="button"
              accessibilityState={{
                selected: goalFilter === filter,
              }}
              onPress={() => setGoalFilter(filter)}
              style={[
                styles.goalFilter,
                goalFilter === filter &&
                  styles.goalFilterSelected,
              ]}
              testID={`goal-filter:${filter}`}
            >
              <Text style={styles.goalFilterText}>
                {goalStrings.ui.filters[filter]}
              </Text>
            </Pressable>
          ))}
        </View>
        {visibleGoals.map((goal) => (
          <GoalRow
            key={goal.id}
            autonomy={autonomy}
            goal={goal}
            onChooseGoalReward={onChooseGoalReward}
            session={session}
            styles={styles}
          />
        ))}
        <View
          style={styles.journalSection}
          testID="goals-today-wrinkle"
        >
          <Text style={styles.detailHeading}>
            {goalStrings.ui.wrinkle.heading}
          </Text>
          <Text style={styles.detailText}>
            {currentVariant !== null
              ? `${wrinkleString(currentVariant.titleStringId)} · ${
                  currentDeal?.resolved
                    ? goalStrings.ui.wrinkle.resolved
                    : goalStrings.ui.wrinkle.active
                }`
              : currentDeal?.wrinkleId === null
                ? goalStrings.ui.wrinkle.quiet
                : goalStrings.ui.wrinkle.pending}
          </Text>
        </View>
        <View
          style={styles.journalSection}
          testID="goals-journal"
        >
          <Text style={styles.detailHeading}>
            {goalStrings.ui.journal.heading}
          </Text>
          {!session.unlocks.journal ? (
            <Text style={styles.detailText}>
              {goalStrings.ui.journal.locked}
            </Text>
          ) : session.journal.entries.length === 0 ? (
            <Text style={styles.detailText}>
              {goalStrings.ui.journal.empty}
            </Text>
          ) : (
            [...session.journal.entries]
              .reverse()
              .map((entry) => (
                <Text
                  key={entry.id}
                  style={styles.journalEntry}
                  testID={`journal-entry:${entry.id}`}
                >
                  {fillGoalCopy(goalStrings.ui.journal.entry, {
                    day: entry.day,
                    line: storyletString(entry.stringId),
                  })}
                </Text>
              ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function PackagePanel({
  onChooseDecoration,
  top,
  styles,
}: {
  onChooseDecoration: (
    decorationId: 'leafy-plant' | 'sunny-vase',
  ) => void;
  top: number;
  styles: FirstSessionStyles;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${firstSessionStrings.package.title}. ${firstSessionStrings.package.body}`}
      accessibilityLiveRegion="polite"
      style={[styles.eventCard, { top }]}
      testID="first-session-package"
    >
      <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
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
        styles={styles}
      />
      <DecorationChoice
        id="sunny-vase"
        glyph="✦"
        label={firstSessionStrings.package.choices.sunnyVase.label}
        description={
          firstSessionStrings.package.choices.sunnyVase.description
        }
        onPress={() => onChooseDecoration('sunny-vase')}
        styles={styles}
      />
    </View>
  );
}

export function WrinklePanel({
  variant,
  actionReady,
  resolved,
  onAction,
  onClose,
  top,
  styles,
}: {
  variant: WrinkleDef['variants'][number];
  actionReady: boolean;
  resolved: boolean;
  onAction: () => void;
  onClose: () => void;
  top: number;
  styles: FirstSessionStyles;
}) {
  const title = wrinkleString(variant.titleStringId);
  const intro = wrinkleString(variant.introStringId);
  const success = wrinkleString(variant.successStringId);
  return (
    <View
      accessible
      accessibilityLabel={[
        fillWrinkleCopy(wrinkleStrings.ui.announcement, {
          title,
          intro,
        }),
        resolved ? success : null,
      ]
        .filter((line): line is string => line !== null)
        .join(' ')}
      accessibilityLiveRegion="polite"
      style={[styles.eventCard, { top }]}
      testID="daily-wrinkle-panel"
    >
      <PanelHeading
        eyebrow={wrinkleStrings.ui.eyebrow}
        title={title}
        closeLabel={wrinkleStrings.ui.close}
        onClose={onClose}
        styles={styles}
      />
      <Text style={styles.body}>{intro}</Text>
      {resolved && (
        <Text style={styles.wrinkleSuccess}>{success}</Text>
      )}
      {actionReady && (
        <ActionButton
          label={wrinkleString(variant.playerAction.labelStringId)}
          testID="daily-wrinkle-action"
          onPress={onAction}
          styles={styles}
        />
      )}
    </View>
  );
}

export function MorningRecap({
  recap,
  session,
  expanded,
  top,
  onToggle,
  onDone,
  styles,
}: {
  recap: DailyRecap;
  session: SessionState;
  expanded: boolean;
  top: number;
  onToggle: () => void;
  onDone: () => void;
  styles: FirstSessionStyles;
}) {
  const activityCount = recap.completedActivityIds.length;
  const mealCount = recap.mealCount;
  const practicePoints = Math.round(recap.practicePoints100 / 100);
  const missed = missedRoutineCopy(recap);
  const endingBars = recapEndingBarsCopy(recap);
  const wrinkle = recapWrinkleCopy(recap, session);
  const goals = recapGoalsCopy(recap);
  const rewards = recapRewardsCopy(recap);
  const journal = recapJournalCopy(recap, session);
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
    fillFirstSessionCopy(
      firstSessionStrings.recap.practiceSessions,
      { count: recap.practiceSessions },
    ),
    missed,
    endingBars,
    wrinkle,
    goals,
    rewards,
    journal,
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
        {fillFirstSessionCopy(
          firstSessionStrings.recap.announcement,
          { day: recap.forDay },
        )}
      </Text>
      <Text style={styles.eyebrow}>
        {firstSessionStrings.recap.eyebrow}
      </Text>
      <Text style={styles.eventTitle}>
        {fillFirstSessionCopy(firstSessionStrings.recap.title, {
          day: recap.forDay,
        })}
      </Text>
      <View style={styles.recapStats}>
        <Stat
          value={activityCount}
          label={firstSessionStrings.recap.activityLabel}
          styles={styles}
        />
        <Stat
          value={mealCount}
          label={firstSessionStrings.recap.mealLabel}
          styles={styles}
        />
        <Stat
          value={practicePoints}
          label={firstSessionStrings.recap.practiceLabel}
          styles={styles}
        />
      </View>
      <Text
        style={[
          styles.missedLine,
          recap.missedAnchorIds.length > 0 &&
            styles.missedLineAlert,
        ]}
      >
        {missed}
      </Text>
      <Text style={styles.detailText}>
        {fillFirstSessionCopy(
          firstSessionStrings.recap.practiceSessions,
          { count: recap.practiceSessions },
        )}
      </Text>
      <Text style={styles.detailText}>
        {firstSessionStrings.recap.needsHeading}: {endingBars}
      </Text>
      <Text style={styles.journalLine}>{journal}</Text>
      {expanded && (
        <View
          style={styles.recapDetails}
          testID="first-session-recap:expanded"
        >
          <Text style={styles.detailHeading}>
            {firstSessionStrings.recap.finishedHeading}
          </Text>
          <Text style={styles.detailText}>
            {completedActivitiesCopy(recap)}
          </Text>
          <Text style={styles.detailHeading}>
            {firstSessionStrings.recap.wrinkleHeading}
          </Text>
          <Text style={styles.detailText}>{wrinkle}</Text>
          <Text style={styles.detailHeading}>
            {firstSessionStrings.recap.goalsHeading}
          </Text>
          <Text style={styles.detailText}>{goals}</Text>
          <Text style={styles.detailHeading}>
            {firstSessionStrings.recap.rewardsHeading}
          </Text>
          <Text style={styles.detailText}>{rewards}</Text>
          <Text style={styles.detailHeading}>
            {firstSessionStrings.recap.journalHeading}
          </Text>
          <Text style={styles.journalLine}>{journal}</Text>
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
          styles={styles}
        />
        <ActionButton
          label={firstSessionStrings.recap.done}
          testID="first-session-recap:done"
          onPress={onDone}
          styles={styles}
        />
      </View>
    </View>
  );
}

export function LetterPanel({
  practicePoints100,
  onRespond,
  styles,
}: {
  practicePoints100: number;
  onRespond: (decision: 'accept' | 'decline') => void;
  styles: FirstSessionStyles;
}) {
  const level = practiceLevel(
    practicePoints100,
    content.practice.levels,
  );
  const bonus = preparedPerformerBonusPercent(level);
  const preparedCopy =
    level === 0
      ? letterStrings.offer.unprepared
      : fillLetterCopy(letterStrings.offer.prepared, {
          level,
          bonus,
        });
  return (
    <View
      accessibilityLabel={[
        letterStrings.offer.announcement,
        letterStrings.offer.title,
        letterStrings.offer.body,
        preparedCopy,
        letterStrings.offer.declineNote,
      ].join(' ')}
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      accessibilityViewIsModal
      style={styles.lifeDecisionOverlay}
      testID="day-eight-letter"
    >
      <View style={styles.lifeDecisionCard}>
        <Text style={styles.srOnly}>
          {letterStrings.offer.announcement}
        </Text>
        <Text style={styles.eyebrow}>
          {letterStrings.offer.eyebrow}
        </Text>
        <Text style={styles.eventTitle}>
          {letterStrings.offer.title}
        </Text>
        <Text style={styles.body}>{letterStrings.offer.body}</Text>
        <Text style={styles.wrinkleSuccess}>{preparedCopy}</Text>
        <Text style={styles.detailText}>
          {letterStrings.offer.declineNote}
        </Text>
        <View style={styles.actionRow}>
          <ActionButton
            label={letterStrings.offer.accept}
            testID="day-eight-letter:accept"
            onPress={() => onRespond('accept')}
            styles={styles}
          />
          <ActionButton
            label={letterStrings.offer.decline}
            testID="day-eight-letter:decline"
            onPress={() => onRespond('decline')}
            styles={styles}
          />
        </View>
      </View>
    </View>
  );
}

export function LetterAcceptedPanel({
  session,
  onDone,
  styles,
}: {
  session: SessionState;
  onDone: () => void;
  styles: FirstSessionStyles;
}) {
  const startDay = session.letter.promisedStartDay;
  const bonus = session.letter.preparedPerformerBonusPercent;
  if (startDay === null || bonus === null) return null;
  const body = fillLetterCopy(
    bonus === 0
      ? letterStrings.accepted.bodyWithoutBonus
      : letterStrings.accepted.body,
    {
      weekday: weekdayForDay(startDay),
      day: startDay,
      bonus,
    },
  );
  return (
    <View
      accessible
      accessibilityLabel={[
        letterStrings.accepted.title,
        body,
        letterStrings.accepted.terminal,
      ].join(' ')}
      accessibilityLiveRegion="polite"
      style={styles.lifeDecisionOverlay}
      testID="day-eight-letter:accepted"
    >
      <View style={styles.lifeDecisionCard}>
        <Text style={styles.eyebrow}>
          {letterStrings.accepted.eyebrow}
        </Text>
        <Text style={styles.eventTitle}>
          {letterStrings.accepted.title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.wrinkleSuccess}>
          {letterStrings.accepted.terminal}
        </Text>
        <ActionButton
          label={letterStrings.accepted.done}
          testID="day-eight-letter:done"
          onPress={onDone}
          styles={styles}
        />
      </View>
    </View>
  );
}

export function PanelHeading({
  eyebrow,
  title,
  closeLabel,
  onClose,
  styles,
}: {
  eyebrow: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  styles: FirstSessionStyles;
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

function GoalRow({
  goal,
  autonomy,
  onChooseGoalReward,
  session,
  styles,
}: {
  goal: GoalDef;
  autonomy: AutonomyMode;
  onChooseGoalReward?: (
    goalId: string,
    choiceId: string,
  ) => void;
  session: SessionState;
  styles: FirstSessionStyles;
}) {
  const progress = session.goals[goal.id]!;
  const title = goalString(goal.titleStringId);
  const instruction = goalString(goal.instructionStringId);
  const reward = content.goals.rewards.find(
    (candidate) => candidate.id === goal.rewardId,
  )!;
  const rewardLabel = goalString(reward.labelStringId);
  const fulfilled =
    progress.status === 'complete' ||
    progress.status === 'rewarded';
  const requiresFull =
    goal.requiresAutonomy === 'full-routine' &&
    autonomy !== 'full-routine' &&
    progress.status === 'active';
  const progressLabel = requiresFull
    ? goalStrings.ui.requiresFullRoutine
    : goalProgressCopy(goal, session);
  return (
    <View
      accessible
      accessibilityLabel={asSentences([
        title,
        goalStrings.ui.statuses[progress.status],
        progressLabel,
        instruction,
        fillGoalCopy(goalStrings.ui.rewardPrefix, {
          reward: rewardLabel,
        }),
      ])}
      style={[
        styles.goalRow,
        fulfilled && styles.goalRowComplete,
      ]}
      testID={`first-session-goal:${goal.id}`}
    >
      <Text
        style={[
          styles.goalStatus,
          fulfilled && styles.goalStatusComplete,
        ]}
      >
        {progress.status === 'rewarded'
          ? '✓'
          : progress.status === 'complete'
            ? '◇'
            : progress.status === 'locked'
              ? '—'
              : '○'}
      </Text>
      <View style={styles.goalCopy}>
        <Text style={styles.goalTitle}>{title}</Text>
        <Text style={styles.goalProgress}>{progressLabel}</Text>
        <Text style={styles.goalInstruction}>
          {instruction}
        </Text>
        <Text style={styles.goalReward}>
          {fillGoalCopy(goalStrings.ui.rewardPrefix, {
            reward: rewardLabel,
          })}
        </Text>
        {progress.status === 'complete' &&
          reward.kind === 'decoration' &&
          reward.decorationIds.length > 1 &&
          onChooseGoalReward !== undefined && (
            <View style={styles.goalRewardChoices}>
              <Text style={styles.detailHeading}>
                {goalStrings.ui.chooseReward}
              </Text>
              {reward.decorationIds
                .filter(
                  (id) =>
                    !session.decorations.grantedIds.includes(id),
                )
                .map((id) => (
                  <ActionButton
                    key={id}
                    label={decorationChoiceLabel(id)}
                    testID={`goal-reward:${goal.id}:${id}`}
                    onPress={() =>
                      onChooseGoalReward(goal.id, id)
                    }
                    styles={styles}
                  />
                ))}
            </View>
          )}
      </View>
    </View>
  );
}

function DecorationChoice({
  id,
  glyph,
  label,
  description,
  onPress,
  styles,
}: {
  id: 'leafy-plant' | 'sunny-vase';
  glyph: string;
  label: string;
  description: string;
  onPress: () => void;
  styles: FirstSessionStyles;
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

function Stat({
  value,
  label,
  styles,
}: {
  value: number;
  label: string;
  styles: FirstSessionStyles;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  testID,
  onPress,
  styles,
  disabled = false,
}: {
  label: string;
  testID: string;
  onPress: () => void;
  styles: FirstSessionStyles;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
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

function recapEndingBarsCopy(recap: DailyRecap): string {
  if (recap.endingBars === null) {
    return firstSessionStrings.recap.needsUnavailable;
  }
  const comparison =
    recap.priorEndingBars === null
      ? firstSessionStrings.recap.needsFirstDay
      : firstSessionStrings.recap.needsCompared;
  const values = BAR_ORDER.map((bar) => {
    const value = Math.round(toDisplay(recap.endingBars![bar]));
    if (recap.priorEndingBars === null) {
      return `${BAR_ICON[bar].label} ${value}`;
    }
    const prior = Math.round(
      toDisplay(recap.priorEndingBars[bar]),
    );
    const delta = value - prior;
    return `${BAR_ICON[bar].label} ${value} (${
      delta >= 0 ? '+' : ''
    }${delta})`;
  });
  return `${comparison}: ${values.join(' · ')}`;
}

function recapWrinkleCopy(
  recap: DailyRecap,
  session: SessionState,
): string {
  if (recap.wrinkleOutcomeId === null) {
    return firstSessionStrings.recap.wrinkleNone;
  }
  const deal = session.wrinkles.dealt.find(
    (entry) =>
      entry.day === recap.forDay &&
      entry.wrinkleId === recap.wrinkleOutcomeId,
  );
  const wrinkle = content.wrinkles.entries.find(
    (entry) => entry.id === recap.wrinkleOutcomeId,
  );
  const variant = wrinkle?.variants.find(
    (entry) => entry.id === deal?.variantId,
  );
  return variant === undefined
    ? recap.wrinkleOutcomeId
    : wrinkleString(variant.outcomeStringId);
}

function recapGoalsCopy(recap: DailyRecap): string {
  const titles = recap.goalProgressIds.flatMap((goalId) => {
    const goal = content.goals.goals.find(
      (entry) => entry.id === goalId,
    );
    return goal === undefined
      ? []
      : [goalString(goal.titleStringId)];
  });
  return titles.length === 0
    ? firstSessionStrings.recap.goalsNone
    : titles.join(' · ');
}

function recapRewardsCopy(recap: DailyRecap): string {
  const labels = recap.rewardIds.flatMap((rewardId) => {
    const reward = content.goals.rewards.find(
      (entry) => entry.id === rewardId,
    );
    return reward === undefined
      ? []
      : [goalString(reward.labelStringId)];
  });
  return labels.length === 0
    ? firstSessionStrings.recap.rewardsNone
    : labels.join(' · ');
}

function recapJournalCopy(
  recap: DailyRecap,
  session: SessionState,
): string {
  const entry = session.journal.entries.find(
    (candidate) => candidate.id === recap.journalEntryId,
  );
  return entry === undefined
    ? firstSessionStrings.recap.journalNone
    : storyletString(entry.stringId);
}

function letterSummaryCopy(session: SessionState): string {
  if (
    session.letter.status === 'accepted' &&
    session.letter.promisedStartDay !== null &&
    session.letter.preparedPerformerBonusPercent !== null
  ) {
    return fillLetterCopy(letterStrings.summary.accepted, {
      weekday: weekdayForDay(session.letter.promisedStartDay),
      day: session.letter.promisedStartDay,
      bonus: session.letter.preparedPerformerBonusPercent,
    });
  }
  if (
    session.letter.status === 'declined' &&
    session.letter.nextOfferDay !== null
  ) {
    return fillLetterCopy(letterStrings.summary.declined, {
      weekday: weekdayForDay(session.letter.nextOfferDay),
      day: session.letter.nextOfferDay,
    });
  }
  return '';
}

function asSentences(lines: readonly string[]): string {
  return `${lines
    .map((line) => line.trim().replace(/[.!?]+$/u, ''))
    .join('. ')}.`;
}

function completedActivitiesCopy(recap: DailyRecap): string {
  if (recap.completedActivityIds.length === 0) {
    return firstSessionStrings.recap.noneFinished;
  }
  return recap.completedActivityIds
    .map((activityId) => activityCopy(activityId).label)
    .join(' · ');
}
