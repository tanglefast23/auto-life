import { createHash } from 'node:crypto';
import { GameLoop } from '../loop';
import { content, objectForActivity } from '../../sim/content';
import { dayNumber, minuteOfDay, targetsFor } from '../../sim/clock';
import { toDisplay, toFixed } from '../../sim/fixed';
import { PrngStreams } from '../../sim/prng';
import type { QueueCard } from '../../sim/queue';
import { newGameState, type SimState } from '../../sim/state';
import { step, type Command } from '../../sim/step';
import { ENGINE_VERSION } from '../../sim/version';
import type { GameAction } from '../../game/tick';

const ROOT_SEED = 1234;
const round2 = (value: number) => Math.round(value * 100) / 100;

type ReplayEntry =
  | {
      atMinute: number;
      kind: 'command';
      value: Command;
    }
  | {
      atMinute: number;
      kind: 'action';
      value: GameAction;
    };

function fresh(): SimState {
  return newGameState(
    'baseline',
    content.rates,
    ROOT_SEED,
    PrngStreams.create(ROOT_SEED).serialize(),
  );
}

function runScriptedPlayerReplay() {
  const loop = new GameLoop(
    fresh(),
    content,
    {},
    { sleepSkipEnabled: false },
  );
  const script: ReplayEntry[] = [];
  const enqueue = (...commands: Command[]) => {
    const atMinute = loop.peekState().clock.absoluteMinute;
    for (const command of commands) {
      loop.enqueue(command);
      script.push({ atMinute, kind: 'command', value: command });
    }
  };
  const enqueueAction = (action: GameAction) => {
    const atMinute = loop.peekState().clock.absoluteMinute;
    loop.enqueueAction(action);
    script.push({ atMinute, kind: 'action', value: action });
  };

  // Fixed Day-1 pressure: duplicate identity, object-click insertion, and a real
  // wake-block member that will be moved (therefore pinned) on the next tick.
  enqueue(
    { type: 'insertPlayer', activityId: 'practice' },
    { type: 'insertPlayer', activityId: 'practice' },
    { type: 'objectClick', activityId: 'shower' },
  );
  loop.runOneTick();

  const playerPractices = loop.peekState().queue.filter(
    (card) =>
      card.activityId === 'practice' &&
      card.source === 'player',
  );
  expect(playerPractices).toHaveLength(2);
  const stoppedPracticeId = playerPractices[0]!.id;
  const keptPracticeId = playerPractices[1]!.id;
  expect(stoppedPracticeId).not.toBe(keptPracticeId);

  const movedAutoId = loop.peekState().queue.find(
    (card) => card.owner === 'AUTO',
  )?.id;
  expect(movedAutoId).toBeDefined();
  enqueue(
    { type: 'moveCard', cardId: movedAutoId!, toIndex: 0 },
    { type: 'stopCurrent' },
  );
  enqueueAction({
    type: 'whyLineOpened',
    cardId: keptPracticeId,
  });
  enqueueAction({ type: 'forecastChangeObserved' });
  loop.runOneTick();

  expect(
    loop.peekState().queue.find((card) => card.id === movedAutoId),
  ).toMatchObject({ owner: 'PINNED', source: 'anchor' });
  expect(
    loop.peekState().queue.some((card) => card.id === stoppedPracticeId),
  ).toBe(false);
  expect(
    loop.peekState().queue.some((card) => card.id === keptPracticeId),
  ).toBe(true);

  const playerShowerId = loop.peekState().queue.find(
    (card) =>
      card.activityId === 'shower' &&
      card.source === 'player',
  )?.id;
  expect(playerShowerId).toBeDefined();
  enqueue({ type: 'removeCard', cardId: playerShowerId! });
  loop.runOneTick();
  const receiptId = loop.undoToast?.receiptId;
  expect(receiptId).toBeDefined();
  expect(
    loop.peekState().queue.some((card) => card.id === playerShowerId),
  ).toBe(false);

  script.push({
    atMinute: loop.peekState().clock.absoluteMinute,
    kind: 'command',
    value: { type: 'undoLastRemove', receiptId: receiptId! },
  });
  expect(loop.undoLastRemove(receiptId!)).toBe(true);
  loop.runOneTick();
  expect(
    loop.peekState().queue.some((card) => card.id === playerShowerId),
  ).toBe(true);

  // Touching an existing activity through its object promotes that exact card;
  // it does not replace either member of the duplicate-card pair.
  enqueue({ type: 'objectClick', activityId: 'shower' });
  loop.runOneTick();
  expect(
    loop.peekState().queue.filter(
      (card) =>
        card.activityId === 'shower' &&
        card.source === 'player',
    ),
  ).toEqual([
    expect.objectContaining({
      id: playerShowerId,
      owner: 'PINNED',
    }),
  ]);

  const suppressedAuto = loop.peekState().queue.find(
    (card) =>
      card.owner === 'AUTO' &&
      card.id !== loop.peekState().current?.cardId,
  );
  expect(suppressedAuto).toBeDefined();
  enqueue({ type: 'removeCard', cardId: suppressedAuto!.id });
  loop.runOneTick();
  expect(
    loop.peekState().suppression[suppressedAuto!.activityId],
  ).toBeGreaterThan(loop.peekState().clock.absoluteMinute);

  // No more schedule edits until this card starts: the cached forecast must name
  // the exact start minute taken by the real top-level tick path.
  const predictedStart = loop.snapshot.queue.find(
    (card) => card.id === keptPracticeId,
  )?.forecast.predictedStartMinute;
  expect(predictedStart).not.toBeNull();
  expect(predictedStart).toBeDefined();
  let actualStart: number | null = null;
  for (let i = 0; i < 720 && actualStart === null; i++) {
    const atMinute = loop.peekState().clock.absoluteMinute;
    loop.runOneTick();
    const current = loop.peekState().current;
    if (
      current?.type === 'activity' &&
      current.cardId === keptPracticeId
    ) {
      actualStart = minuteOfDay(atMinute);
    }
  }
  expect(actualStart).toBe(predictedStart);

  // Continue the same replay through the first wake. The game-owned package
  // command and the serializable reward action now live in the same golden as
  // the queue edits above.
  const nextWake =
    1440 + targetsFor('baseline', content.rates).wake;
  let packageChoiceQueued = false;
  while (loop.peekState().clock.absoluteMinute < nextWake) {
    if (
      !packageChoiceQueued &&
      loop.session.wrinkles.choiceReadyId === 'package-delivery'
    ) {
      enqueueAction({
        type: 'decorationChosen',
        wrinkleId: 'package-delivery',
        decorationId: 'leafy-plant',
      });
      packageChoiceQueued = true;
    }
    loop.runOneTick();
  }

  const fullState = {
    sim: loop.peekState(),
    game: loop.session,
  };
  const fullStateSha256 = createHash('sha256')
    .update(JSON.stringify(fullState))
    .digest('hex');

  return {
    engineVersion: ENGINE_VERSION,
    seed: ROOT_SEED,
    chronotype: 'baseline',
    script,
    forecastAgreement: {
      cardId: keptPracticeId,
      predictedStart,
      actualStart,
    },
    digest: {
      fullStateSha256,
      clock: loop.peekState().clock.absoluteMinute,
      bars: Object.fromEntries(
        Object.entries(loop.peekState().bars).map(([bar, value]) => [
          bar,
          round2(toDisplay(value)),
        ]),
      ),
      queue: loop.peekState().queue.map((card) => ({
        id: card.id,
        activityId: card.activityId,
        owner: card.owner,
        source: card.source,
      })),
      suppression: loop.peekState().suppression,
      session: loop.session,
    },
  };
}

