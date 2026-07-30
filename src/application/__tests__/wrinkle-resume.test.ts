import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  deriveSimRules,
  newCareerState,
  type CareerPayload,
} from '../career-state';
import { GameLoop } from '../loop';

function loopFor(
  payload: CareerPayload,
  dealt: boolean[],
): GameLoop {
  return new GameLoop(
    payload,
    content,
    {
      onBoundary: (boundary) => {
        dealt.push(boundary.wrinkleDealt === true);
      },
    },
    {
      simRules: deriveSimRules(payload, content),
      simRulesForBoundary: (sim, game) =>
        deriveSimRules(
          { ...payload, sim, game },
          content,
        ),
    },
  );
}

test('a pending dealt wrinkle survives an exact save/resume without a second draw', () => {
  const rootSeed = 901;
  const prng = PrngStreams.create(rootSeed).serialize();
  const sim = newGameState(
    'baseline',
    content.rates,
    rootSeed,
    prng,
  );
  sim.clock.absoluteMinute = 1440 + 7 * 60;
  const career = newCareerState({
    rootSeed,
    sim,
    prng,
    careerId: 'wrinkle-resume',
  });
  const firstBoundaries: boolean[] = [];
  const first = loopFor(career.payload, firstBoundaries);

  first.runOneTick();
  const saved = first.exportCareerPayload(career.payload);
  const announced = saved.game.wrinkles.announced;
  const wrinkleCalls = saved.prng.streams.wrinkles.calls;

  expect(firstBoundaries).toEqual([true]);
  expect(announced?.day).toBe(2);
  expect(saved.game.wrinkles.dealt).toHaveLength(1);

  const resumedBoundaries: boolean[] = [];
  const resumed = loopFor(saved, resumedBoundaries);
  resumed.runOneTick();
  const afterResume = resumed.exportCareerPayload(saved);

  expect(resumedBoundaries).toEqual([false]);
  expect(afterResume.game.wrinkles.announced).toEqual(announced);
  expect(afterResume.game.wrinkles.dealt).toEqual(
    saved.game.wrinkles.dealt,
  );
  expect(afterResume.prng.streams.wrinkles.calls).toBe(wrinkleCalls);
});
