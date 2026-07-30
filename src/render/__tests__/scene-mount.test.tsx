/**
 * The React-mount hole (P3 follow-up).
 *
 * Adversarial pass 4's worst finding — `WorldScene`'s RAF effect listing `view` in its
 * dependency array, so it tore down and remounted 2–8 times a second and the walk cycle
 * never actually ran — was invisible to **every** test in the suite, because no test
 * mounted React. It also produced no console error, so pass 3's console read missed it.
 *
 * That instance is fixed. This file closes the *class*: the effect-lifetime invariant is
 * now asserted directly, so any future deps/wiring regression fails here instead of
 * shipping.
 *
 * Skia itself is mocked (the library ships `jestSetup.js` for exactly this), because the
 * question under test is React effect lifetime, not what Skia paints.
 */

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react') as typeof import('react');
  const passthrough = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(name, null, props.children as React.ReactNode);
  return {
    Atlas: passthrough('Atlas'),
    Group: passthrough('Group'),
    Path: passthrough('Path'),
    FilterMode: { Nearest: 0, Linear: 1 },
    MipmapMode: { None: 0, Nearest: 1 },
    rect: (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h }),
    Skia: {
      RSXform: (scos: number, ssin: number, tx: number, ty: number) => ({ scos, ssin, tx, ty, set: () => undefined }),
      Path: { Circle: () => ({}) },
    },
    // The scene only needs a non-null image to get past its loading guard.
    useImage: () => ({ __mockImage: true }),
    useRSXformBuffer: (_size: number, _mod: unknown) => ({ value: [] }),
    useRectBuffer: (_size: number, _mod: unknown) => ({ value: [] }),
  };
});

// Shared values are recorded in creation order so the test can observe what the scene
// actually writes each frame. WorldScene creates them as:
//   0 charX · 1 charY · 2 charSprite · 3 ringProgress · 4 ringX · 5 ringY
const sharedValues: { value: unknown }[] = [];
jest.mock('react-native-reanimated', () => {
  const React = require('react') as typeof import('react');
  return {
    // The scene only uses these two. Reanimated's real entry point boots its native
    // worklets module, which cannot initialise under a node test environment.
    //
    // `useRef` is load-bearing, not incidental: real `useSharedValue` returns the SAME
    // object across renders. A mock returning a fresh `{value}` each render makes the
    // scene's dependency array unstable and the effect remount every render — the mock
    // then manufactures exactly the bug under test. (It did; that is how this comment
    // came to exist.)
    useSharedValue: <T,>(initial: T) => {
      const ref = React.useRef<{ value: T } | null>(null);
      if (ref.current === null) {
        ref.current = { value: initial };
        (globalThis as { __sv?: unknown[] }).__sv?.push(ref.current);
      }
      return ref.current;
    },
    useDerivedValue: <T,>(fn: () => T) => ({ value: fn() }),
  };
});

import { act, create } from 'react-test-renderer';
import { WorldScene } from '../WorldScene';
import { GameLoop } from '../../application/loop';
import { newGameState } from '../../sim/state';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import type { RenderView } from '../../sim/render-view';

const fresh = () => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

/** Deterministic RAF: frames only advance when the test says so. */
function installFakeRaf() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let now = 0;
  let cancels = 0;

  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => {
    if (callbacks.delete(id)) cancels += 1;
  }) as typeof cancelAnimationFrame;

  return {
    /** Run one frame: exactly the callbacks queued right now. */
    frame(deltaMs = 16) {
      now += deltaMs;
      const due = [...callbacks.entries()];
      callbacks.clear();
      for (const [, cb] of due) cb(now);
      return due.length;
    },
    /** How many RAF callbacks are pending — one healthy loop keeps exactly one. */
    get pending() {
      return callbacks.size;
    },
    /**
     * How many times a pending loop was CANCELLED.
     *
     * This is the assertion that distinguishes the bug from correct behaviour, and the
     * first version of this test got it wrong: `pending` stays 1 either way, because an
     * effect remount cancels one callback and immediately queues another. Verified by
     * reintroducing the bug — the old test passed. Cancels only happen on cleanup, so a
     * healthy scene cancels exactly once, at unmount.
     */
    get cancels() {
      return cancels;
    },
  };
}

