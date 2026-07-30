import { GameLoop } from '../loop';
import { content, objectForActivity } from '../../sim/content';
import { dayNumber, TICKS_PER_DAY } from '../../sim/clock';
import { toFixed } from '../../sim/fixed';
import { PrngStreams } from '../../sim/prng';
import { newGameState, type SimState } from '../../sim/state';

const ROOT_SEED = 1234;

function fresh(): SimState {
  return newGameState(
    'baseline',
    content.rates,
    ROOT_SEED,
    PrngStreams.create(ROOT_SEED).serialize(),
  );
}

function justBeforePackage(): SimState {
  const state = fresh();
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

test('the scripted Day-1 package fires once at 10:00 through the top-level tick', () => {
  const loop = new GameLoop(justBeforePackage(), content);

  loop.runOneTick(); // 09:59 → 10:00
  expect(loop.session.wrinkles.firedIds).toEqual([]);

  loop.runOneTick(); // 10:00 tick: game pre-sim command enters the real queue
  expect(loop.session.wrinkles).toMatchObject({
    firedIds: ['package-delivery'],
    pendingId: 'package-delivery',
  });
  expect(
    loop.peekState().queue.find((card) => card.activityId === 'package'),
  ).toMatchObject({
    urgent: true,
    source: 'wrinkle',
    reason: { kind: 'wrinkle', wrinkleId: 'package-delivery' },
  });

  for (let i = 0; i < 60 && loop.session.wrinkles.choiceReadyId === null; i++) {
    loop.runOneTick();
  }
  expect(loop.session.wrinkles.choiceReadyId).toBe('package-delivery');
  expect(
    loop.session.recap.completedActivityIds.filter(
      (activityId) => activityId === 'package',
    ),
  ).toHaveLength(1);

  for (let i = 0; i < 60; i++) loop.runOneTick();
  expect(loop.session.wrinkles.firedIds).toEqual(['package-delivery']);
});

test('choosing either package reward grants it for the run and reset removes it', () => {
  const loop = new GameLoop(justBeforePackage(), content);
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
  expect(loop.snapshot.session.decorations.grantedIds).toEqual(['sunny-vase']);
  expect(loop.session.wrinkles.pendingId).toBeNull();
  expect(loop.session.wrinkles.resolvedIds).toEqual(['package-delivery']);

  loop.reset();
  expect(loop.session.decorations.grantedIds).toEqual([]);
  expect(loop.snapshot.session.decorations.grantedIds).toEqual([]);
  expect(loop.session.wrinkles.firedIds).toEqual([]);
});

test('a scripted first day completes both goals, keeps the chosen decoration, and reaches the recap', () => {
  const loop = new GameLoop(
    fresh(),
    content,
    {},
    { sleepSkipEnabled: false },
  );

  // Goal 2's deliberate edit goes through the same command path as the live palette.
  loop.enqueue({ type: 'insertPlayer', activityId: 'practice' });
  loop.runOneTick();
  const whyCardId =
    loop.peekState().current?.cardId ??
    loop.peekState().queue[0]?.id;
  expect(whyCardId).toBeDefined();

  // These are UI observations, intentionally replayed as serializable game actions.
  loop.enqueueAction({
    type: 'whyLineOpened',
    cardId: whyCardId!,
  });
  loop.enqueueAction({ type: 'forecastChangeObserved' });
  loop.runOneTick();
  expect(loop.session.goals['change-of-plans']?.status).toBe('complete');

  let rewardQueued = false;
  for (let i = 2; i < TICKS_PER_DAY; i++) {
    if (
      !rewardQueued &&
      loop.session.wrinkles.choiceReadyId === 'package-delivery'
    ) {
      loop.enqueueAction({
        type: 'decorationChosen',
        wrinkleId: 'package-delivery',
        decorationId: 'sunny-vase',
      });
      rewardQueued = true;
    }
    loop.runOneTick();
  }

  expect(loop.session.goals['meet-you']?.status).toBe('complete');
  expect(loop.session.goals['change-of-plans']?.status).toBe('complete');
  expect(loop.session.unlocks.journal).toBe(true);
  expect(loop.session.decorations.grantedIds).toEqual(
    expect.arrayContaining(['goal-plant', 'sunny-vase']),
  );
  expect(loop.snapshot.session.decorations).toEqual(
    loop.session.decorations,
  );
  expect(loop.session.wrinkles.resolvedIds).toContain('package-delivery');
  expect(loop.session.morningRecap).toMatchObject({
    forDay: 1,
  });
  expect(
    loop.session.morningRecap?.completedActivityIds.length,
  ).toBeGreaterThanOrEqual(3);
});

test('filling free time with Practice materially cuts Day-1 idle minutes', () => {
  const idleMinutes = (practiceCards: number): number => {
    const loop = new GameLoop(
      fresh(),
      content,
      {},
      { sleepSkipEnabled: false },
    );
    for (let i = 0; i < practiceCards; i++) {
      loop.enqueue({ type: 'insertPlayer', activityId: 'practice' });
    }
    let idle = 0;
    for (let i = 0; i < TICKS_PER_DAY; i++) {
      if (loop.runOneTick().processed === 'idle') idle += 1;
    }
    return idle;
  };

  const unattended = idleMinutes(0);
  const playerFilled = idleMinutes(10);

  // Measured on the frozen seed: 722 → 286. Keep this as a meaningful reduction
  // rather than pinning tuning to exact minute counts that P4.5 may legitimately move.
  expect(playerFilled).toBeLessThan(unattended * 0.7);
});
