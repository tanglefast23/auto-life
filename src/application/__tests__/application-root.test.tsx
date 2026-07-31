const mockValues = new Map<string, string>();
const mockListeners = new Set<
  (key: string, value: string | null) => void
>();
let mockFailNextSet = false;

// ApplicationRoot owns the real audio bus, but these composition tests exercise boot,
// save, and screen transitions. Keep Expo's native module outside that boundary.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    loop: false,
    playing: false,
    volume: 1,
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
  }),
}));

jest.mock('../../persistence/kv', () => ({
  kv: {
    getItem: async (key: string) => mockValues.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (mockFailNextSet) {
        mockFailNextSet = false;
        throw new Error('synthetic storage failure');
      }
      mockValues.set(key, value);
      for (const listener of mockListeners) listener(key, value);
    },
    removeItem: async (key: string) => {
      mockValues.delete(key);
      for (const listener of mockListeners) listener(key, null);
    },
    subscribe: (
      listener: (key: string, value: string | null) => void,
    ) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));

jest.mock('../GameScreen', () => {
  const React = require('react') as typeof import('react');
  return {
    GameScreen: (props: Record<string, unknown>) =>
      React.createElement('GameScreen', {
        ...props,
        testID: 'mounted-game-screen',
      }),
  };
});

import { act, create } from 'react-test-renderer';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import { ApplicationRoot } from '../ApplicationRoot';
import {
  APP_PREFERENCES_KEY,
  CAREER_GENERATION_KEYS,
} from '../career-repository';
import {
  newCareerState,
} from '../career-state';
import { useGameStore } from '../game-store';
import { FixedSeedSource } from '../new-career';

async function flushEffects(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
}

describe('ApplicationRoot boot composition', () => {
  beforeEach(() => {
    mockValues.clear();
    mockListeners.clear();
    mockFailNextSet = false;
    useGameStore.getState().clearHydratedCareer();
  });

  afterEach(() => {
    useGameStore.getState().clearHydratedCareer();
  });

  test('a fresh install cannot construct the loop before identity is finished', async () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot />);
    });
    expect(useGameStore.getState().loop).toBeNull();

    await flushEffects();
    expect(
      tree.root.findByProps({ testID: 'title-screen' }),
    ).toBeDefined();
    expect(useGameStore.getState().loop).toBeNull();

    act(() => {
      tree.root
        .findByProps({ testID: 'title-new-game' })
        .props.onPress();
    });
    expect(
      tree.root.findByProps({ testID: 'identity-screen' }),
    ).toBeDefined();
    expect(useGameStore.getState().loop).toBeNull();

    act(() => {
      tree.root.findByProps({ testID: 'identity-skip' }).props.onPress();
    });
    await flushEffects();

    expect(
      tree.root.findByProps({ testID: 'mounted-game-screen' }),
    ).toBeDefined();
    expect(useGameStore.getState().loop).not.toBeNull();
    expect(useGameStore.getState().ticksRun).toBe(0);
    expect(
      CAREER_GENERATION_KEYS.some((key) => mockValues.has(key)),
    ).toBe(true);
    act(() => tree.unmount());
  });

  test('playtest mode resets through New Game to the same recorded seed', async () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ApplicationRoot seedSource={new FixedSeedSource(1234)} />,
      );
    });
    await flushEffects();
    act(() => {
      tree.root
        .findByProps({ testID: 'title-new-game' })
        .props.onPress();
    });
    act(() => {
      tree.root.findByProps({ testID: 'identity-skip' }).props.onPress();
    });
    await flushEffects();
    const first = useGameStore.getState().exportCareer()!;
    expect(first.payload.rootSeed).toBe(1234);

    act(() => {
      tree.root
        .findByProps({ testID: 'mounted-game-screen' })
        .props.onOpenPause();
    });
    act(() => {
      tree.root.findByProps({ testID: 'pause-new-game' }).props.onPress();
    });
    act(() => {
      tree.root
        .findByProps({ testID: 'confirm-new-game' })
        .props.onPress();
    });
    act(() => {
      tree.root.findByProps({ testID: 'identity-skip' }).props.onPress();
    });
    await flushEffects();

    const reset = useGameStore.getState().exportCareer()!;
    expect(reset.payload.rootSeed).toBe(1234);
    expect(reset.payload).toEqual(first.payload);
    expect(reset.resetFence).toBe(first.resetFence + 1);
    act(() => tree.unmount());
  });

  test('New Game identity can return to the same live career before saving', async () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ApplicationRoot seedSource={new FixedSeedSource(1234)} />,
      );
    });
    await flushEffects();
    act(() => {
      tree.root
        .findByProps({ testID: 'title-new-game' })
        .props.onPress();
    });
    act(() => {
      tree.root.findByProps({ testID: 'identity-skip' }).props.onPress();
    });
    await flushEffects();

    const loop = useGameStore.getState().loop;
    const careerId = useGameStore.getState().exportCareer()?.careerId;
    act(() => {
      tree.root
        .findByProps({ testID: 'mounted-game-screen' })
        .props.onOpenPause();
    });
    act(() => {
      tree.root.findByProps({ testID: 'pause-new-game' }).props.onPress();
    });
    act(() => {
      tree.root
        .findByProps({ testID: 'confirm-new-game' })
        .props.onPress();
    });

    expect(
      tree.root.findByProps({ testID: 'identity-screen' }),
    ).toBeDefined();
    expect(useGameStore.getState().loop).toBe(loop);
    act(() => {
      tree.root.findByProps({ testID: 'identity-back' }).props.onPress();
    });

    expect(
      tree.root.findByProps({ testID: 'mounted-game-screen' }),
    ).toBeDefined();
    expect(useGameStore.getState().loop).toBe(loop);
    expect(useGameStore.getState().exportCareer()?.careerId).toBe(
      careerId,
    );
    expect(loop?.effectiveSpeed).toBe(1);
    act(() => tree.unmount());
  });

  test('a returning career publishes its restored frame without away-time ticks', async () => {
    const seed = 1776;
    const prng = PrngStreams.create(seed).serialize();
    const career = newCareerState({
      rootSeed: seed,
      sim: newGameState('baseline', content.rates, seed, prng),
      prng,
    });
    mockValues.set(
      CAREER_GENERATION_KEYS[0],
      JSON.stringify({
        ...career,
        generation: 0,
        savedAtEpochMs: 100,
        writerId: 'previous-session',
      }),
    );

    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot />);
    });
    await flushEffects();

    expect(
      tree.root.findByProps({ testID: 'mounted-game-screen' }),
    ).toBeDefined();
    expect(useGameStore.getState().ticksRun).toBe(0);
    expect(useGameStore.getState().loop?.peekState()).toEqual(
      career.payload.sim,
    );
    expect(
      tree.root.findByProps({ testID: 'resume-notice' }),
    ).toBeDefined();
    act(() => tree.unmount());
  });

  test('corrupt data opens recovery without constructing a loop', async () => {
    mockValues.set(CAREER_GENERATION_KEYS[0], '{broken');
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot />);
    });
    await flushEffects();

    expect(
      tree.root.findByProps({ testID: 'career-recovery' }),
    ).toBeDefined();
    expect(useGameStore.getState().loop).toBeNull();
    act(() => tree.unmount());
  });

  test('pause freezes tick alpha and global settings do not rewrite the career', async () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot />);
    });
    await flushEffects();
    act(() => {
      tree.root
        .findByProps({ testID: 'title-new-game' })
        .props.onPress();
    });
    act(() => {
      tree.root.findByProps({ testID: 'identity-skip' }).props.onPress();
    });
    await flushEffects();

    const loop = useGameStore.getState().loop!;
    loop.advance(250);
    const alpha = loop.alpha;
    const generationsBefore = CAREER_GENERATION_KEYS.filter((key) =>
      mockValues.has(key),
    ).length;
    act(() => {
      tree.root
        .findByProps({ testID: 'mounted-game-screen' })
        .props.onOpenPause();
    });
    expect(loop.effectiveSpeed).toBe(0);
    expect(loop.alpha).toBe(alpha);
    expect(
      tree.root.findByProps({ testID: 'pause-menu' }),
    ).toBeDefined();
    act(() => {
      tree.root.findByProps({ testID: 'pause-resume' }).props.onPress();
    });
    expect(loop.effectiveSpeed).toBe(1);
    expect(loop.alpha).toBe(alpha);

    act(() => {
      tree.root
        .findByProps({ testID: 'mounted-game-screen' })
        .props.onToggleMute();
    });
    await flushEffects();
    expect(
      JSON.parse(mockValues.get(APP_PREFERENCES_KEY)!)
        .preferences.audio.muted,
    ).toBe(true);
    expect(
      CAREER_GENERATION_KEYS.filter((key) => mockValues.has(key)),
    ).toHaveLength(generationsBefore);
    act(() => tree.unmount());
  });

  test('Return to Title saves first and can resume the same career', async () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot />);
    });
    await flushEffects();
    act(() => {
      tree.root
        .findByProps({ testID: 'title-new-game' })
        .props.onPress();
    });
    act(() => {
      tree.root.findByProps({ testID: 'identity-skip' }).props.onPress();
    });
    await flushEffects();
    const careerId = useGameStore.getState().exportCareer()!.careerId;
    act(() => {
      tree.root
        .findByProps({ testID: 'mounted-game-screen' })
        .props.onOpenPause();
    });
    act(() => {
      tree.root
        .findByProps({ testID: 'pause-return-title' })
        .props.onPress();
    });
    await flushEffects();

    expect(
      tree.root.findByProps({ testID: 'title-screen' }),
    ).toBeDefined();
    expect(useGameStore.getState().loop).toBeNull();
    act(() => {
      tree.root.findByProps({ testID: 'title-resume' }).props.onPress();
    });
    await flushEffects();
    expect(useGameStore.getState().exportCareer()?.careerId).toBe(
      careerId,
    );
    expect(useGameStore.getState().ticksRun).toBe(0);
    act(() => tree.unmount());
  });

  test('Return to Title stays in game when the durability write fails', async () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot />);
    });
    await flushEffects();
    act(() => {
      tree.root
        .findByProps({ testID: 'title-new-game' })
        .props.onPress();
    });
    act(() => {
      tree.root.findByProps({ testID: 'identity-skip' }).props.onPress();
    });
    await flushEffects();
    act(() => {
      tree.root
        .findByProps({ testID: 'mounted-game-screen' })
        .props.onOpenPause();
    });
    mockFailNextSet = true;
    act(() => {
      tree.root
        .findByProps({ testID: 'pause-return-title' })
        .props.onPress();
    });
    await flushEffects();

    expect(
      tree.root.findByProps({ testID: 'pause-menu' }),
    ).toBeDefined();
    expect(
      tree.root.findAllByProps({ testID: 'title-screen' }),
    ).toHaveLength(0);
    expect(useGameStore.getState().loop).not.toBeNull();
    act(() => tree.unmount());
  });
});

