import { useGameStore } from '../game-store';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  newAppPreferencesEnvelope,
  newCareerState,
} from '../career-state';
import type { GameLoop } from '../loop';

describe('simulation faults', () => {
  let loop: GameLoop;

  beforeEach(() => {
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
    loop = useGameStore.getState().loop!;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    loop.reset();
    loop.setSpeed(1);
    useGameStore.setState({
      fatalError: null,
      speed: 1,
      snapshot: loop.snapshot,
      ticksRun: 0,
    });
    useGameStore.getState().clearHydratedCareer();
  });

  test('an escaped loop error parks the sim and publishes one visible fault', () => {
    const error = new Error('synthetic tick failure');
    const advance = jest
      .spyOn(loop, 'advance')
      .mockImplementation(() => {
        throw error;
      });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      useGameStore.getState().advanceFrame(500),
    ).not.toThrow();

    expect(useGameStore.getState()).toMatchObject({
      speed: 0,
      fatalError: 'synthetic tick failure',
    });
    expect(loop.speed).toBe(0);
    expect(console.error).toHaveBeenCalledWith(
      'Simulation paused after an error.',
      error,
    );

    useGameStore.getState().advanceFrame(500);
    expect(advance).toHaveBeenCalledTimes(1);

    useGameStore.getState().setSpeed(4);
    expect(useGameStore.getState().speed).toBe(0);
    expect(loop.speed).toBe(0);
  });
});
