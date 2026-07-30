import engineV7 from '../__fixtures__/engine-v7-career.json';
import engineV6 from '../__fixtures__/engine-v6-career.json';
import { content } from '../../sim/content';
import {
  migrateLegacyCareerFixture,
  newAppPreferencesEnvelope,
} from '../career-state';
import { useGameStore } from '../game-store';

afterEach(() => {
  useGameStore.getState().clearHydratedCareer();
});

test('hydration publishes the restored mid-activity career before ticking', () => {
  const career = migrateLegacyCareerFixture(engineV7, content);
  career.payload.pendingCommands.push({
    type: 'insertPlayer',
    activityId: 'practice',
  });
  career.payload.pendingGameActions.push({
    type: 'forecastChangeObserved',
  });

  useGameStore.getState().hydrateCareer(
    career,
    newAppPreferencesEnvelope(),
    true,
  );
  const state = useGameStore.getState();
  expect(state.ticksRun).toBe(0);
  expect(state.loop?.effectiveSpeed).toBe(0);
  expect(state.loop?.peekState()).toEqual(career.payload.sim);
  expect(state.loop?.session).toEqual(career.payload.game);
  expect(state.loop?.pendingBoundaryWork).toEqual({
    commands: career.payload.pendingCommands,
    actions: career.payload.pendingGameActions,
  });
  expect(state.snapshot).toMatchObject({
    currentCardId: 'c0',
    session: career.payload.game,
  });

  state.advanceFrame(60_000);
  expect(useGameStore.getState().ticksRun).toBe(0);
  expect(state.loop?.peekState()).toEqual(career.payload.sim);
});

test('GameLoop reset returns to its complete injected career baseline', () => {
  const career = migrateLegacyCareerFixture(engineV7, content);
  useGameStore.getState().hydrateCareer(
    career,
    newAppPreferencesEnvelope(),
  );
  const loop = useGameStore.getState().loop!;
  loop.enqueueAction({ type: 'forecastChangeObserved' });
  loop.runOneTick();
  expect(loop.peekState()).not.toEqual(career.payload.sim);

  loop.reset();

  expect(loop.peekState()).toEqual(career.payload.sim);
  expect(loop.session).toEqual(career.payload.game);
  expect(loop.peekPrng()).toEqual(career.payload.prng);
  expect(loop.pendingBoundaryWork).toEqual({
    commands: career.payload.pendingCommands,
    actions: career.payload.pendingGameActions,
  });
});

test('hydration expires a removal receipt that has no restored Undo command', () => {
  const career = migrateLegacyCareerFixture(engineV6, content);
  expect(career.payload.sim.removalReceipt).not.toBeNull();
  career.payload.pendingCommands = [];
  useGameStore.getState().hydrateCareer(
    career,
    newAppPreferencesEnvelope(),
  );
  expect(
    useGameStore.getState().loop?.peekState().removalReceipt,
  ).toBeNull();
  expect(
    useGameStore.getState().exportCareer()?.payload.sim.removalReceipt,
  ).toBeNull();
});