/**
 * The audio wire, end to end (P6 audit).
 *
 * Every audio unit test passed while the game was completely silent, because router and bus
 * were only ever tested against each other: `ApplicationRoot` constructed a `CueRouter` and
 * referenced it nowhere, and nothing in any suite mounted the composition root and listened.
 * These tests are that missing listener — they boot the real component and assert that a
 * player would hear something.
 */
describe('ApplicationRoot drives the cue router', () => {
  /** A bus that only records. Structural, so the root treats it as cue-capable. */
  class RecordingBus {
    readonly calls: string[] = [];
    private readonly live = new Set<string>();
    muted = false;

    apply(): void {}
    playLoop(key: string, cue: { assetId: string }): void {
      if (this.live.has(key)) return;
      this.live.add(key);
      this.calls.push(`loop:${key}:${cue.assetId}`);
    }
    playCue(key: string, cue: { assetId: string }): void {
      this.calls.push(`cue:${key}:${cue.assetId}`);
    }
    stop(key: string): void {
      this.calls.push(`stop:${key}`);
    }
    remove(key: string): void {
      this.live.delete(key);
      this.calls.push(`remove:${key}`);
    }
    has(key: string): boolean {
      return this.live.has(key);
    }
    fadeTo(key: string, target: number): void {
      this.calls.push(`fade:${key}:${target}`);
    }
  }

  function seedCareer(seed: number): void {
    const prng = PrngStreams.create(seed).serialize();
    const career = newCareerState({
      rootSeed: seed,
      sim: newGameState('baseline', content.rates, seed, prng),
      prng,
    });
    mockValues.set(
      CAREER_GENERATION_KEYS[0],
      JSON.stringify({
        ...career,
        generation: 0,
        savedAtEpochMs: 100,
        writerId: 'previous-session',
      }),
    );
  }

  beforeEach(() => {
    mockValues.clear();
    mockListeners.clear();
    useGameStore.getState().clearHydratedCareer();
  });

  afterEach(() => {
    useGameStore.getState().clearHydratedCareer();
  });

  test('a booted career starts the music bed and the room ambience', async () => {
    const bus = new RecordingBus();
    seedCareer(4242);

    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot audioBus={bus} />);
    });
    await flushEffects();
    // One minute of watched play — the boundary is what feeds the router.
    act(() => {
      useGameStore.getState().loop?.runOneTick();
    });

    // The single assertion this whole audit turns on: the game makes a sound.
    expect(bus.calls).not.toEqual([]);
    // Keyed by asset, not by variant: day and evening share one authored track, so the
    // voice key is derived from the asset id rather than the word "day".
    expect(bus.calls).toContainEqual(
      `loop:music.bed.${content.audio.music.day.assetId}:${content.audio.music.day.assetId}`,
    );
    expect(bus.calls).toContainEqual(
      `loop:ambience.room:${content.audio.ambience.room.assetId}`,
    );
    act(() => tree.unmount());
  });

  test('a bus with no cue surface is left alone, so the silent stub still works', async () => {
    // `SilentAudioBus` is what most suites inject; it must stay a valid thing to hand in.
    const silent = { apply: () => undefined, muted: false };
    seedCareer(4243);

    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot audioBus={silent} />);
    });
    await flushEffects();
    act(() => {
      useGameStore.getState().loop?.runOneTick();
    });

    expect(
      tree.root.findByProps({ testID: 'mounted-game-screen' }),
    ).toBeDefined();
    act(() => tree.unmount());
  });

  test('a restored career replays its pending work silently', async () => {
    // P5 restores by replaying pending boundary work. Without the hydration guard a reload
    // fires a day of completion cues at once — the loudest possible way to greet someone
    // reopening a tab. The bed is continuous state and is expected; one-shots are not.
    const bus = new RecordingBus();
    seedCareer(4244);

    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ApplicationRoot audioBus={bus} />);
    });
    await flushEffects();
    act(() => {
      useGameStore.getState().loop?.runOneTick();
    });

    expect(bus.calls.filter((call) => call.startsWith('cue:'))).toEqual([]);
    act(() => tree.unmount());
  });
});
