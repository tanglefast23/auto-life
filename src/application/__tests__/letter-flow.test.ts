import { content } from '../../sim/content';
import { TICKS_PER_DAY } from '../../sim/clock';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  newAppPreferencesEnvelope,
  newCareerState,
} from '../career-state';
import { useGameStore } from '../game-store';
import { GameLoop, type CompletedBoundary } from '../loop';

afterEach(() => {
  useGameStore.getState().clearHydratedCareer();
});

function pastDayTenCareer() {
  const seed = 991;
  const prng = PrngStreams.create(seed).serialize();
  const sim = newGameState(
    'baseline',
    content.rates,
    seed,
    content.perks,
  );
  sim.clock.absoluteMinute = 10 * TICKS_PER_DAY + 600;
  sim.practice.points100 = 30_000;
  return newCareerState({ rootSeed: seed, sim, prng });
}

test('a past-Day-10 load publishes one due decision before any tick', () => {
  const career = pastDayTenCareer();
  const first = new GameLoop(career.payload, content);

  expect(first.stats.ticksRun).toBe(0);
  expect(first.session.letter).toMatchObject({
    status: 'due',
    lastOfferedDay: 11,
  });
  expect(first.advance(60_000)).toBe(0);
  expect(first.stats.ticksRun).toBe(0);
  expect(first.runOneTick()).toBe(first.snapshot);
  expect(first.stats.ticksRun).toBe(0);

  const reloaded = new GameLoop(
    first.exportCareerPayload(career.payload),
    content,
  );
  expect(reloaded.session).toEqual(first.session);
  expect(reloaded.stats.ticksRun).toBe(0);
});

test('the store processes a letter answer while paused and emits a major boundary', () => {
  const career = pastDayTenCareer();
  const boundaries: CompletedBoundary[] = [];
  useGameStore.getState().hydrateCareer(
    career,
    newAppPreferencesEnvelope(),
    false,
    (boundary) => boundaries.push(boundary),
  );

  useGameStore.getState().setSpeed(0);
  useGameStore.getState().setSpeed(4);
  expect(useGameStore.getState().speed).toBe(0);

  useGameStore.getState().respondToLetter('accept');
  const state = useGameStore.getState();
  expect(state.ticksRun).toBe(1);
  expect(state.loop?.session.letter).toMatchObject({
    status: 'accepted',
    acceptedAtDay: 11,
    promisedStartDay: 12,
    preparedPerformerLevel: 2,
    preparedPerformerBonusPercent: 50,
  });
  expect(
    state.loop?.session.goals['holidays-over']?.status,
  ).toBe('rewarded');
  expect(boundaries).toHaveLength(1);
  expect(boundaries[0]?.actions).toEqual([
    { type: 'letterResponded', decision: 'accept' },
  ]);

  const saved = state.exportCareer();
  expect(saved?.payload.pendingGameActions).toEqual([]);
  expect(
    saved?.payload.game.letter.preparedPerformerBonusPercent,
  ).toBe(50);
});