test('scripted player golden covers the P4 command surface and full sim plus game state', () => {
  const replay = runScriptedPlayerReplay();

  expect(replay.engineVersion).toBe(6);
  expect(replay.digest.session.goals['meet-you']?.status).toBe('complete');
  expect(replay.digest.session.goals['change-of-plans']?.status).toBe(
    'complete',
  );
  expect(replay.digest.session.wrinkles.resolvedIds).toContain(
    'package-delivery',
  );
  expect(replay.digest.session.decorations.grantedIds).toEqual(
    expect.arrayContaining(['goal-plant', 'leafy-plant']),
  );
  expect(replay.digest.session.morningRecap).not.toBeNull();
  expect(replay).toMatchSnapshot();
});

test('the scripted player replay is byte-deterministic across full sim and game state', () => {
  const first = runScriptedPlayerReplay();
  const second = runScriptedPlayerReplay();

  expect(second.digest.fullStateSha256).toBe(
    first.digest.fullStateSha256,
  );
  expect(second).toEqual(first);
});

function preparedState(): SimState {
  const state = fresh();
  state.clock.absoluteMinute = 480;
  state.bars = {
    energy: toFixed(80),
    nutrition: toFixed(80),
    movement: toFixed(80),
    hygiene: toFixed(80),
  };
  const today = dayNumber(state.clock.absoluteMinute);
  for (const anchor of content.anchors.anchors) {
    state.anchorsConsumedOnDay[anchor.id] = today;
  }
  return state;
}

