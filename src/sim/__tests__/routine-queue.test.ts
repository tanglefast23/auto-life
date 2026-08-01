import { content } from '../content';
import { toFixed } from '../fixed';
import {
  ROUTINE_NEED_THRESHOLD,
  ROUTINE_QUEUE_TARGET,
  refillRoutineQueue,
} from '../planner/routine';
import {
  REMOVE_SUPPRESSION_MIN,
  STOP_SUPPRESSION_MIN,
  type QueueCard,
  type SuppressionMap,
} from '../queue';
import { PrngStreams } from '../prng';
import { newGameState } from '../state';
import { step } from '../step';
import type { Bars } from '../types';

function bars(
  energy: number,
  nutrition: number,
  movement: number,
  hygiene: number,
): Bars {
  return {
    energy: toFixed(energy),
    nutrition: toFixed(nutrition),
    movement: toFixed(movement),
    hygiene: toFixed(hygiene),
  };
}

function refill(
  queue: readonly QueueCard[],
  currentCardId: string | null,
  currentBars: Bars,
  suppression: SuppressionMap = {},
  absoluteMinute = 600,
  foodMood: 'proper-meals' | 'grazer' | null = null,
): QueueCard[] {
  let sequence = 1;
  return refillRoutineQueue({
    queue,
    currentCardId,
    bars: currentBars,
    absoluteMinute,
    wakeTarget: 420,
    napEffectiveUsesToday: 0,
    content,
    createCardId: () => `routine-${sequence++}`,
    suppression,
    foodMood,
  });
}

/**
 * SPEC §9.2 sells food mood as "which variant the planner reaches for first", and it is
 * one of only two preferences a player is given in the 60-second identity flow. The
 * reactive path honoured it; the routine planner — which is the *default* autonomy and
 * therefore almost all real play — booked `snack` unconditionally and never saw `rules`
 * at all, so a full day under `proper-meals` was byte-identical to one under `null`.
 * A rolled preference the player can never observe is a broken promise at the most
 * memorable moment the game has.
 */
test('a proper-meals person is booked meals, not snacks, for the same hunger', () => {
  const hungry = bars(100, ROUTINE_NEED_THRESHOLD - 10, 100, 100);

  const properMeals = refill([], null, hungry, {}, 600, 'proper-meals');
  const grazer = refill([], null, hungry, {}, 600, 'grazer');

  expect(properMeals.map((card) => card.activityId)).toContain('meal');
  expect(properMeals.map((card) => card.activityId)).not.toContain('snack');
  expect(grazer.map((card) => card.activityId)).toContain('snack');
  expect(grazer.map((card) => card.activityId)).not.toContain('meal');
});

test('an unrolled food mood keeps the snack default, so no existing career shifts', () => {
  const hungry = bars(100, ROUTINE_NEED_THRESHOLD - 10, 100, 100);
  expect(refill([], null, hungry).map((card) => card.activityId)).toContain('snack');
});

test('healthy free time fills all five visible slots with reading', () => {
  const queue = refill([], null, bars(100, 100, 100, 100));

  expect(queue).toHaveLength(ROUTINE_QUEUE_TARGET);
  expect(queue.map((card) => card.activityId)).toEqual([
    'read',
    'read',
    'read',
    'read',
    'read',
  ]);
  expect(queue.every((card) => card.source === 'routine')).toBe(true);
  expect(
    queue.every(
      (card) =>
        card.reason?.kind === 'routinePlan' &&
        card.reason.bar === null,
    ),
  ).toBe(true);
});

test('bars below 80 reserve maintenance slots before productive fillers', () => {
  const queue = refill([], null, bars(100, 70, 60, 70));

  expect(ROUTINE_NEED_THRESHOLD).toBe(80);
  expect(queue.map((card) => card.activityId)).toEqual([
    'snack',
    'quickwash',
    'stretch',
    'read',
    'read',
  ]);
  expect(
    queue.slice(0, 3).map((card) =>
      card.reason?.kind === 'routinePlan'
        ? card.reason.bar
        : null,
    ),
  ).toEqual(['nutrition', 'hygiene', 'movement']);
});

test('a newly hungry sim replaces the next filler without touching the current card', () => {
  const healthy = refill([], null, bars(100, 100, 100, 100));
  const currentId = healthy[0]!.id;
  const hungry = refill(
    healthy,
    currentId,
    bars(100, 79, 100, 100),
  );

  expect(hungry).toHaveLength(ROUTINE_QUEUE_TARGET);
  expect(hungry[0]!.id).toBe(currentId);
  expect(hungry[0]!.activityId).toBe('read');
  expect(hungry[1]!.activityId).toBe('snack');
  expect(hungry.slice(2).map((card) => card.activityId)).toEqual([
    'read',
    'read',
    'read',
  ]);
});

test('the real step path publishes five cards at wake and keeps five after a completion', () => {
  let state = newGameState(
    'baseline',
    content.rates,
    1234,
    content.perks,
  );
  let firstQueue: string[] | null = null;
  let sawCompletion = false;

  for (let tick = 0; tick < 180; tick += 1) {
    const result = step(state, [], content);
    state = result.next;
    if (firstQueue === null) {
      firstQueue = result.snapshot.queue.map((card) => card.activityId);
    }
    expect(result.snapshot.queue).toHaveLength(ROUTINE_QUEUE_TARGET);
    if (result.events.some((event) => event.type === 'activityCompleted')) {
      sawCompletion = true;
      break;
    }
  }

  expect(firstQueue).toEqual([
    'toilet',
    'brush',
    'shower',
    'meal',
    'stretch',
  ]);
  expect(sawCompletion).toBe(true);
});

