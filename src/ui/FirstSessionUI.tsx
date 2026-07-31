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
import { GUTTER, LAYER, type Rect, type Regions } from './layout';
import type { CharacterView } from '../sim/step';
import { NoticeColumn, type NoticeItem } from './NoticeColumn';

export interface FirstSessionUIProps {
  session: SessionState;
  /** Laid-out regions. Notices stack in `regions.notice`; focus surfaces centre on it. */
  regions?: Regions;
  /**
   * Notices owned by the screen rather than by the first session — the undo toast today.
   * They are merged into the one NOTICE stack here, so the three-visible cap counts every
   * notice on screen rather than each owner capping its own.
   */
  notices?: readonly NoticeItem[];
  /** Stable for one live career; changing it clears presentation-only panels. */
  presentationKey?: object | string | number;
  hudHeight: number;
  onChooseDecoration: (decorationId: 'leafy-plant' | 'sunny-vase') => void;
  preferenceLabels?: readonly string[];
  currentDay?: number;
  autonomy?: AutonomyMode;
  practicePoints100?: number;
  /** docs/08 §11.3: passed through to the goals panel, which owns the FOCUS region. */
  character?: CharacterView;
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
    regions,
    notices = [],
    onChooseDecoration,
    preferenceLabels = [],
    currentDay = session.recap.forDay,
    autonomy = 'full-routine',
    practicePoints100 = 0,
    character,
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

  /**
   * At most one FOCUS surface, chosen by priority (§3.3 rule 5).
   *
   * These panels each centre themselves on the stage, so two of them open at once were
   * simply overlapped — and the conditions that kept them apart were ad-hoc and partial
   * (`recap === null && wrinkleOpen` guarded exactly one of the five pairs). Naming the
   * winner once makes the rule total, and makes it testable.
   *
   * Order is by consequence: a life decision outranks a letter, a letter outranks the
   * day's recap, and the recap outranks an informational panel the player opened.
   */
  const activeFocus:
    | 'letter'
    | 'letter-accepted'
    | 'package'
    | 'recap'
    | 'intention'
    | 'wrinkle'
    | null = (() => {
    if (session.letter.status === 'due' && onRespondToLetter !== undefined) return 'letter';
    if (
      session.letter.status === 'accepted' &&
      acceptedNoticeDay === session.letter.acceptedAtDay
    ) {
      return 'letter-accepted';
    }
    if (session.wrinkles.choiceReadyId === 'package-delivery') return 'package';
    if (recap !== null) return 'recap';
    if (intentionOpen && onSelectIntention !== undefined) return 'intention';
    if (wrinkleOpen && announcedWrinkle !== null && announcedVariant !== null) {
      return 'wrinkle';
    }
    return null;
  })();

