import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DailyRecap, SessionState } from '../game/session';
import { content } from '../sim/content';
import type { AutonomyMode } from '../sim/rules';
import { firstSessionStrings } from './first-session-copy';
import {
  goalChipCopy,
  GoalsPanel,
  LetterAcceptedPanel,
  LetterPanel,
  MorningRecap,
  PackagePanel,
  PanelHeading,
  WrinklePanel,
} from './FirstSessionPanels';
import {
  intentionString,
  intentionStrings,
} from './intention-copy';
import {
  wrinkleString,
  wrinkleStrings,
} from './wrinkle-copy';
import { goalStrings } from './goal-copy';

export interface FirstSessionUIProps {
  session: SessionState;
  /** Stable for one live career; changing it clears presentation-only panels. */
  presentationKey?: object | string | number;
  hudHeight: number;
  onChooseDecoration: (decorationId: 'leafy-plant' | 'sunny-vase') => void;
  preferenceLabels?: readonly string[];
  currentDay?: number;
  autonomy?: AutonomyMode;
  practicePoints100?: number;
  dailyIntentionPrompt?: boolean;
  canAddProtectedPractice?: boolean;
  onSelectIntention?: (intentionId: string) => void;
  onAddProtectedPractice?: () => void;
  onTakeWrinkleAction?: (
    wrinkleId: string,
    actionId: string,
  ) => void;
  onChooseGoalReward?: (
    goalId: string,
    choiceId: string,
  ) => void;
  onRespondToLetter?: (
    decision: 'accept' | 'decline',
  ) => void;
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

export const FirstSessionUI = forwardRef<
  FirstSessionUIHandle,
  FirstSessionUIProps
>(function FirstSessionUI(
  {
    session,
    presentationKey,
    hudHeight,
    onChooseDecoration,
    preferenceLabels = [],
    currentDay = session.recap.forDay,
    autonomy = 'full-routine',
    practicePoints100 = 0,
    dailyIntentionPrompt = true,
    canAddProtectedPractice = true,
    onSelectIntention,
    onAddProtectedPractice,
    onTakeWrinkleAction,
    onChooseGoalReward,
    onRespondToLetter,
  },
  ref,
) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [intentionOpen, setIntentionOpen] = useState(false);
  const [wrinkleOpen, setWrinkleOpen] = useState(false);
  const [expandedRecap, setExpandedRecap] = useState(false);
  const [dismissedRecap, setDismissedRecap] =
    useState<DailyRecap | null>(null);
  const [acceptedNoticeDay, setAcceptedNoticeDay] =
    useState<number | null>(null);
  const previousSession = useRef(session);
  const previousPresentationKey = useRef(presentationKey);
  const goalChipRef = useRef<any>(null);
  const closeGoals = () => {
    setGoalsOpen(false);
    goalChipRef.current?.focus?.();
  };
  const recap =
    session.morningRecap !== dismissedRecap
      ? session.morningRecap
      : null;

  useEffect(() => {
    setExpandedRecap(false);
  }, [session.morningRecap]);

  const announced = session.wrinkles.announced;
  const announcementKey =
    announced === null ||
    announced.wrinkleId === 'package-delivery'
      ? null
      : `${announced.day}/${announced.wrinkleId}/${announced.variantId}`;

  useEffect(() => {
    setWrinkleOpen(announcementKey !== null);
  }, [announcementKey]);

  useEffect(() => {
    const prior = previousSession.current;
    if (
      prior.letter.status === 'due' &&
      session.letter.status === 'accepted'
    ) {
      setAcceptedNoticeDay(session.letter.acceptedAtDay);
    }
    if (
      (
        presentationKey !== undefined &&
        presentationKey !== previousPresentationKey.current
      ) ||
      (
        session !== prior &&
        !isFreshSession(prior) &&
        isFreshSession(session)
      )
    ) {
      setGoalsOpen(false);
      setWrinkleOpen(false);
      setExpandedRecap(false);
      setDismissedRecap(null);
      setAcceptedNoticeDay(null);
    }
    previousSession.current = session;
    previousPresentationKey.current = presentationKey;
  }, [presentationKey, session]);

  useImperativeHandle(
    ref,
    () => ({
      openGoals: () => {
        if (session.letter.status === 'due') return false;
        setGoalsOpen(true);
        return true;
      },
      closePanels: () => {
        if (session.letter.status === 'due') return true;
        if (intentionOpen) {
          setIntentionOpen(false);
          return true;
        }
        if (wrinkleOpen) {
          setWrinkleOpen(false);
          return true;
        }
        if (goalsOpen) {
          closeGoals();
          return true;
        }
        if (expandedRecap) {
          setExpandedRecap(false);
          return true;
        }
        return false;
      },
    }),
    [
      expandedRecap,
      goalsOpen,
      intentionOpen,
      session.letter.status,
      wrinkleOpen,
    ],
  );

  const todayIntention =
    session.intentions.today?.day === currentDay
      ? session.intentions.today
      : null;
  const intentionDef =
    todayIntention === null
      ? null
      : content.intentions.intentions.find(
          (candidate) =>
            candidate.id === todayIntention.intentionId,
        ) ?? null;

  const goalChip = goalChipCopy(session, autonomy);
  const announcedWrinkle =
    announced === null ||
    announced.wrinkleId === 'package-delivery'
      ? null
      : content.wrinkles.entries.find(
          (entry) => entry.id === announced.wrinkleId,
        ) ?? null;
  const announcedVariant =
    announcedWrinkle?.variants.find(
      (variant) => variant.id === announced?.variantId,
    ) ?? null;
  const announcedDeal =
    announced === null
      ? null
      : session.wrinkles.dealt.find(
          (entry) =>
            entry.day === announced.day &&
            entry.wrinkleId === announced.wrinkleId,
        ) ?? null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        ref={goalChipRef}
        accessibilityLabel={`${goalStrings.ui.open}. ${goalChip.label}`}
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
          {goalChip.complete ? '✓' : '◇'}
        </Text>
        <Text numberOfLines={1} style={styles.goalChipText}>
          {goalChip.label}
        </Text>
      </Pressable>

      {dailyIntentionPrompt &&
        todayIntention === null &&
        onSelectIntention !== undefined && (
          <Pressable
            accessibilityLabel={intentionStrings.prompt.chip}
            accessibilityRole="button"
            accessibilityState={{ expanded: intentionOpen }}
            onPress={() => setIntentionOpen(true)}
            style={({ pressed }) => [
              styles.intentionChip,
              { top: hudHeight + 8 },
              pressed && styles.buttonPressed,
            ]}
            testID="daily-intention-chip"
          >
            <Text style={styles.intentionChipMark}>◎</Text>
            <Text style={styles.goalChipText}>
              {intentionStrings.prompt.chip}
            </Text>
          </Pressable>
        )}

      {announcedVariant !== null && (
        <Pressable
          accessibilityLabel={`${wrinkleStrings.ui.chipPrefix}: ${wrinkleString(
            announcedVariant.titleStringId,
          )}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: wrinkleOpen }}
          onPress={() => setWrinkleOpen((open) => !open)}
          style={({ pressed }) => [
            styles.wrinkleChip,
            { top: hudHeight + 60 },
            pressed && styles.buttonPressed,
          ]}
          testID="daily-wrinkle-chip"
        >
          <Text style={styles.wrinkleChipMark}>!</Text>
          <Text numberOfLines={1} style={styles.goalChipText}>
            {wrinkleString(announcedVariant.titleStringId)}
          </Text>
        </Pressable>
      )}

      {goalsOpen && (
        <GoalsPanel
          session={session}
          preferenceLabels={preferenceLabels}
          intentionDef={intentionDef}
          autonomy={autonomy}
          practicePoints100={practicePoints100}
          canAddProtectedPractice={canAddProtectedPractice}
          onChooseIntention={() => setIntentionOpen(true)}
          onAddProtectedPractice={onAddProtectedPractice}
          onChooseGoalReward={onChooseGoalReward}
          onClose={closeGoals}
          top={hudHeight + 60}
          styles={styles}
        />
      )}

      {intentionOpen && onSelectIntention !== undefined && (
        <View
          accessibilityLabel={intentionStrings.prompt.title}
          style={[
            styles.eventCard,
            styles.intentionPanel,
            { top: hudHeight + 16 },
          ]}
          testID="daily-intention-picker"
        >
          <PanelHeading
            eyebrow={intentionStrings.prompt.eyebrow}
            title={intentionStrings.prompt.title}
            closeLabel={intentionStrings.prompt.close}
            onClose={() => setIntentionOpen(false)}
            styles={styles}
          />
          <Text style={styles.body}>
            {intentionStrings.prompt.body}
          </Text>
          {content.intentions.intentions.map((intention) => (
            <Pressable
              key={intention.id}
              accessibilityLabel={`${intentionString(
                intention.labelStringId,
              )}. ${intentionString(intention.descriptionStringId)}`}
              accessibilityRole="button"
              onPress={() => {
                onSelectIntention(intention.id);
                setIntentionOpen(false);
              }}
              style={({ pressed }) => [
                styles.intentionChoice,
                intention.id === content.intentions.defaultId &&
                  styles.intentionChoiceDefault,
                pressed && styles.buttonPressed,
              ]}
              testID={`daily-intention:${intention.id}`}
            >
              <Text style={styles.choiceLabel}>
                {intentionString(intention.labelStringId)}
              </Text>
              <Text style={styles.choiceDescription}>
                {intentionString(intention.descriptionStringId)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {session.wrinkles.choiceReadyId === 'package-delivery' && (
        <PackagePanel
          onChooseDecoration={onChooseDecoration}
          top={hudHeight + 16}
          styles={styles}
        />
      )}

      {recap !== null && (
        <MorningRecap
          recap={recap}
          session={session}
          expanded={expandedRecap}
          top={hudHeight + 16}
          styles={styles}
          onToggle={() => setExpandedRecap((expanded) => !expanded)}
          onDone={() => {
            setDismissedRecap(recap);
            setExpandedRecap(false);
          }}
        />
      )}

      {recap === null &&
        wrinkleOpen &&
        announcedWrinkle !== null &&
        announcedVariant !== null && (
          <WrinklePanel
            variant={announcedVariant}
            actionReady={
              session.wrinkles.choiceReadyId ===
                announcedWrinkle.id &&
              onTakeWrinkleAction !== undefined
            }
            resolved={announcedDeal?.resolved === true}
            top={hudHeight + 16}
            styles={styles}
            onClose={() => setWrinkleOpen(false)}
            onAction={() => {
              onTakeWrinkleAction?.(
                announcedWrinkle.id,
                announcedVariant.playerAction.id,
              );
              setWrinkleOpen(false);
            }}
          />
        )}

      {session.letter.status === 'accepted' &&
        acceptedNoticeDay === session.letter.acceptedAtDay && (
          <LetterAcceptedPanel
            session={session}
            onDone={() => setAcceptedNoticeDay(null)}
            styles={styles}
          />
        )}

      {session.letter.status === 'due' &&
        onRespondToLetter !== undefined && (
          <LetterPanel
            practicePoints100={practicePoints100}
            onRespond={onRespondToLetter}
            styles={styles}
          />
        )}
    </View>
  );
});

function isFreshSession(session: SessionState): boolean {
  return (
    session.recap.forDay === 1 &&
    session.recap.completedActivityIds.length === 0 &&
    session.recap.missedAnchorIds.length === 0 &&
    session.recap.practicePoints100 === 0 &&
    session.morningRecap === null &&
    session.wrinkles.firedIds.length === 0 &&
    session.decorations.grantedIds.length === 0 &&
    session.intentions.today === null &&
    session.intentions.history.length === 0 &&
    session.calendarLedger.days.length === 0 &&
    session.journal.entries.length === 0 &&
    session.letter.status === 'not-due' &&
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
  intentionChip: {
    position: 'absolute',
    left: 280,
    width: 248,
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
  wrinkleChip: {
    position: 'absolute',
    right: 8,
    width: 248,
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
  wrinkleChipMark: {
    color: GOLD,
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '800',
  },
  intentionChipMark: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 16,
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
  goalsScroll: {
    maxHeight: 500,
  },
  goalsList: {
    gap: 8,
    paddingBottom: 2,
  },
  practiceSummary: {
    color: GOLD,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
  routineMemoryCopy: {
    color: '#4a5f43',
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
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
  preferenceTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  preferenceTag: {
    backgroundColor: '#d7e0b4',
    borderRadius: 99,
    color: '#3c4f35',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  intentionSummary: {
    gap: 5,
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
  goalProgress: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
  },
  goalReward: {
    color: GOLD,
    fontFamily: 'monospace',
    fontSize: 9,
  },
  goalRewardChoices: {
    gap: 6,
    paddingTop: 4,
  },
  goalFilters: {
    flexDirection: 'row',
    gap: 6,
  },
  goalFilter: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: CREAM_SHADOW,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  goalFilterSelected: {
    borderColor: GREEN,
  },
  goalFilterText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
  },
  journalSection: {
    gap: 5,
    padding: 8,
    borderWidth: 1,
    borderColor: CREAM_SHADOW,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  journalEntry: {
    color: '#6b4f74',
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
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
  lifeDecisionOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(46, 33, 25, 0.72)',
    zIndex: 100,
  },
  lifeDecisionCard: {
    width: '100%',
    maxWidth: 420,
    padding: 16,
    gap: 10,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: INK,
    borderRadius: 5,
    backgroundColor: CREAM_BASE,
  },
  intentionPanel: {
    maxHeight: 560,
    zIndex: 55,
  },
  intentionChoice: {
    minHeight: 50,
    gap: 3,
    padding: 8,
    borderWidth: 2,
    borderColor: CREAM_SHADOW,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  intentionChoiceDefault: {
    borderColor: GOLD,
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
  wrinkleSuccess: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
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
  actionButtonDisabled: {
    opacity: 0.5,
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
