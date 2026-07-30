import { create } from 'zustand';
import { GameLoop, type Speed, type UndoToast } from './loop';
import { newGameState } from '../sim/state';
import { content } from '../sim/content';
import { PrngStreams } from '../sim/prng';
import type { GameSnapshot } from './snapshot';

/**
 * The UI's view of the game (SPEC §3: "UI mirrors sim snapshots; sim owns truth").
 *
 * The `GameLoop` lives OUTSIDE the store. Zustand holds only the latest snapshot and
 * the chosen speed, so React re-renders at snapshot rate — at most 8 per second at 4× —
 * rather than at frame rate. Sub-tick motion is read straight off the loop by the
 * renderer's animation frame and never travels through React state.
 */

/** Fixed seed for P3. Identity setup and a real seed arrive in P5. */
const P3_SEED = 1234;

function createLoop(
  observer: (s: GameSnapshot) => void,
  onUndoToast: (toast: UndoToast | null) => void,
): GameLoop {
  const prng = PrngStreams.create(P3_SEED).serialize();
  const initial = newGameState('baseline', content.rates, P3_SEED, prng);
  return new GameLoop(initial, content, { onSnapshot: observer, onUndoToast });
}

interface GameStore {
  snapshot: GameSnapshot | null;
  speed: Speed;
  /** Ticks the loop has run — lets evidence report "a full day was watched". */
  ticksRun: number;
  undoToast: UndoToast | null;
  setSpeed: (speed: Speed) => void;
  togglePause: () => void;
  setSystemPaused: (paused: boolean) => void;
  insertActivity: (activityId: string) => void;
  stopCurrent: () => void;
  removeCard: (cardId: string) => void;
  moveCard: (cardId: string, toIndex: number) => void;
  undoLastRemove: (receiptId: string) => boolean;
  observeWhyLine: (cardId: string) => void;
  observeForecastChange: () => void;
  chooseDecoration: (
    decorationId: 'leafy-plant' | 'sunny-vase',
  ) => void;
  /** Progress through the current tick, 0..1, for interpolation. Read per frame. */
  alpha: () => number;
  loop: GameLoop;
}

export const useGameStore = create<GameStore>((set, get) => {
  let resumeSpeed: Exclude<Speed, 0> = 1;
  const loop = createLoop((snapshot) => {
    set({ snapshot, ticksRun: loop.stats.ticksRun });
  }, (undoToast) => {
    set({ undoToast });
  });
  return {
    // Seeded from the loop so the first paint has a world (never a blank frame).
    snapshot: loop.snapshot,
    speed: 1,
    ticksRun: 0,
    undoToast: null,
    loop,
    setSpeed: (speed) => {
      if (speed !== 0) resumeSpeed = speed;
      get().loop.setSpeed(speed);
      set({ speed });
    },
    togglePause: () => {
      const current = get().speed;
      const next = current === 0 ? resumeSpeed : 0;
      if (current !== 0) resumeSpeed = current;
      get().loop.setSpeed(next);
      set({ speed: next });
    },
    setSystemPaused: (paused) => {
      get().loop.setSystemPaused(paused);
    },
    insertActivity: (activityId) => {
      get().loop.enqueue({ type: 'insertPlayer', activityId });
    },
    stopCurrent: () => {
      get().loop.enqueue({ type: 'stopCurrent' });
    },
    removeCard: (cardId) => {
      get().loop.enqueue({ type: 'removeCard', cardId });
    },
    moveCard: (cardId, toIndex) => {
      get().loop.enqueue({ type: 'moveCard', cardId, toIndex });
    },
    undoLastRemove: (receiptId) => get().loop.undoLastRemove(receiptId),
    observeWhyLine: (cardId) => {
      get().loop.enqueueAction({ type: 'whyLineOpened', cardId });
    },
    observeForecastChange: () => {
      get().loop.enqueueAction({ type: 'forecastChangeObserved' });
    },
    chooseDecoration: (decorationId) => {
      get().loop.enqueueAction({
        type: 'decorationChosen',
        wrinkleId: 'package-delivery',
        decorationId,
      });
    },
    // The loop owns alpha now: it freezes the value on pause instead of snapping the
    // sim back to the start of its tick (adversarial pass 2).
    alpha: () => get().loop.alpha,
  };
});
