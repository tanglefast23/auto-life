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
import { CHROME, FONT, TYPE_SCALE, theme } from './theme';

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
  /** SPEC §11.6 — the recap still arrives, it just stops sliding (P6 T11). */
  reducedMotion?: boolean;
}

export interface FirstSessionUIHandle {
  closePanels: () => boolean;
  openGoals: () => boolean;
}

const CREAM_LIGHT = theme.color.creamLight;
const CREAM_BASE = theme.color.creamBase;
const CREAM_SHADOW = theme.color.creamShadow;
const INK = theme.color.ink;
const GOLD = theme.color.gold;
const GREEN = theme.color.leaf;

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
    reducedMotion = false,
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
          reducedMotion={reducedMotion}
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
    ...CHROME.chip,
    position: 'absolute',
    left: 8,
    width: 264,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    zIndex: 30,
  },
  goalChipMark: {
    color: GOLD,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
  },
  goalChipText: {
    flex: 1,
    color: INK,
    ...TYPE_SCALE.caption,
  },
  intentionChip: {
    ...CHROME.chip,
    position: 'absolute',
    left: 280,
    width: 248,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    zIndex: 30,
  },
  wrinkleChip: {
    ...CHROME.chip,
    position: 'absolute',
    right: 8,
    width: 248,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    zIndex: 30,
  },
  wrinkleChipMark: {
    color: GOLD,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
  },
  intentionChipMark: {
    color: GREEN,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
  },
  goalsPanel: {
    ...CHROME.panel,
    position: 'absolute',
    left: 8,
    width: 336,
    padding: 10,
    gap: 8,
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
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  routineMemoryCopy: {
    color: theme.color.leafShadow,
    ...TYPE_SCALE.caption,
  },
  panelHeading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: INK,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  eyebrow: {
    color: GOLD,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
    letterSpacing: 1,
  },
  closeButton: {
    ...CHROME.secondaryButton,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: INK,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
  },
  goalRow: {
    ...CHROME.card,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
  },
  preferenceTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  preferenceTag: {
    backgroundColor: theme.color.creamBase,
    borderColor: INK,
    borderRadius: 4,
    borderWidth: 1,
    color: theme.color.plumShadow,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  intentionSummary: {
    ...CHROME.card,
    gap: 5,
  },
  goalRowComplete: {
    borderColor: GREEN,
  },
  goalStatus: {
    color: CREAM_SHADOW,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
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
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
  },
  goalInstruction: {
    color: INK,
    ...TYPE_SCALE.caption,
  },
  goalProgress: {
    color: GREEN,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  goalReward: {
    color: GOLD,
    ...TYPE_SCALE.caption,
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
    ...CHROME.secondaryButton,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  goalFilterSelected: {
    ...CHROME.selectedControl,
  },
  goalFilterText: {
    color: INK,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  goalFilterTextSelected: { color: CREAM_LIGHT },
  journalSection: {
    ...CHROME.card,
    gap: 5,
  },
  journalEntry: {
    color: theme.color.plum,
    ...TYPE_SCALE.caption,
  },
  eventCard: {
    ...CHROME.panel,
    position: 'absolute',
    left: '50%',
    width: 368,
    marginLeft: -184,
    padding: 12,
    gap: 8,
    borderWidth: 3,
    borderBottomWidth: 6,
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
    backgroundColor: 'rgba(36, 31, 46, 0.76)',
    zIndex: 100,
  },
  lifeDecisionCard: {
    ...CHROME.panel,
    width: '100%',
    maxWidth: 420,
    padding: 16,
    gap: 10,
    borderWidth: 3,
    borderBottomWidth: 6,
  },
  intentionPanel: {
    maxHeight: 560,
    zIndex: 55,
  },
  intentionChoice: {
    ...CHROME.card,
    minHeight: 50,
    gap: 3,
    padding: 8,
  },
  intentionChoiceDefault: {
    borderColor: GOLD,
  },
  eventTitle: {
    color: INK,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  body: {
    color: INK,
    ...TYPE_SCALE.caption,
  },
  wrinkleSuccess: {
    color: GREEN,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  choice: {
    ...CHROME.card,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
  },
  choiceGlyph: {
    width: 32,
    color: GREEN,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.heading.fontSize,
    textAlign: 'center',
  },
  choiceCopy: {
    flex: 1,
    gap: 2,
  },
  choiceLabel: {
    color: INK,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  choiceDescription: {
    color: INK,
    ...TYPE_SCALE.caption,
  },
  recapCard: {
    ...CHROME.panel,
    position: 'absolute',
    right: 8,
    width: 344,
    padding: 12,
    gap: 8,
    borderWidth: 3,
    borderBottomWidth: 6,
    zIndex: 45,
  },
  recapStats: {
    flexDirection: 'row',
    gap: 6,
  },
  stat: {
    ...CHROME.card,
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
  },
  statValue: {
    color: INK,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
  },
  statLabel: {
    color: INK,
    ...TYPE_SCALE.caption,
  },
  missedLine: {
    color: GREEN,
    ...TYPE_SCALE.caption,
  },
  missedLineAlert: {
    color: theme.color.red,
  },
  recapDetails: {
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: CREAM_SHADOW,
  },
  detailHeading: {
    color: INK,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
    letterSpacing: 1,
  },
  detailText: {
    color: INK,
    ...TYPE_SCALE.caption,
  },
  journalLine: {
    color: theme.color.plum,
    ...TYPE_SCALE.caption,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    ...CHROME.neutralButton,
    minWidth: 88,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: CREAM_LIGHT,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  buttonPressed: {
    borderTopWidth: 2,
    transform: [{ translateY: 2 }],
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