describe('WorldScene mounts and keeps exactly one animation loop', () => {
  const original = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  afterEach(() => {
    globalThis.requestAnimationFrame = original.raf;
    globalThis.cancelAnimationFrame = original.caf;
  });

  test('it renders without throwing', () => {
    const raf = installFakeRaf();
    const loop = new GameLoop(fresh(), content);
    const view = loop.snapshot!.render;
    let tree: ReturnType<typeof create> | null = null;
    act(() => {
      tree = create(<WorldScene view={view} alphaRef={() => 0} scale={1} effectiveSpeed={1} />);
    });
    expect(tree).not.toBeNull();
    expect(raf.pending).toBe(1); // exactly one loop running
    act(() => {
      tree!.unmount();
    });
  });

  test('REGRESSION: a new view every tick must NOT restart the RAF loop', () => {
    // The pass-4 bug in one assertion. `view` is a fresh object each tick; if it is in
    // the effect's deps, every re-render cancels and re-queues the loop, resetting the
    // walk phase and frame timestamp.
    const raf = installFakeRaf();
    const loop = new GameLoop(fresh(), content);

    let tree: ReturnType<typeof create> | null = null;
    act(() => {
      tree = create(<WorldScene view={loop.snapshot!.render} alphaRef={() => 0} scale={1} effectiveSpeed={1} />);
    });
    act(() => {
      raf.frame(16);
    });

    // Re-render 30 times with a genuinely new view object each time, as ticking does.
    for (let i = 0; i < 30; i++) {
      loop.runOneTick();
      act(() => {
        tree!.update(<WorldScene view={loop.snapshot!.render} alphaRef={() => 0} scale={1} effectiveSpeed={1} />);
      });
      act(() => {
        raf.frame(16);
      });
      expect(raf.pending).toBe(1);
    }

    // THE assertion: 30 re-renders with a new view each time must not have torn the loop
    // down even once. With `view` in the deps this reads 30.
    expect(raf.cancels).toBe(0);

    act(() => {
      tree!.unmount();
    });
    expect(raf.pending).toBe(0);
    expect(raf.cancels).toBe(1); // exactly one, at unmount
  });

  test('the walk cycle actually accumulates instead of restarting', () => {
    // The consequence of the pass-4 bug, asserted from the outside: with the effect
    // remounting, `phase` reset to 0 every tick and the sprite never reached frame 1.
    const raf = installFakeRaf();
    const loop = new GameLoop(fresh(), content);
    const captured: { value: unknown }[] = [];
    (globalThis as { __sv?: unknown[] }).__sv = captured;
    const sprites = new Set<number>();

    let tree: ReturnType<typeof create> | null = null;
    const travelling: RenderView = {
      ...loop.snapshot!.render,
      pose: 'walk',
      travel: { path: [{ x: 0, y: 0 }, { x: 6, y: 0 }], elapsedTicks: 0, totalTicks: 2 },
    };
    act(() => {
      tree = create(<WorldScene view={travelling} alphaRef={() => 0.5} scale={1} effectiveSpeed={1} />);
    });
    // Re-render with a fresh view each frame, exactly as ticking does.
    for (let i = 0; i < 60; i++) {
      act(() => {
        tree!.update(<WorldScene view={{ ...travelling }} alphaRef={() => 0.5} scale={1} effectiveSpeed={1} />);
      });
      act(() => {
        raf.frame(33);
      });
      const spriteIdx = captured[2]?.value;
      if (typeof spriteIdx === 'number') sprites.add(spriteIdx);
    }
    // 60 frames at 33 ms with WALK_CYCLES_PER_SECOND = 2 is ~4 full cycles, so BOTH walk
    // frames must have been selected. With the effect remounting every re-render, `phase`
    // resets to 0 each time and only frame 0 is ever chosen — this is the assertion that
    // proves the cycle genuinely accumulates.
    expect(sprites.size).toBeGreaterThan(1);
    expect(raf.cancels).toBe(0);
    expect(raf.pending).toBe(1);
    act(() => {
      tree!.unmount();
    });
  });

  test('changing speed or scale does not leak a second loop', () => {
    const raf = installFakeRaf();
    const loop = new GameLoop(fresh(), content);
    const view = loop.snapshot!.render;
    let tree: ReturnType<typeof create> | null = null;
    act(() => {
      tree = create(<WorldScene view={view} alphaRef={() => 0} scale={1} effectiveSpeed={1} />);
    });
    for (const [scale, speed] of [[1, 2], [1.5, 4], [2, 0], [1, 1]] as const) {
      act(() => {
        tree!.update(<WorldScene view={view} alphaRef={() => 0} scale={scale} effectiveSpeed={speed} />);
      });
      act(() => {
        raf.frame(16);
      });
      expect(raf.pending).toBe(1);
    }
    act(() => {
      tree!.unmount();
    });
    expect(raf.pending).toBe(0);
  });
});
