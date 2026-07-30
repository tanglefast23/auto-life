import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useGameStore } from './game-store';
import { WorldScene } from '../render/WorldScene';
import { solveScale, HUD_H, QUEUE_H } from '../render/scale';
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

/**
 * P3's screen: the composition root's view (master §4).
 *
 * Drives the loop from a single requestAnimationFrame, hard-pauses on backgrounding
 * (SPEC §5, C1), and lays the world out per §11.5's desktop scaling rule.
 *
 * P4 adds the semantic queue dock beneath the world. Persistence remains later work.
 */
export function GameScreen() {
  const snapshot = useGameStore((s) => s.snapshot);
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const togglePause = useGameStore((s) => s.togglePause);
  const setSystemPaused = useGameStore((s) => s.setSystemPaused);
  const loop = useGameStore((s) => s.loop);
  const alpha = useGameStore((s) => s.alpha);
  const undoToast = useGameStore((s) => s.undoToast);
  const insertActivity = useGameStore((s) => s.insertActivity);
  const stopCurrent = useGameStore((s) => s.stopCurrent);
  const removeCard = useGameStore((s) => s.removeCard);
  const moveCard = useGameStore((s) => s.moveCard);
  const undoLastRemove = useGameStore((s) => s.undoLastRemove);
  const observeWhyLine = useGameStore((s) => s.observeWhyLine);
  const observeForecastChange = useGameStore((s) => s.observeForecastChange);
  const chooseDecoration = useGameStore((s) => s.chooseDecoration);

  const { width, height, fontScale } = useWindowDimensions();
  const dpr = typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1;
  const hudTextScale = Math.max(1, Math.min(2, Number.isFinite(fontScale) ? fontScale : 1));
  const hudHeight = HUD_H * hudTextScale;
  const fit = useMemo(
    () => solveScale({ width, height, devicePixelRatio: dpr, hudHeight }),
    [width, height, dpr, hudHeight],
  );
  const reducedMotion = useReducedMotionPreference();
  const queueStripRef = useRef<QueueStripHandle>(null);
  const worldInteractionsRef = useRef<WorldInteractionsHandle>(null);
  const firstSessionRef = useRef<FirstSessionUIHandle>(null);

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
      // Hidden-time presentation effects are elapsed once, in the visibility
      // handler. Ignore any throttled RAF callbacks so that interval cannot be
      // counted here and then counted again on resume.
      if (frameClock.current.hiddenAt === null) {
        const prev = frameClock.current.last;
        frameClock.current.last = now;
        loop.advance(prev === null ? 0 : now - prev);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [loop]);

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

  return (
    <View style={styles.root} onTouchStart={() => loop.notePlayerInput()}>
      <View style={[styles.stage, { height: fit.available.height, marginTop: hudHeight, marginBottom: QUEUE_H }]}>
        <View style={{ width: fit.width, height: fit.height }}>
          <Canvas style={StyleSheet.absoluteFill}>
            {view !== null && (
              <WorldScene
                view={view}
                decorationIds={snapshot?.session.decorations.grantedIds}
                alphaRef={alpha}
                scale={fit.scale}
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
        reducedMotion={reducedMotion}
      />
      <QueueStrip
        ref={queueStripRef}
        snapshot={snapshot}
        undoToast={undoToast}
        onInsertActivity={insertActivity}
        onStopCurrent={stopCurrent}
        onRemoveCard={removeCard}
        onMoveCard={moveCard}
        onUndo={undoLastRemove}
        onWhyLineOpened={observeWhyLine}
        onForecastChangeObserved={observeForecastChange}
        reducedMotion={reducedMotion}
      />
      {snapshot !== null && (
        <FirstSessionUI
          ref={firstSessionRef}
          session={snapshot.session}
          hudHeight={hudHeight}
          onChooseDecoration={chooseDecoration}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2e2119', alignItems: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center' },
});
