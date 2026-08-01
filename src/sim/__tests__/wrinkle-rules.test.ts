import { deriveSimRules, newCareerState } from '../../application/career-state';
import { advanceGame } from '../../game/tick';
import { newSession, type SessionState } from '../../game/session';
import {
  content,
  objectForActivityIn,
} from '../content';
import { toFixed } from '../fixed';
import { forecast } from '../forecast';
import { PrngStreams } from '../prng';
import {
  cardStartDecision,
  step,
  type DomainEvent,
} from '../step';
import { restoreSimRules } from '../rules';
import {
  newGameState,
  type SimState,
} from '../state';

const DAY_TWO = 2;
const BASE_WAKE = 7 * 60;
const DAY_TWO_START = 1440;

function sessionFor(
  wrinkleId: string,
  parameters: Record<string, string | number | boolean> = {},
): SessionState {
  const wrinkle = content.wrinkles.entries.find(
    (entry) => entry.id === wrinkleId,
  )!;
  const variant = wrinkle.variants[0]!;
  const session = newSession();
  session.wrinkles = {
    ...session.wrinkles,
    firedIds: [wrinkleId],
    pendingId: wrinkleId,
    choiceReadyId: wrinkleId,
    dealt: [
      {
        day: DAY_TWO,
        wrinkleId,
        variantId: variant.id,
        resolved: false,
      },
    ],
    announced: {
      day: DAY_TWO,
      wrinkleId,
      variantId: variant.id,
      parameters,
    },
  };
  session.recap.forDay = DAY_TWO;
  return session;
}

function freshState(minute: number): SimState {
  const state = newGameState(
    'baseline',
    content.rates,
    81,
    content.perks,
  );
  state.clock.absoluteMinute = minute;
  state.queue = [];
  state.current = null;
  return state;
}

function rulesFor(
  state: SimState,
  session: SessionState,
) {
  const prng = PrngStreams.create(81).serialize();
  const career = newCareerState({
    rootSeed: 81,
    sim: state,
    game: session,
    prng,
    careerId: 'wrinkle-rule-test',
  });
  return deriveSimRules(career.payload, content);
}

function playerCard(
  activityId: string,
  urgent = false,
): SimState['queue'][number] {
  return {
    id: `card-${activityId}`,
    activityId,
    owner: 'PINNED',
    urgent,
    source: 'player',
    enqueuedTick: DAY_TWO_START,
  };
}

function reactiveHygieneCard(): SimState['queue'][number] {
  return {
    id: 'urgent-shower',
    activityId: 'shower',
    owner: 'AUTO',
    urgent: true,
    source: 'reactive',
    reason: {
      kind: 'reactiveTrigger',
      bar: 'hygiene',
      threshold: 30,
      atMinute: DAY_TWO_START,
    },
    enqueuedTick: DAY_TWO_START,
  };
}

function placeAtActivity(
  state: SimState,
  activityId: string,
): void {
  const object = objectForActivityIn(content, activityId);
  state.position = {
    x: object.interactPoint[0],
    y: object.interactPoint[1],
  };
}

test('visitor insertion interrupts idle but never crosses a PINNED busy card', () => {
  const idle = freshState(DAY_TWO_START + BASE_WAKE + 30);
  const idleResult = step(
    idle,
    [
      {
        type: 'insertWrinkle',
        wrinkleId: 'package-delivery',
        activityId: 'package',
      },
    ],
    content,
  );
  expect(idleResult.outcomes[0]).toMatchObject({
    type: 'insertWrinkle',
    status: 'accepted',
    disposition: 'started',
  });

  const busy = freshState(DAY_TWO_START + BASE_WAKE + 30);
  placeAtActivity(busy, 'practice');
  const started = step(
    busy,
    [{ type: 'insertPlayer', activityId: 'practice' }],
    content,
  ).next;
  const busyResult = step(
    started,
    [
      {
        type: 'insertWrinkle',
        wrinkleId: 'package-delivery',
        activityId: 'package',
      },
    ],
    content,
  );
  expect(busyResult.next.current?.cardId).toBe('c0');
  const busyQueue = busyResult.next.queue;
  const visitor = busyQueue.find(
    (card) => card.source === 'wrinkle',
  );
  expect(busyQueue[0]?.owner).toBe('PINNED');
  expect(busyQueue.indexOf(visitor!)).toBeGreaterThan(0);
  expect(visitor).toMatchObject({
    source: 'wrinkle',
    urgent: true,
  });
});

