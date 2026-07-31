import { useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useGameStore } from './game-store';
import { WorldScene } from '../render/WorldScene';
import { bubbleFor, type ForecastWarning } from '../render/bubbles';
import { content as gameContent } from '../sim/content';
import type { FloorMaterial } from '../sim/content-schemas';
import { solveScale, HUD_H, QUEUE_W } from '../render/scale';
import { Hud } from '../ui/Hud';
import { QueueStrip, type QueueStripHandle } from '../ui/QueueStrip';
import {
  WorldInteractions,
  type WorldInteractionsHandle,
} from '../ui/WorldInteractions';
import {
  FirstSessionUI,
  type FirstSessionUIHandle,
} from '../ui/FirstSessionUI';
import { keyboardActionFor, type KeyboardLikeEvent } from '../ui/keyboard';
import { useReducedMotionPreference } from '../ui/accessibility';
import { firstSessionStrings } from '../ui/first-session-copy';
import type { GameLoop, Speed } from './loop';
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
} from './career-state';
import type { ActivePreferenceTag } from '../ui/preference-tags';
import { preferenceReaction } from '../ui/preference-tags';
import { intentionStrings } from '../ui/intention-copy';
import type { AutonomyMode } from '../sim/rules';
import { CHROME, FONT, TYPE_SCALE, theme } from '../ui/theme';

/**
 * P3's screen: the composition root's view (master §4).
 *
 * Drives the loop from a single requestAnimationFrame, hard-pauses on backgrounding
 * (SPEC §5, C1), and lays the world out per §11.5's desktop scaling rule.
 *
 * P4 adds the semantic queue rail beside the world. Persistence remains later work.
 */
export interface GameScreenProps {
  preferences?: AppPreferences;
  onOpenPause?: () => void;
  onToggleMute?: () => void;
  openGoalsRequest?: number;
  preferenceTags?: readonly ActivePreferenceTag[];
  autonomy?: AutonomyMode;
  /** Which baked appearance the career rolled (P6 T5). */
  appearancePresetId?: string;
  /** Active idle variant: an identity preference, or Goal 4's air-guitar reward. */
  idleVariantId?: string | null;
  /** One walk-cycle contact. The composition root owns the bus; this only reports the step. */
  onFootstep?: (material: FloorMaterial) => void;
}

export function GameScreen(props: GameScreenProps = {}) {
  const loop = useGameStore((s) => s.loop);
  if (loop === null) {
    return <View style={styles.root} testID="game-not-hydrated" />;
  }
  return <HydratedGameScreen loop={loop} {...props} />;
}