function at(activityId: string): { x: number; y: number } {
  const [x, y] = objectForActivity(activityId).interactPoint;
  return { x, y };
}

function card(
  id: string,
  activityId: string,
): QueueCard {
  return {
    id,
    activityId,
    owner: 'PINNED',
    urgent: false,
    source: 'player',
    enqueuedTick: 0,
  };
}

function startedDuration(
  lastActivityId: string,
  lastWasWorkout: boolean,
): number {
  const state = preparedState();
  state.position = at('shower');
  state.lastCompletion = {
    activityId: lastActivityId,
    isWorkout: lastWasWorkout,
    atMinute: state.clock.absoluteMinute - 10,
  };
  state.queue = [card('shower-card', 'shower')];
  const next = step(state, [], content).next.current;
  if (next?.type !== 'activity') throw new Error('shower did not start');
  return next.dto.durationTicks;
}

function movementAfterWorkout(lastActivityId: string): number {
  const state = preparedState();
  state.position = at('weights');
  state.lastCompletion = {
    activityId: lastActivityId,
    isWorkout: false,
    atMinute: state.clock.absoluteMinute - 10,
  };
  state.queue = [card('weights-card', 'weights')];
  return step(state, [], content).next.bars.movement;
}

function practiceMultiplier({
  lastActivityId,
  mintyArmed = false,
}: {
  lastActivityId: string | null;
  mintyArmed?: boolean;
}): number {
  const state = preparedState();
  state.position = at('practice');
  state.practice.mintyArmed = mintyArmed;
  state.lastCompletion =
    lastActivityId === null
      ? null
      : {
          activityId: lastActivityId,
          isWorkout: false,
          atMinute: state.clock.absoluteMinute - 10,
        };
  state.queue = [card('practice-card', 'practice')];
  const next = step(state, [], content).next.current;
  if (next?.type !== 'activity') throw new Error('practice did not start');
  return next.dto.sampled.pointsMultiplier ?? 1;
}

test('all four P4-owned adjacency pairs deliver a nonzero real engine effect', () => {
  const effects = {
    'warmed-up':
      startedDuration('toilet', false) -
      startedDuration('weights', true),
    cramp:
      movementAfterWorkout('snack') -
      movementAfterWorkout('meal'),
    'minty-fresh':
      practiceMultiplier({ lastActivityId: null, mintyArmed: true }) -
      practiceMultiplier({ lastActivityId: null }),
    'fresh-mind':
      practiceMultiplier({ lastActivityId: 'shower' }) -
      practiceMultiplier({ lastActivityId: 'toilet' }),
  };

  expect(effects).toEqual({
    'warmed-up': expect.any(Number),
    cramp: expect.any(Number),
    'minty-fresh': expect.any(Number),
    'fresh-mind': expect.any(Number),
  });
  for (const effect of Object.values(effects)) {
    expect(effect).toBeGreaterThan(0);
  }
});