test('a blocked Shower waits in place; urgent Hygiene reroutes only to reachable Quick wash', () => {
  const minute = DAY_TWO_START + BASE_WAKE + 60;
  const waiting = freshState(minute);
  waiting.queue = [playerCard('shower')];
  placeAtActivity(waiting, 'shower');
  const rules = rulesFor(waiting, sessionFor('repair-visit'));
  const waited = step(waiting, [], content, rules);

  expect(waited.next.current).toBeNull();
  expect(waited.next.queue[0]).toEqual(waiting.queue[0]);
  expect(
    cardStartDecision(waiting, waiting.queue[0]!, content, rules),
  ).toMatchObject({
    kind: 'wait',
    reason: 'object-blocked',
  });
  expect(
    forecast(waiting, content, rules).annotations.find(
      (annotation) => annotation.cardId === 'card-shower',
    )?.startConstraint,
  ).toMatchObject({
    kind: 'wait',
    reason: 'object-blocked',
    targetId: 'shower',
  });

  const urgent = freshState(minute);
  urgent.bars.hygiene = toFixed(10);
  urgent.queue = [reactiveHygieneCard()];
  placeAtActivity(urgent, 'shower');
  const rerouted = step(urgent, [], content, rules);
  expect(
    rerouted.next.queue.find(
      (card) => card.id === 'urgent-shower',
    ),
  ).toMatchObject({
    id: 'urgent-shower',
    activityId: 'quickwash',
  });

  const showerObject = objectForActivityIn(content, 'shower');
  const quickwashObject = objectForActivityIn(content, 'quickwash');
  const unreachableRules = restoreSimRules({
    ...rules,
    objectBlocks: [
      ...rules.objectBlocks,
      {
        source: {
          wrinkleId: 'repair-visit',
          variantId: 'repair-bathroom',
          day: DAY_TWO,
        },
        objectId: quickwashObject.id,
        startsAtMinute: minute - 1,
        endsAtMinute: minute + 60,
        fallbackActivityId: 'quickwash',
      },
    ],
  });
  expect(showerObject.id).not.toBe(quickwashObject.id);
  expect(
    cardStartDecision(
      urgent,
      urgent.queue[0]!,
      content,
      unreachableRules,
    ),
  ).toMatchObject({
    kind: 'wait',
    reason: 'object-blocked',
  });
});

test('favorite show shifts only the dinner anchor to its selected target', () => {
  const minute = DAY_TWO_START + BASE_WAKE + 660;
  const state = freshState(minute);
  state.bars.nutrition = toFixed(40);
  placeAtActivity(state, 'meal');
  const session = sessionFor('favorite-show', {
    targetAtWakeOffset: 660,
  });
  const result = step(
    state,
    [],
    content,
    rulesFor(state, session),
  );
  const dinner = result.next.queue.find(
    (card) => card.blockId === 'dinner#2',
  );

  expect(dinner?.reason).toEqual({
    kind: 'anchorWindow',
    anchorId: 'dinner',
    targetMinute: minute,
  });
  const action = advanceGame(
    session,
    [],
    [
      {
        type: 'wrinkleAction',
        wrinkleId: 'favorite-show',
        actionId: 'move-dinner',
      },
    ],
    [],
    {
      day: 2,
      absoluteMinute: minute,
      minuteOfDay: minute % 1440,
      isMidnight: false,
      isMorningCheck: false,
      bars: {
        energy: 75,
        nutrition: 40,
        movement: 70,
        hygiene: 70,
      },
      currentActivityId: null,
      urgentCount: 0,
    },
    content,
  ).session;
  expect(action.wrinkles.dealt[0]?.resolved).toBe(true);
});

test('headache doubles workout time until a completed Nap clears it', () => {
  const minute = DAY_TWO_START + BASE_WAKE + 180;
  const state = freshState(minute);
  state.queue = [playerCard('weights')];
  placeAtActivity(state, 'weights');
  const normal = step(state, [], content);
  const session = sessionFor('headache-day');
  const slowed = step(
    state,
    [],
    content,
    rulesFor(state, session),
  );
  const normalDuration =
    normal.next.current?.type === 'activity'
      ? normal.next.current.dto.durationTicks
      : 0;
  const slowedDuration =
    slowed.next.current?.type === 'activity'
      ? slowed.next.current.dto.durationTicks
      : 0;
  expect(slowedDuration).toBe(normalDuration * 2);

  const cleared = advanceGame(
    session,
    [
      {
        type: 'activityCompleted',
        detail: 'nap',
        atMinute: minute,
      },
    ],
    [],
    [],
    undefined,
    content,
  ).session;
  expect(cleared.wrinkles.resolvedIds).toContain('headache-day');
  expect(cleared.wrinkles.announced?.parameters.cleared).toBe(true);
  expect(
    rulesFor(state, cleared).activitySlowdowns,
  ).toEqual([]);
});