function HydratedGameScreen({
  loop,
  preferences = DEFAULT_APP_PREFERENCES,
  onOpenPause,
  onToggleMute,
  openGoalsRequest = 0,
  preferenceTags = [],
  autonomy = 'full-routine',
  appearancePresetId,
  idleVariantId = null,
  onFootstep,
}: { loop: GameLoop } & GameScreenProps) {
  const snapshot = useGameStore((s) => s.snapshot);
  const speed = useGameStore((s) => s.speed);
  const fatalError = useGameStore((s) => s.fatalError);
  const advanceFrame = useGameStore((s) => s.advanceFrame);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const togglePause = useGameStore((s) => s.togglePause);
  const setSystemPaused = useGameStore((s) => s.setSystemPaused);
  const alpha = useGameStore((s) => s.alpha);
  const undoToast = useGameStore((s) => s.undoToast);
  const insertActivity = useGameStore((s) => s.insertActivity);
  const stopCurrent = useGameStore((s) => s.stopCurrent);
  const removeCard = useGameStore((s) => s.removeCard);
  const moveCard = useGameStore((s) => s.moveCard);
  const undoLastRemove = useGameStore((s) => s.undoLastRemove);
  const observeWhyLine = useGameStore((s) => s.observeWhyLine);
  const observeForecastChange = useGameStore((s) => s.observeForecastChange);
  const selectIntention = useGameStore((s) => s.selectIntention);
  const addProtectedPractice = useGameStore(
    (s) => s.addProtectedPractice,
  );
  const chooseDecoration = useGameStore((s) => s.chooseDecoration);
  const takeWrinkleAction = useGameStore(
    (s) => s.takeWrinkleAction,
  );
  const chooseGoalReward = useGameStore(
    (s) => s.chooseGoalReward,
  );
  const respondToLetter = useGameStore(
    (s) => s.respondToLetter,
  );

  const { width, height, fontScale } = useWindowDimensions();
  const dpr = typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1;
  const hudTextScale =
    Math.max(
      0.75,
      Math.min(2, Number.isFinite(fontScale) ? fontScale : 1),
    ) * preferences.display.hudTextScale;
  const hudHeight = HUD_H * hudTextScale;
  const fit = useMemo(
    () =>
      solveScale({
        width,
        height,
        devicePixelRatio: dpr,
        hudHeight,
        fractionalScaling: preferences.display.fractionalScaling,
      }),
    [
      width,
      height,
      dpr,
      hudHeight,
      preferences.display.fractionalScaling,
    ],
  );
  const reducedMotion = useReducedMotionPreference(
    preferences.display.reducedMotion,
  );
  const queueStripRef = useRef<QueueStripHandle>(null);
  const worldInteractionsRef = useRef<WorldInteractionsHandle>(null);
  const firstSessionRef = useRef<FirstSessionUIHandle>(null);
  const letterPause = useRef<{
    active: boolean;
    resume: Exclude<Speed, 0> | null;
  }>({ active: false, resume: null });

  useEffect(() => {
    if (openGoalsRequest <= 0) return;
    firstSessionRef.current?.openGoals();
  }, [openGoalsRequest]);

  useEffect(() => {
    letterPause.current = { active: false, resume: null };
  }, [loop]);

  useEffect(() => {
    const due = snapshot?.session.letter.status === 'due';
    if (due && !letterPause.current.active) {
      letterPause.current = {
        active: true,
        resume: speed === 0 ? null : speed,
      };
      if (speed !== 0) setSpeed(0);
      return;
    }
    if (!due && letterPause.current.active) {
      const resume = letterPause.current.resume;
      letterPause.current = { active: false, resume: null };
      if (resume !== null) setSpeed(resume);
    }
  }, [setSpeed, snapshot?.session.letter.status, speed]);

  // The one clock in the app. Everything else is handed elapsed milliseconds.
  //
  // `frameClock.last` is nulled whenever the page becomes visible again. Without that,
  // RAF stops while hidden but `last` keeps its pre-hide timestamp, so the first resumed
  // frame arrives with the whole away-duration as its delta — the hard-pause contract
  // (SPEC §5, C1) says a 60-second absence advances ZERO game minutes, but it advanced
  // eight (the per-frame cap). Observed in the browser and initially mistaken for the
  // cap working correctly; found properly in adversarial pass 2.
  const frameClock = useRef<{ last: number | null; hiddenAt: number | null }>({
    last: null,
    hiddenAt: null,
  });

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      try {
        // Hidden-time presentation effects are elapsed once, in the visibility
        // handler. Ignore any throttled RAF callbacks so that interval cannot be
        // counted here and then counted again on resume.
        if (frameClock.current.hiddenAt === null) {
          const prev = frameClock.current.last;
          frameClock.current.last = now;
          advanceFrame(prev === null ? 0 : now - prev);
        }
      } finally {
        // A simulation fault is caught and parked by the store. Keeping the
        // driver alive prevents a fully painted but silently dead screen.
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [advanceFrame]);

  // SPEC §5 / C1: no time passes while the tab is hidden.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      const now = globalThis.performance.now();
      if (hidden) {
        if (frameClock.current.hiddenAt === null) frameClock.current.hiddenAt = now;
      } else if (frameClock.current.hiddenAt !== null) {
        loop.elapsePresentationTime(now - frameClock.current.hiddenAt);
        frameClock.current.hiddenAt = null;
      }
      // Discard the stale timestamp BEFORE unpausing, so no away-time reaches the loop.
      frameClock.current.last = null;
      setSystemPaused(hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loop, setSystemPaused]);

  // SPEC §11.8: one document listener owns the fixed shortcuts. The pure mapper
  // suppresses editable fields, contenteditable targets, IME composition, and
  // browser/assistive-technology modifier chords before anything reaches here.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handledKeyUps = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => {
      // The sleep-skip gate counts every real input, including keys that do not
      // become game commands (focus movement and editable-field input included).
      loop.notePlayerInput();
      const action = keyboardActionFor(event as unknown as KeyboardLikeEvent);
      if (action === null) return;
      if (event.repeat && action.type !== 'queueArrow') return;

      let handled = false;
      if (action.type === 'togglePause') {
        togglePause();
        handled = true;
      } else if (action.type === 'setSpeed') {
        setSpeed(action.speed);
        handled = true;
      } else if (action.type === 'closePanel') {
        handled = firstSessionRef.current?.closePanels() ?? false;
        if (!handled) {
          handled = worldInteractionsRef.current?.closeChoice() ?? false;
        }
        if (!handled) handled = queueStripRef.current?.closePanels() ?? false;
        if (!handled && onOpenPause !== undefined) {
          onOpenPause();
          handled = true;
        }
      } else if (action.type === 'focusQueue') {
        handled = queueStripRef.current?.focusQueue() ?? false;
      } else if (action.type === 'queueArrow') {
        handled =
          (action.moveCard
            ? queueStripRef.current?.moveFocusedCard(action.direction)
            : queueStripRef.current?.moveQueueFocus(action.direction)) ?? false;
      } else if (action.type === 'openQueueMenu') {
        handled = queueStripRef.current?.openFocusedMenu() ?? false;
      } else if (action.type === 'removeQueueCard') {
        handled = queueStripRef.current?.removeFocused() ?? false;
      } else if (action.type === 'stopCurrent') {
        if (snapshot?.currentCardId !== null && snapshot?.currentCardId !== undefined) {
          stopCurrent();
          handled = true;
        }
      } else if (action.type === 'togglePalette') {
        queueStripRef.current?.togglePalette();
        handled = true;
      } else if (action.type === 'openGoals') {
        handled = firstSessionRef.current?.openGoals() ?? false;
      } else if (action.type === 'toggleMute' && onToggleMute !== undefined) {
        onToggleMute();
        handled = true;
      } else if (action.type === 'undoRemove' && undoToast !== null) {
        handled = undoLastRemove(undoToast.receiptId);
      }

      if (handled) {
        handledKeyUps.add(event.code || event.key);
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.code || event.key;
      if (!handledKeyUps.delete(key)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
    };
  }, [
    loop,
    onOpenPause,
    onToggleMute,
    setSpeed,
    snapshot?.currentCardId,
    stopCurrent,
    togglePause,
    undoLastRemove,
    undoToast,
  ]);

  // Pointer events cover mouse, pen, and touch on web. The root View's
  // onTouchStart below supplies the equivalent signal on native.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPointerDown = () => loop.notePlayerInput();
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [loop]);

  const view = snapshot?.render ?? null;
  // SPEC §11.3's glance trigger: the cards themselves, not the forecast revision, which
  // also bumps every game hour and would make her glance at nothing.
  const queueSignature = useMemo(
    () => (snapshot?.queue ?? []).map((card) => card.id).join('|'),
    [snapshot?.queue],
  );
  const preferenceBubble =
    snapshot === null
      ? null
      : preferenceReaction(
          snapshot.session.recap.completedActivityIds,
          preferenceTags,
        );

  /**
   * SPEC §11.1's world bubble. The rule lives in `bubbles.ts`; this only gathers its inputs
   * from state the engine already publishes — no new domain state, per that module's own
   * bounded-deliberately note.
   *
   * The forecast warning is the loudest ⚠ the queue is currently carrying, which is the
   * same signal the rail's chips read, so the bubble and the card cannot disagree.
   */
  const worldBubble = useMemo(() => {
    if (snapshot === null) return null;
    // A conflict outranks cap waste: one is a bar about to bottom out, the other is effect
    // spent above 100. Both are §7.5 ⚠ chips on the rail, and this reads the same two
    // fields the chips do so the bubble and the card cannot disagree.
    const conflict = snapshot.forecast.conflicts[0];
    const wasted = snapshot.queue
      .flatMap((card) => Object.keys(card.forecast.capWaste))
      .at(0);
    const warning: ForecastWarning | null =
      conflict !== undefined
        ? { kind: 'conflict', barId: conflict.bar }
        : wasted !== undefined
          ? { kind: 'cap-waste', barId: wasted as ForecastWarning['barId'] }
          : null;
    return bubbleFor(
      {
        bars: snapshot.bars,
        preferenceReaction: preferenceBubble,
        warning,
        idleWithEmptyQueue: snapshot.queue.length === 0,
        asleep: snapshot.render.pose === 'sleep',
      },
      gameContent.rates,
    );
  }, [preferenceBubble, snapshot]);

  return (
    <View style={styles.root} onTouchStart={() => loop.notePlayerInput()}>
      <View
        style={[
          styles.stage,
          { top: hudHeight, right: QUEUE_W },
        ]}
      >
        <View style={{ width: fit.width, height: fit.height }}>
          <Canvas style={StyleSheet.absoluteFill}>
            {view !== null && (
              <WorldScene
                view={view}
                decorationIds={snapshot?.session.decorations.grantedIds}
                paletteId={appearancePresetId}
                idleVariantId={idleVariantId}
                minuteOfDay={snapshot?.minuteOfDay}
                reducedMotion={reducedMotion}
                queueSignature={queueSignature}
                bubble={worldBubble}
                onFootstep={onFootstep}
                alphaRef={alpha}
                scale={fit.scale}
                physicalPerArtPixel={fit.physicalPerArtPixel}
                effectiveSpeed={loop.effectiveSpeed}
              />
            )}
          </Canvas>
          <WorldInteractions
            ref={worldInteractionsRef}
            scale={fit.scale}
            onChooseActivity={insertActivity}
          />
        </View>
      </View>
      <Hud
        snapshot={snapshot}
        speed={speed}
        onSpeed={setSpeed}
        onOpenPause={() => {
          loop.notePlayerInput();
          onOpenPause?.();
        }}
        onToggleMute={() => {
          loop.notePlayerInput();
          onToggleMute?.();
        }}
        muted={preferences.audio.muted}
        reducedMotion={reducedMotion}
        textScale={hudTextScale}
        nonColorUrgency={preferences.accessibility.nonColorUrgency}
        screenReaderVerbosity={
          preferences.accessibility.screenReaderVerbosity
        }
      />
      {preferenceBubble !== null && (
        <View
          accessibilityLabel={`${preferenceBubble.label}. ${
            intentionStrings.preferenceBubbles[
              preferenceBubble.kind
            ]
          }`}
          accessibilityLiveRegion="polite"
          style={styles.preferenceBubble}
          testID={`preference-bubble:${preferenceBubble.kind}`}
        >
          <Text style={styles.preferenceBubbleTag}>
            {preferenceBubble.label}
          </Text>
          <Text style={styles.preferenceBubbleText}>
            {
              intentionStrings.preferenceBubbles[
                preferenceBubble.kind
              ]
            }
          </Text>
        </View>
      )}
      <QueueStrip
        ref={queueStripRef}
        snapshot={snapshot}
        topInset={hudHeight}
        undoToast={undoToast}
        onInsertActivity={insertActivity}
        onStopCurrent={stopCurrent}
        onRemoveCard={removeCard}
        onMoveCard={moveCard}
        onUndo={undoLastRemove}
        onWhyLineOpened={observeWhyLine}
        onForecastChangeObserved={observeForecastChange}
        reducedMotion={reducedMotion}
        preferenceTags={preferenceTags}
        completedActivityIds={
          snapshot?.session.recap.completedActivityIds
        }
      />
      {snapshot !== null && (
        <FirstSessionUI
          ref={firstSessionRef}
          session={snapshot.session}
          presentationKey={loop}
          hudHeight={hudHeight}
          onChooseDecoration={chooseDecoration}
          onTakeWrinkleAction={takeWrinkleAction}
          onChooseGoalReward={chooseGoalReward}
          onRespondToLetter={respondToLetter}
          currentDay={snapshot.day}
          autonomy={autonomy}
          practicePoints100={Math.round(
            snapshot.practicePoints * 100,
          )}
          reducedMotion={reducedMotion}
          dailyIntentionPrompt={
            preferences.gameplay.dailyIntentionPrompt
          }
          canAddProtectedPractice={
            snapshot.queue.filter((card) => card.source === 'player')
              .length <= 8
          }
          onSelectIntention={selectIntention}
          onAddProtectedPractice={() => {
            addProtectedPractice();
          }}
          preferenceLabels={preferenceTags.map((tag) => tag.label)}
        />
      )}
      {fatalError !== null && (
        <View
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={styles.fatalOverlay}
          testID="simulation-fatal-error"
        >
          <View style={styles.fatalPanel}>
            <Text style={styles.fatalTitle}>
              {firstSessionStrings.fatal.title}
            </Text>
            <Text style={styles.fatalCopy}>
              {firstSessionStrings.fatal.body}
            </Text>
            <Text selectable style={styles.fatalDetail}>
              {fatalError}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.creamBase, alignItems: 'center' },
  preferenceBubble: {
    ...CHROME.bubble,
    alignItems: 'center',
    gap: 2,
    left: '50%',
    marginLeft: -96,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 70,
    width: 192,
    zIndex: 19,
  },
  // The tag is a short label, so it keeps the pixel face at the body step; the sentence
  // under it is prose and takes the sans caption.
  preferenceBubbleTag: {
    color: theme.color.leaf,
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixelBold,
  },
  preferenceBubbleText: {
    color: theme.color.ink,
    ...TYPE_SCALE.caption,
  },
  stage: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
  },
  fatalOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(36, 31, 46, 0.88)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  fatalPanel: {
    ...CHROME.panel,
    borderColor: theme.color.redShadow,
    borderBottomColor: theme.color.redShadow,
    maxWidth: 480,
    padding: 24,
    width: '100%',
  },
  fatalTitle: {
    color: theme.color.ink,
    ...TYPE_SCALE.heading,
    marginBottom: 12,
  },
  fatalCopy: {
    color: theme.color.woodShadow,
    fontSize: TYPE_SCALE.body.fontSize,
    lineHeight: 22,
  },
  fatalDetail: {
    color: theme.color.terracottaShadow,
    fontSize: TYPE_SCALE.body.fontSize,
    lineHeight: 18,
    marginTop: 12,
  },
});
