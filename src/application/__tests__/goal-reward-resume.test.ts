import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  canonicalCareerPayload,
  deriveSimRules,
  newCareerState,
  type CareerPayload,
} from '../career-state';
import { GameLoop } from '../loop';

function loopFor(payload: CareerPayload): GameLoop {
  return new GameLoop(
    payload,
    content,
    {},
    {
      simRules: deriveSimRules(payload, content),
      simRulesForBoundary: (sim, game) =>
        deriveSimRules({ ...payload, sim, game }, content),
    },
  );
}

test('a Practice threshold in the live loop grants Goal 4 exactly once', () => {
  const seed = 711;
  const prng = PrngStreams.create(seed).serialize();
  const sim = newGameState(
    'baseline',
    content.rates,
    seed,
    content.perks,
  );
  sim.practice.points100 = 10_000;
  const career = newCareerState({ rootSeed: seed, sim, prng });
  const loop = loopFor(career.payload);

  loop.runOneTick();
  loop.runOneTick();

  expect(loop.session.goals['first-chord']).toEqual({
    status: 'rewarded',
    counters: { practiceLevel: 1 },
  });
  expect(
    loop.session.recap.rewardIds.filter(
      (id) => id === 'air-guitar',
    ),
  ).toHaveLength(1);
});

test('a pending Goal 3 choice resumes on the same complete boundary', () => {
  const seed = 712;
  const prng = PrngStreams.create(seed).serialize();
  const sim = newGameState(
    'baseline',
    content.rates,
    seed,
    content.perks,
  );
  const game = newCareerState({
    rootSeed: seed,
    sim,
    prng,
  }).payload.game;
  game.goals['handle-the-wrinkle'] = {
    status: 'complete',
    counters: { resolvedDaysWithoutUrgent: 1 },
  };
  const career = newCareerState({
    rootSeed: seed,
    sim,
    prng,
    game,
  });
  const control = loopFor(career.payload);
  control.enqueueAction({
    type: 'goalRewardChosen',
    goalId: 'handle-the-wrinkle',
    choiceId: 'wrinkle-keepsake',
  });
  const checkpoint = control.exportCareerPayload(career.payload);
  const resumed = loopFor(checkpoint);

  control.runOneTick();
  resumed.runOneTick();

  expect(
    canonicalCareerPayload(
      resumed.exportCareerPayload(checkpoint),
    ),
  ).toBe(
    canonicalCareerPayload(
      control.exportCareerPayload(career.payload),
    ),
  );
  expect(resumed.session.decorations.grantedIds).toEqual([
    'wrinkle-keepsake',
  ]);
  expect(
    resumed.session.recap.rewardIds.filter(
      (id) => id === 'wrinkle-decoration',
    ),
  ).toHaveLength(1);
});
