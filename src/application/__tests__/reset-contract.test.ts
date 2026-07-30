import { newSession } from '../../game/session';
import { content, objectForActivity } from '../../sim/content';
import { dayNumber } from '../../sim/clock';
import { toFixed } from '../../sim/fixed';
import { PrngStreams } from '../../sim/prng';
import { newGameState, type SimState } from '../../sim/state';
import { GameLoop } from '../loop';

const ROOT_SEED = 1234;

function justBeforePackage(): SimState {
  const state = newGameState(
    'baseline',
    content.rates,
    ROOT_SEED,
    PrngStreams.create(ROOT_SEED).serialize(),
  );
  state.clock.absoluteMinute = 599;
  state.bars = {
    energy: toFixed(80),
    nutrition: toFixed(80),
    movement: toFixed(80),
    hygiene: toFixed(80),
  };
  const [x, y] = objectForActivity('package').interactPoint;
  state.position = { x, y };
  const today = dayNumber(state.clock.absoluteMinute);
  for (const anchor of content.anchors.anchors) {
    state.anchorsConsumedOnDay[anchor.id] = today;
  }
  return state;
}

test('the final P4 reset contract restores every deterministic and presentation layer', () => {
  const initial = justBeforePackage();
  const baseline = new GameLoop(initial, content);
  const loop = new GameLoop(initial, content);

  for (let i = 0; i < 90 && loop.session.wrinkles.choiceReadyId === null; i++) {
    loop.runOneTick();
  }
  expect(loop.session.wrinkles.choiceReadyId).toBe('package-delivery');
  loop.enqueueAction({
    type: 'decorationChosen',
    wrinkleId: 'package-delivery',
    decorationId: 'sunny-vase',
  });
  loop.runOneTick();
  expect(loop.session.decorations.grantedIds).toEqual(['sunny-vase']);

  loop.setSpeed(4);
  loop.advance(5_000);
  expect(loop.stats.droppedFrames).toBeGreaterThan(0);
  loop.notifyCommitmentsChanged();
  expect(loop.snapshot.forecastRevision).toBeGreaterThan(1);

  loop.enqueue({ type: 'insertPlayer', activityId: 'practice' });
  loop.enqueue({ type: 'insertPlayer', activityId: 'stretch' });
  loop.runOneTick();
  const removable = loop
    .peekState()
    .queue.find((card) => card.id !== loop.peekState().current?.cardId);
  if (removable === undefined) throw new Error('no upcoming card to remove');
  loop.enqueue({ type: 'removeCard', cardId: removable.id });
  loop.runOneTick();
  expect(loop.undoToast).not.toBeNull();
  expect(loop.peekState().removalReceipt).not.toBeNull();

  loop.advance(63);
  expect(loop.alpha).toBeGreaterThan(0);
  loop.setSystemPaused(true);
  expect(loop.effectiveSpeed).toBe(0);

  // Neither item may leak across reset into the first post-reset tick.
  loop.enqueue({ type: 'insertPlayer', activityId: 'snack' });
  loop.enqueueAction({ type: 'forecastChangeObserved' });

  const resetSnapshot = loop.reset();

  expect(loop.peekState()).toEqual(initial);
  expect(loop.session).toEqual(newSession());
  expect(loop.stats).toEqual({
    ticksRun: 0,
    droppedFrames: 0,
    accumulatorMs: 0,
  });
  expect(loop.speed).toBe(1);
  expect(loop.effectiveSpeed).toBe(1);
  expect(loop.alpha).toBe(0);
  expect(loop.undoToast).toBeNull();
  expect(loop.sleepSkipIdleMs).toBe(0);
  expect(resetSnapshot).toEqual(baseline.snapshot);
  expect(resetSnapshot.forecastRevision).toBe(1);

  loop.runOneTick();
  expect(
    loop.peekState().queue.some((card) => card.activityId === 'snack'),
  ).toBe(false);
  expect(loop.session.observations.forecastChangeObserved).toBe(false);
});