test('the real step path moves a Snack into the next slot when Nutrition dips below 80', () => {
  let state = newGameState(
    'baseline',
    content.rates,
    1234,
    content.perks,
  );

  for (let tick = 0; tick < 500; tick += 1) {
    state = step(state, [], content).next;
    if (
      state.current?.type === 'activity' &&
      state.current.dto.activityId === 'read'
    ) {
      state.bars.nutrition = toFixed(79);
      const result = step(state, [], content);
      const upcoming = result.snapshot.queue.filter(
        (card) => card.id !== result.snapshot.currentCardId,
      );
      expect(result.snapshot.queue).toHaveLength(ROUTINE_QUEUE_TARGET);
      expect(upcoming[0]?.activityId).toBe('snack');
      return;
    }
  }

  throw new Error('expected the routine to reach productive reading');
});

/**
 * §7.4 suppression at the planner's own level.
 *
 * The rolling refill ran one branch below the `step()` code that writes the suppression
 * entry and ignored it, so a removed routine card was re-created in the same tick that
 * removed it — Remove and Stop looked dead against most of the visible queue under the
 * default autonomy, and the Undo toast offered to undo a removal that had already undone
 * itself. Two audits reached that finding independently; the fix landed in PR #4, which
 * needed it to lift the blanket "start nothing this tick" guard from the stop path.
 *
 * `stop-handoff.test.ts` covers the *stop* window (1 h) end-to-end through `step()`. These
 * are the unit-level complement: the *remove* window (2 h), the exact minute suppression
 * lapses, that an unrelated bar still books its maintenance, and — the one case neither
 * audit's report named — that a refill whose fallback is also suppressed terminates.
 */
describe('§7.4 suppression', () => {
  it('does not re-plan a suppressed activity, and leaves the slot to the next need', () => {
    const suppressed = refill([], null, bars(100, 70, 60, 70), {
      snack: 600 + REMOVE_SUPPRESSION_MIN,
    });

    expect(suppressed.map((card) => card.activityId)).not.toContain('snack');
    // Hygiene and Movement are untouched by a Nutrition suppression, so their maintenance
    // still books — suppression removes one type, it does not stall the whole plan.
    expect(suppressed.map((card) => card.activityId)).toEqual([
      'quickwash',
      'stretch',
      'read',
      'read',
      'read',
    ]);
  });

  it('plans the activity again the minute the window lapses', () => {
    const until = 600 + REMOVE_SUPPRESSION_MIN;
    const hungry = bars(100, 70, 100, 100);

    const during = refill([], null, hungry, { snack: until }, until - 1);
    expect(during.map((card) => card.activityId)).not.toContain('snack');

    const after = refill([], null, hungry, { snack: until }, until);
    expect(after.map((card) => card.activityId)).toContain('snack');
  });

  it('honours the shorter 1-hour window a Stop writes', () => {
    const until = 600 + STOP_SUPPRESSION_MIN;
    expect(STOP_SUPPRESSION_MIN).toBe(60);
    expect(REMOVE_SUPPRESSION_MIN).toBe(120);

    const hungry = bars(100, 70, 100, 100);
    expect(
      refill([], null, hungry, { snack: until }, until - 1).map((c) => c.activityId),
    ).not.toContain('snack');
    expect(
      refill([], null, hungry, { snack: until }, until).map((c) => c.activityId),
    ).toContain('snack');
  });

  it('leaves the plan short rather than looping when even the filler is suppressed', () => {
    // The fallback is the refill loop's only other exit. Skipping it without breaking out
    // would spin forever inside the tick, so this asserts termination as much as content.
    const queue = refill([], null, bars(100, 100, 100, 100), {
      read: 600 + REMOVE_SUPPRESSION_MIN,
    });

    expect(queue).toEqual([]);
  });

  it('re-creates a removed card once the window lapses, not before', () => {
    const state = newGameState(
      'baseline',
      content.rates,
      1234,
      content.perks,
    );
    state.clock.absoluteMinute = 600;
    state.bars = bars(100, 70, 100, 100);
    state.queue = refill([], null, state.bars);
    state.nextCardSeq = 100;

    const snack = state.queue.find((card) => card.activityId === 'snack');
    expect(snack).toBeDefined();

    const removed = step(
      state,
      [{ type: 'removeCard', cardId: snack!.id }],
      content,
    );

    // The regression, stated as the player would: the card is gone at the end of the very
    // tick that removed it, rather than re-created by the refill two branches later.
    expect(removed.next.suppression['snack']).toBe(600 + REMOVE_SUPPRESSION_MIN);
    expect(
      removed.snapshot.queue.some((card) => card.activityId === 'snack'),
    ).toBe(false);
    expect(removed.snapshot.queue).toHaveLength(ROUTINE_QUEUE_TARGET);
  });
});

test('severe hunger upgrades an unstarted routine Snack to the existing reactive Meal', () => {
  const state = newGameState(
    'baseline',
    content.rates,
    1234,
    content.perks,
  );
  state.clock.absoluteMinute = 600;
  state.bars = bars(100, 19, 100, 100);
  state.queue = refill([], null, state.bars);
  state.nextCardSeq = 100;

  const result = step(state, [], content);

  expect(
    result.snapshot.queue.some(
      (card) =>
        card.activityId === 'meal' &&
        card.source === 'reactive',
    ),
  ).toBe(true);
  expect(
    result.snapshot.queue.some(
      (card) => card.activityId === 'snack',
    ),
  ).toBe(false);
});
