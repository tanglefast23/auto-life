import { create } from 'zustand';
import { GameLoop, type Speed } from './loop';
import { newGameState } from '../sim/state';
import { content } from '../sim/content';
import { PrngStreams } from '../sim/prng';
import type { SimSnapshot } from '../sim/step';

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

function createLoop(observer: (s: SimSnapshot) => void): GameLoop {
  const prng = PrngStreams.create(P3_SEED).serialize();
  const initial = newGameState('baseline', content.rates, P3_SEED, prng);
  return new GameLoop(initial, content, { onSnapshot: observer });
}

interface GameStore {
  snapshot: SimSnapshot | null;
  speed: Speed;
  /** Ticks the loop has run — lets evidence report "a full day was watched". */
  ticksRun: number;
  setSpeed: (speed: Speed) => void;
  setSystemPaused: (paused: boolean) => void;
  /** Progress through the current tick, 0..1, for interpolation. Read per frame. */
  alpha: () => number;
  loop: GameLoop;
}

export const useGameStore = create<GameStore>((set, get) => {
  const loop = createLoop((snapshot) => {
    set({ snapshot, ticksRun: loop.stats.ticksRun });
  });
  return {
    // Seeded from the loop so the first paint has a world (never a blank frame).
    snapshot: loop.snapshot,
    speed: 1,
    ticksRun: 0,
    loop,
    setSpeed: (speed) => {
      get().loop.setSpeed(speed);
      set({ speed });
    },
    setSystemPaused: (paused) => {
      get().loop.setSystemPaused(paused);
    },
    // The loop owns alpha now: it freezes the value on pause instead of snapping the
    // sim back to the start of its tick (adversarial pass 2).
    alpha: () => get().loop.alpha,
  };
});