  /**
   * A fragment, not a wrapping `View`.
   *
   * react-native-web gives **every** `View` `position: relative; z-index: 0`, so every View
   * is a CSS stacking context. An `absoluteFill` wrapper here therefore trapped all of
   * these surfaces inside one z-0 box: the recap's `LAYER.focus` and the chips'
   * `LAYER.notice` competed only with each other, while the wrapper as a whole competed
   * with the HUD at z 0 and lost. That is the mechanism behind the recap-under-the-rail
   * collision — the numbers were never compared. Emitting the surfaces as siblings of
   * `Hud` and `QueueStrip` is what puts them all in one stacking context, which is the only
   * arrangement in which the ladder decides anything.
   *
   * Each child is absolutely positioned and owns its own hit area, so the wrapper's
   * `pointerEvents="box-none"` is no longer needed to keep touches falling through.
   */
  return (
    <>
      {/* Every informational surface lives in the right column now — goals, the day's
          intention, the day's wrinkle. They used to anchor themselves at `hudHeight + 8`
          and `left: 280`, which put them over the room at whatever height the HUD happened
          to be that frame. A pointer that covers the thing it points at is not a pointer;
          one column, one order, one width. */}
      <NoticeColumn
        region={regions?.notice}
        items={[
          {
            id: 'goal',
            node: (
              <Pressable
                ref={goalChipRef}
                accessibilityLabel={`${goalStrings.ui.open}. ${goalChip.label}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: goalsOpen }}
                onPress={() => setGoalsOpen((open) => !open)}
                style={({ pressed }) => [
                  styles.goalChip,
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
            ),
          },
          ...(dailyIntentionPrompt &&
          todayIntention === null &&
          onSelectIntention !== undefined
            ? [
                {
                  id: 'intention',
                  node: (
                    <Pressable
                      accessibilityLabel={intentionStrings.prompt.chip}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: intentionOpen }}
                      onPress={() => setIntentionOpen(true)}
                      style={({ pressed }) => [
                        styles.intentionChip,
                        pressed && styles.buttonPressed,
                      ]}
                      testID="daily-intention-chip"
                    >
                      <Text style={styles.intentionChipMark}>◎</Text>
                      <Text numberOfLines={1} style={styles.goalChipText}>
                        {intentionStrings.prompt.chip}
                      </Text>
                    </Pressable>
                  ),
                },
              ]
            : []),
          ...(announcedVariant !== null
            ? [
                {
                  id: `wrinkle:${announcedVariant.id}`,
                  node: (
                    <Pressable
                      accessibilityLabel={`${wrinkleStrings.ui.chipPrefix}: ${wrinkleString(
                        announcedVariant.titleStringId,
                      )}`}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: wrinkleOpen }}
                      onPress={() => setWrinkleOpen((open) => !open)}
                      style={({ pressed }) => [
                        styles.wrinkleChip,
                        pressed && styles.buttonPressed,
                      ]}
                      testID="daily-wrinkle-chip"
                    >
                      <Text style={styles.wrinkleChipMark}>!</Text>
                      <Text numberOfLines={1} style={styles.goalChipText}>
                        {wrinkleString(announcedVariant.titleStringId)}
                      </Text>
                    </Pressable>
                  ),
                },
              ]
            : []),
          ...notices,
        ]}
      />

      {goalsOpen && (
        <GoalsPanel
          session={session}
          preferenceLabels={preferenceLabels}
          intentionDef={intentionDef}
          autonomy={autonomy}
          practicePoints100={practicePoints100}
          character={character}
          canAddProtectedPractice={canAddProtectedPractice}
          onChooseIntention={() => setIntentionOpen(true)}
          onAddProtectedPractice={onAddProtectedPractice}
          onChooseGoalReward={onChooseGoalReward}
          onClose={closeGoals}
          styles={styles}
        />
      )}

      <View
        pointerEvents="box-none"
        style={[styles.focusRegion, regionBox(regions?.focus)]}
      >
      {activeFocus === 'intention' && onSelectIntention !== undefined && (
        <View
          accessibilityLabel={intentionStrings.prompt.title}
          style={[
            styles.eventCard,
            styles.intentionPanel,
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

      {activeFocus === 'package' && (
        <PackagePanel
          onChooseDecoration={onChooseDecoration}
          styles={styles}
        />
      )}

      {activeFocus === 'recap' && recap !== null && (
        <MorningRecap
          recap={recap}
          session={session}
          expanded={expandedRecap}
          reducedMotion={reducedMotion}
          styles={styles}
          onToggle={() => setExpandedRecap((expanded) => !expanded)}
          onDone={() => {
            setDismissedRecap(recap);
            setExpandedRecap(false);
          }}
        />
      )}

      {activeFocus === 'wrinkle' &&
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

      {activeFocus === 'letter-accepted' && (
          <LetterAcceptedPanel
            session={session}
            onDone={() => setAcceptedNoticeDay(null)}
            styles={styles}
          />
        )}

      {activeFocus === 'letter' && onRespondToLetter !== undefined && (
          <LetterPanel
            practicePoints100={practicePoints100}
            onRespond={onRespondToLetter}
            styles={styles}
          />
        )}
      </View>
    </>
  );
});

/** Turn a region rectangle into absolute insets. */
function regionBox(rect: Rect | undefined) {
  if (rect === undefined) return null;
  return {
    left: rect.x + GUTTER,
    top: rect.y,
    width: Math.max(0, rect.width - GUTTER * 2),
    height: rect.height,
  };
}

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
  /**
   * The FOCUS rectangle in the right column. Panels fill it and scroll inside it rather
   * than centring on the room — the recap used to sit on the bedroom every morning.
   */
  focusRegion: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: LAYER.focus,
  },
  goalChip: {
    ...CHROME.chip,
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    zIndex: LAYER.notice,
  },
  goalChipMark: {
    color: GOLD,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
  },
  goalChipText: {
    flexShrink: 1,
    flex: 1,
    color: INK,
    ...TYPE_SCALE.caption,
  },
  intentionChip: {
    ...CHROME.chip,
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    zIndex: LAYER.notice,
  },
  wrinkleChip: {
    // Positioned and sized by the NOTICE column now, not by its own corner.
    ...CHROME.chip,
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    zIndex: LAYER.notice,
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
    left: 0,
    right: 0,
    padding: 10,
    gap: 8,
    zIndex: LAYER.notice,
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
    width: '100%',
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
    left: 0,
    right: 0,
    marginLeft: -184,
    padding: 12,
    gap: 8,
    borderWidth: 3,
    borderBottomWidth: 6,
    zIndex: LAYER.focus,
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
    zIndex: LAYER.modal,
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
    zIndex: LAYER.focus,
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
    width: '100%',
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
  /**
   * FOCUS, centred — and deliberately without a scrim (§7.1).
   *
   * It used to anchor at `right: 8`, which is inside the RAIL's column: the recap and the
   * queue occupied the same pixels every morning. Centring it is the fix. Keeping the
   * scrim off is the product decision: a day boundary earns a moment of attention, but the
   * recap is read rather than acted on, so the sim keeps running underneath it. The
   * surfaces that *do* ask for a decision — event, intention, life decision — keep theirs.
   */
  recapCard: {
    ...CHROME.panel,
    position: 'absolute',
    left: 0,
    right: 0,
    padding: 12,
    gap: 8,
    borderWidth: 3,
    borderBottomWidth: 6,
    zIndex: LAYER.focus,
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