test('slept great wakes 30 minutes early at full Energy without shifting the wake anchor', () => {
  const state = freshState(DAY_TWO_START + BASE_WAKE - 31);
  state.bars.energy = toFixed(20);
  state.queue = [
    {
      ...playerCard('sleep'),
      id: 'sleep-card',
    },
  ];
  state.current = {
    type: 'sleep',
    cardId: 'sleep-card',
  };
  const rules = rulesFor(state, sessionFor('slept-great'));
  const woke = step(state, [], content, rules);

  expect(woke.events).toContainEqual({
    type: 'wakeBoundary',
    detail: '2',
    atMinute: DAY_TWO_START + BASE_WAKE - 31,
  });
  expect(woke.snapshot.bars.energy).toBe(100);
  expect(woke.next.current).toBeNull();

  const spareMinute = step(woke.next, [], content, rules);
  expect(
    spareMinute.next.queue.some(
      (card) => card.blockId === 'wake#2',
    ),
  ).toBe(false);
});

test('burned breakfast gives only +10 Nutrition and does not start the meal gate', () => {
  const minute = DAY_TWO_START + BASE_WAKE + 1;
  let state = freshState(minute);
  state.queue = [playerCard('meal')];
  placeAtActivity(state, 'meal');
  const session = sessionFor('burned-breakfast');
  const rules = rulesFor(state, session);
  let result = step(state, [], content, rules);
  expect(result.next.current?.type).toBe('activity');
  if (result.next.current?.type !== 'activity') {
    throw new Error('meal did not start');
  }
  expect(result.next.current.dto.effectTotalsFixed.nutrition).toBe(
    toFixed(10),
  );

  const events: DomainEvent[] = [...result.events];
  state = result.next;
  while (
    !events.some((event) => event.type === 'activityCompleted')
  ) {
    result = step(state, [], content, rules);
    state = result.next;
    events.push(...result.events);
  }
  // docs/08: the burned meal is still graded — the wrinkle says what was cooked, the roll
  // says how it went — so `activityGraded` now trails the completion.
  expect(
    events.map((event) => event.type).slice(-3),
  ).toEqual(['wrinkleEffectApplied', 'activityCompleted', 'activityGraded']);
  expect(state.lastMealCompletedAt).toBeNull();

  const game = advanceGame(
    session,
    events,
    [],
    [],
    undefined,
    content,
  ).session;
  expect(game.recap.mealCount).toBe(0);
  expect(
    game.wrinkles.announced?.parameters.effectApplied,
  ).toBe(true);
});

test('empty fridge keeps Meal in place until the delivery minute', () => {
  const beforeDelivery = freshState(
    DAY_TWO_START + BASE_WAKE + 100,
  );
  beforeDelivery.queue = [playerCard('meal')];
  placeAtActivity(beforeDelivery, 'meal');
  const session = sessionFor('empty-fridge');
  const rules = rulesFor(beforeDelivery, session);
  const waiting = step(beforeDelivery, [], content, rules);
  expect(waiting.next.current).toBeNull();
  expect(waiting.next.queue[0]?.activityId).toBe('meal');

  const delivered = {
    ...waiting.next,
    clock: {
      absoluteMinute: DAY_TWO_START + BASE_WAKE + 420,
    },
  };
  const started = step(delivered, [], content, rules);
  expect(started.next.current).not.toBeNull();
});

test('rough night sets the ordinary wake to 60 Energy', () => {
  const state = freshState(DAY_TWO_START + BASE_WAKE - 1);
  state.bars.energy = toFixed(95);
  state.queue = [
    {
      ...playerCard('sleep'),
      id: 'sleep-card',
    },
  ];
  state.current = {
    type: 'sleep',
    cardId: 'sleep-card',
  };
  const result = step(
    state,
    [],
    content,
    rulesFor(state, sessionFor('rough-night')),
  );

  expect(result.events.some((event) => event.type === 'wakeBoundary')).toBe(
    true,
  );
  expect(result.snapshot.bars.energy).toBe(60);
});
