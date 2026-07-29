import { GameLoop, msPerTick } from '../../application/loop';
import { newGameState } from '../../sim/state';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { interpolateTravel } from '../../sim/render-view';

/**
 * Regressions for adversarial pass 2 (codex, gpt-5.6-sol at max reasoning).
 * Every test below is a defect that existed.
 */

const fresh = () => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

/** Advance until the predicate holds; returns the snapshot at that tick. */
function until(loop: GameLoop, pred: (s: ReturnType<GameLoop['runOneTick']>) => boolean, max = 60) {
  for (let i = 0; i < max; i++) {
    const s = loop.runOneTick();
    if (pred(s)) return s;
  }
  throw new Error('predicate never held');
}

describe('BLOCKER: the renderer sees every tick of every journey', () => {
  test('the first frame of a journey starts where the sim actually is', () => {
    // Was: the renderer only ever saw elapsedTicks >= 1, so a journey's first drawn
    // frame was already two tiles along — the sim teleported before interpolating.
    const loop = new GameLoop(fresh(), content);
    const first = until(loop, (s) => s.processed === 'travel');
    expect(first.render.travel).not.toBeNull();
    expect(first.render.travel!.elapsedTicks).toBe(0);
    const at0 = interpolateTravel(first.render.travel!, 0);
    expect(at0).toEqual({ x: 4, y: 2 }); // the bed — initial-state position
  });

  test('the arrival tick still carries travel data', () => {
    // Was: on arrival `current` had already become the next activity, so travel was
    // null and the final leg teleported.
    const loop = new GameLoop(fresh(), content);
    const seen: (number | null)[] = [];
    for (let i = 0; i < 12; i++) {
      const s = loop.runOneTick();
      if (s.processed === 'travel') seen.push(s.render.travel?.elapsedTicks ?? null);
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).not.toContain(null); // every processed travel tick has data
  });

  test('a one-tick journey is interpolated, not teleported', () => {
    // Was: toilet -> sink reported processed:'travel' with travel:null — 100% teleport.
    const loop = new GameLoop(fresh(), content);
    let found: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
    for (let i = 0; i < 40; i++) {
      const s = loop.runOneTick();
      const t = s.render.travel;
      if (s.processed === 'travel' && t !== null && t.totalTicks === 1) {
        found = { from: interpolateTravel(t, 0), to: interpolateTravel(t, 1) };
        break;
      }
    }
    expect(found).not.toBeNull();
    expect(found!.from).not.toEqual(found!.to); // it actually moves across the tick
  });

  test('journeys chain continuously — no gap between consecutive ticks', () => {
    const loop = new GameLoop(fresh(), content);
    let prevEnd: { x: number; y: number } | null = null;
    for (let i = 0; i < 12; i++) {
      const s = loop.runOneTick();
      const t = s.render.travel;
      if (t === null) {
        prevEnd = null;
        continue;
      }
      const start = interpolateTravel(t, 0);
      if (prevEnd !== null) {
        expect(start.x).toBeCloseTo(prevEnd.x, 6);
        expect(start.y).toBeCloseTo(prevEnd.y, 6);
      }
      prevEnd = interpolateTravel(t, 1);
    }
  });
});

describe('MAJOR: the snapshot never aliases simulation truth (master §4)', () => {
  test('mutating the published travel path leaves sim state untouched', () => {
    // Was: `travel.path` was the live array inside SimState. `readonly` is compile-time
    // only, so touching snapshot.render.travel.path[0] mutated the running game.
    const loop = new GameLoop(fresh(), content);
    const snap = until(loop, (s) => s.render.travel !== null);
    const before = JSON.stringify(loop.peekState().current);
    (snap.render.travel!.path as { x: number; y: number }[])[0]!.x = 999;
    expect(JSON.stringify(loop.peekState().current)).toBe(before);
  });
});

describe('BLOCKER: pause and speed changes do not lose or invent time', () => {
  test('setSpeed to the SAME speed is a no-op, so mashing a button cannot stall the clock', () => {
    // Was: setSpeed always zeroed the accumulator, so repeatedly pressing the active
    // speed reset partial progress forever and the clock never advanced.
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(1);
    for (let i = 0; i < 20; i++) {
      loop.advance(100); // 100ms — never a whole tick on its own
      loop.setSpeed(1); // the UI calls this on every press
    }
    expect(loop.stats.ticksRun).toBeGreaterThan(0);
  });

  test('a speed change carries partial progress instead of discarding it', () => {
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(1);
    loop.advance(400); // 80% of a 500ms tick
    loop.setSpeed(2); // 250ms per tick — 80% of that is 200ms
    expect(loop.alpha).toBeCloseTo(0.8, 6);
  });

  test('pausing freezes the interpolation alpha instead of snapping to zero', () => {
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(1);
    loop.advance(400);
    const held = loop.alpha;
    expect(held).toBeCloseTo(0.8, 6);
    loop.setSystemPaused(true);
    expect(loop.alpha).toBeCloseTo(held, 6);
  });

  test('alpha stays within [0,1] at every speed', () => {
    for (const speed of [1, 2, 4] as const) {
      const loop = new GameLoop(fresh(), content);
      loop.setSpeed(speed);
      for (let i = 0; i < 50; i++) {
        loop.advance(msPerTick(speed) * 0.37);
        expect(loop.alpha).toBeGreaterThanOrEqual(0);
        expect(loop.alpha).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('speed-independence still holds after the pass-2 changes', () => {
  test('a day at 1×, 2× and 4× produces identical state', () => {
    const digests = ([1, 2, 4] as const).map((speed) => {
      const loop = new GameLoop(fresh(), content);
      loop.setSpeed(speed);
      for (let i = 0; i < 1440; i++) loop.advance(msPerTick(speed));
      expect(loop.stats.ticksRun).toBe(1440);
      return JSON.stringify(loop.peekState());
    });
    expect(digests[1]).toBe(digests[0]);
    expect(digests[2]).toBe(digests[0]);
  });
});
