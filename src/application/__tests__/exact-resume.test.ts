import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  canonicalCareerPayload,
  deriveSimRules,
  newCareerState,
} from '../career-state';
import { GameLoop } from '../loop';

function loopFor(
  career: ReturnType<typeof newCareerState>,
): GameLoop {
  return new GameLoop(
    career.payload,
    content,
    {},
    {
      simRules: deriveSimRules(career.payload, content),
      simRulesForBoundary: (sim, game) =>
        deriveSimRules(
          { ...career.payload, sim, game },
          content,
        ),
    },
  );
}

test('a complete mid-activity checkpoint resumes byte-identically', () => {
  const seed = 6060;
  const prng = PrngStreams.create(seed).serialize();
  const career = newCareerState({
    rootSeed: seed,
    sim: newGameState('baseline', content.rates, seed, prng),
    prng,
  });
  const uninterrupted = loopFor(career);
  for (let tick = 0; tick < 30; tick += 1) {
    uninterrupted.runOneTick();
  }
  expect(uninterrupted.peekState().current).not.toBeNull();
  uninterrupted.enqueue({
    type: 'insertPlayer',
    activityId: 'practice',
  });
  uninterrupted.enqueueAction({ type: 'forecastChangeObserved' });

  const checkpoint = {
    ...career,
    payload: uninterrupted.exportCareerPayload(career.payload),
  };
  const resumed = loopFor(checkpoint);
  expect(resumed.peekState()).toEqual(uninterrupted.peekState());
  expect(resumed.session).toEqual(uninterrupted.session);
  expect(resumed.pendingBoundaryWork).toEqual(
    uninterrupted.pendingBoundaryWork,
  );

  uninterrupted.runOneTick();
  resumed.runOneTick();
  const controlPayload = uninterrupted.exportCareerPayload(
    career.payload,
  );
  const resumedPayload = resumed.exportCareerPayload(
    checkpoint.payload,
  );
  expect(canonicalCareerPayload(resumedPayload)).toBe(
    canonicalCareerPayload(controlPayload),
  );
});
