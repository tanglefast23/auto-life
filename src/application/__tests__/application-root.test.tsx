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
