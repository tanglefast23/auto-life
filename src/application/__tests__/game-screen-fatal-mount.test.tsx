jest.mock('@shopify/react-native-skia', () => {
  const React = require('react') as typeof import('react');
  return {
    Canvas: (props: { children?: React.ReactNode }) =>
      React.createElement('Canvas', null, props.children),
  };
});

jest.mock('../../render/WorldScene', () => ({
  WorldScene: () => null,
}));

jest.mock('../../ui/Hud', () => ({
  Hud: () => null,
}));

jest.mock('../../ui/accessibility', () => ({
  useReducedMotionPreference: () => true,
}));

jest.mock('../../ui/QueueStrip', () => {
  const React = require('react') as typeof import('react');
  return { QueueStrip: React.forwardRef(() => null) };
});

jest.mock('../../ui/WorldInteractions', () => {
  const React = require('react') as typeof import('react');
  return { WorldInteractions: React.forwardRef(() => null) };
});

jest.mock('../../ui/FirstSessionUI', () => {
  const React = require('react') as typeof import('react');
  return { FirstSessionUI: React.forwardRef(() => null) };
});

import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { GameScreen } from '../GameScreen';
import { useGameStore } from '../game-store';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  newAppPreferencesEnvelope,
  newCareerState,
} from '../career-state';

describe('GameScreen fatal recovery surface', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
    const prng = PrngStreams.create(1234).serialize();
    useGameStore.getState().hydrateCareer(
      newCareerState({
        rootSeed: 1234,
        sim: newGameState(
          'baseline',
          content.rates,
          1234,
          prng,
        ),
        prng,
      }),
      newAppPreferencesEnvelope(),
    );
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
    useGameStore.setState({ fatalError: null });
    useGameStore.getState().clearHydratedCareer();
  });

  test('shows reviewed recovery copy and the diagnostic after a parked fault', () => {
    useGameStore.setState({ fatalError: 'synthetic tick failure' });

    let tree: ReturnType<typeof create> | null = null;
    act(() => {
      tree = create(<GameScreen />);
    });

    const alert = tree!.root.findByProps({
      testID: 'simulation-fatal-error',
    });
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('assertive');

    const copy = tree!.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat()
      .join(' ');
    expect(copy).toContain('The clock stopped');
    expect(copy).toContain('Reload the game to try again.');
    expect(copy).toContain('synthetic tick failure');

    act(() => tree!.unmount());
  });
});
