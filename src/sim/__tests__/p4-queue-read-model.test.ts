import { dayNumber, minuteOfDay } from '../clock';
import { content, objectForActivity } from '../content';
import { forecast } from '../forecast';
import { toDisplay, toFixed } from '../fixed';
import { PrngStreams } from '../prng';
import type { QueueCard } from '../queue';
import { DEFAULT_SIM_RULES } from '../rules';
import { newGameState, type SimState } from '../state';
import { buildSnapshot, step } from '../step';

const fresh = (): SimState =>
  newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

const card = (over: Partial<QueueCard> & { id: string; activityId: string }): QueueCard => ({
  owner: 'AUTO',
  urgent: false,
  source: 'reactive',
  enqueuedTick: 0,
  ...over,
});

const at = (activityId: string): { x: number; y: number } => {
  const [x, y] = objectForActivity(activityId).interactPoint;
  return { x, y };
};

const prepared = (): SimState => {
  const s = fresh();
  s.clock.absoluteMinute = 600;
  s.bars = {
    energy: toFixed(80),
    nutrition: toFixed(80),
    movement: toFixed(80),
    hygiene: toFixed(80),
  };
  const today = dayNumber(s.clock.absoluteMinute);
  for (const anchor of content.anchors.anchors) s.anchorsConsumedOnDay[anchor.id] = today;
  return s;
};

test('the sim snapshot publishes a frozen intrinsic queue DTO and exact current-card identity', () => {
  const s = prepared();
  s.position = at('practice');
  s.queue = [
    card({
      id: 'practice-a',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
      enqueuedTick: 10,
    }),
    card({
      id: 'practice-b',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
      enqueuedTick: 11,
    }),
  ];

  const r = step(s, [], content, {
    ...DEFAULT_SIM_RULES,
    key: 'read-model-without-routine-refill',
    autonomy: 'reactive-only',
  });

  expect(r.snapshot.queue).toEqual([
    {
      id: 'practice-a',
      activityId: 'practice',
      owner: 'PINNED',
      urgent: false,
      source: 'player',
      blockId: undefined,
      enqueuedTick: 10,
      reason: undefined,
      durationTicksAtCurrentSpeed: 47,
    },
    {
      id: 'practice-b',
      activityId: 'practice',
      owner: 'PINNED',
      urgent: false,
      source: 'player',
      blockId: undefined,
      enqueuedTick: 11,
      reason: undefined,
      durationTicksAtCurrentSpeed: 47,
    },
  ]);
  expect(r.snapshot.currentCardId).toBe('practice-a');
  expect(r.snapshot.currentProgress).toBeGreaterThan(0);
  expect(r.snapshot.currentProgress).toBeLessThan(1);
  expect(Object.isFrozen(r.snapshot.queue)).toBe(true);
  expect(r.snapshot.queue.every(Object.isFrozen)).toBe(true);
});

test('anchor and reactive cards carry structured reasons from the sim, never authored prose', () => {
  const wake = step(fresh(), [], content).snapshot.queue.filter((c) => c.source === 'anchor');
  expect(wake).toHaveLength(4);
  expect(wake.every((c) => c.reason?.kind === 'anchorWindow')).toBe(true);
  expect(wake[0]?.reason).toEqual({
    kind: 'anchorWindow',
    anchorId: 'wake',
    targetMinute: 420,
  });

  const s = prepared();
  s.bars.nutrition = toFixed(34);
  const reactive = step(s, [], content).snapshot.queue.find((c) => c.source === 'reactive');
  expect(reactive?.reason).toEqual({
    kind: 'reactiveTrigger',
    bar: 'nutrition',
    threshold: 35,
    atMinute: 600,
  });
});

test('forecast annotations use projected start values for cap-waste and name the target object', () => {
  const s = prepared();
  s.bars.nutrition = toFixed(90);
  s.position = at('meal');
  s.queue = [
    card({
      id: 'meal-card',
      activityId: 'meal',
      owner: 'PINNED',
      source: 'player',
    }),
  ];

  const annotation = forecast(s, content).annotations.find((a) => a.cardId === 'meal-card');
  expect(annotation).toEqual({
    cardId: 'meal-card',
    activityId: 'meal',
    predictedStartMinute: 600,
    reason: null,
    targetObjectId: 'microwave',
    effects: { nutrition: 35 },
    capWaste: { nutrition: 25 },
    bonuses: [],
  });

  // Agreement is against the real start-sampled DTO, not a second duration/effect
  // implementation inside the test.
  const actual = step(s, [], content).next;
  if (actual.current?.type !== 'activity') throw new Error('meal did not start');
  const actualEffect = toDisplay(actual.current.dto.effectTotalsFixed.nutrition ?? 0);
  const actualWaste = Math.max(0, toDisplay(s.bars.nutrition) + actualEffect - 100);
  expect(annotation?.effects.nutrition).toBe(actualEffect);
  expect(annotation?.capWaste.nutrition).toBe(actualWaste);
});

test('forecast conflicts identify the card consuming time when the bar crosses the threshold', () => {
  const s = prepared();
  s.bars.nutrition = toFixed(15.1);
  s.position = at('practice');
  s.queue = [
    card({
      id: 'long-practice',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
    }),
  ];

  const result = forecast(s, content);
  const conflict = result.conflicts.find((c) => c.bar === 'nutrition');
  expect(conflict).toBeDefined();
  expect(conflict?.responsibleCardIds).toEqual(['long-practice']);

  let sim = s;
  let actual:
    | { bar: 'nutrition'; atMinute: number; responsibleCardIds: string[] }
    | undefined;
  for (let t = 0; t < result.horizonTicks; t++) {
    const tickMinute = minuteOfDay(sim.clock.absoluteMinute);
    const before = sim.current;
    const r = step(sim, [], content);
    sim = r.next;
    if (r.snapshot.bars.nutrition < 15) {
      const responsible = before?.cardId ?? sim.current?.cardId ?? null;
      actual = {
        bar: 'nutrition',
        atMinute: tickMinute,
        responsibleCardIds: responsible === null ? [] : [responsible],
      };
      break;
    }
  }
  expect(conflict).toEqual(actual);
});

test('forecast bonuses name the activity that actually earns them, including armed minty', () => {
  const s = prepared();
  s.clock.absoluteMinute = 480;
  s.position = at('brush');
  s.practice.mintyArmed = true;
  s.queue = [
    card({
      id: 'bedtime-brush',
      activityId: 'brush',
      owner: 'PINNED',
      source: 'player',
    }),
    card({
      id: 'morning-practice',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
      enqueuedTick: 1,
    }),
  ];

  const result = forecast(s, content);
  const brush = result.annotations.find((a) => a.cardId === 'bedtime-brush');
  const practice = result.annotations.find((a) => a.cardId === 'morning-practice');

  expect(brush?.bonuses).toEqual([]);
  expect(practice?.bonuses).toEqual([
    expect.objectContaining({
      kind: 'adjacency',
      pairId: 'minty-fresh',
      effect: expect.objectContaining({ kind: 'scalePoints', factor: 1.15 }),
    }),
  ]);
});

test('forecast publishes shared-engine adjacency matches and the consecutive Practice curve', () => {
  const freshMind = prepared();
  freshMind.clock.absoluteMinute = 480;
  freshMind.position = at('practice');
  freshMind.lastCompletion = {
    activityId: 'shower',
    atMinute: 479,
    isWorkout: false,
  };
  freshMind.queue = [
    card({
      id: 'fresh-practice',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
    }),
  ];

  expect(
    forecast(freshMind, content).annotations.find((a) => a.cardId === 'fresh-practice')
      ?.bonuses,
  ).toEqual([
    expect.objectContaining({
      kind: 'adjacency',
      pairId: 'fresh-mind',
      effect: expect.objectContaining({ kind: 'scalePoints', factor: 1.2 }),
    }),
  ]);

  const block = prepared();
  block.position = at('practice');
  block.lastCompletion = {
    activityId: 'practice',
    atMinute: 599,
    isWorkout: false,
  };
  block.practice.prevCompletionWasPractice = true;
  block.practice.sessionsCountedToday = 1;
  block.queue = [
    card({
      id: 'block-practice',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
    }),
  ];

  expect(
    forecast(block, content).annotations.find((a) => a.cardId === 'block-practice')
      ?.bonuses,
  ).toContainEqual({
    kind: 'practiceBlock',
    blockFactor: 0.85,
    scatteredFactor: 0.7,
  });
});

test('forecast adjacency gaps use absolute time after Day 1', () => {
  const s = prepared();
  s.clock.absoluteMinute = 1440 + 480;
  s.position = at('practice');
  const today = dayNumber(s.clock.absoluteMinute);
  for (const anchor of content.anchors.anchors) {
    s.anchorsConsumedOnDay[anchor.id] = today;
  }
  s.lastCompletion = {
    activityId: 'shower',
    atMinute: 480,
    isWorkout: false,
  };
  s.queue = [
    card({
      id: 'day-two-practice',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
    }),
  ];

  expect(
    forecast(s, content).annotations.find(
      (annotation) => annotation.cardId === 'day-two-practice',
    )?.bonuses,
  ).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ pairId: 'fresh-mind' }),
    ]),
  );
});

test('a pinned chain crossing the next wake is a separate wake-window warning', () => {
  const s = prepared();
  s.clock.absoluteMinute = 400;
  s.position = at('practice');
  s.queue = [
    card({
      id: 'wake-blocker-a',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
    }),
    card({
      id: 'wake-blocker-b',
      activityId: 'practice',
      owner: 'PINNED',
      source: 'player',
      enqueuedTick: 1,
    }),
  ];

  const result = forecast(s, content);

  expect(result.conflicts).toEqual([]);
  expect(result.wakeConflicts).toEqual([
    {
      wakeMinute: 420,
      responsibleCardIds: ['wake-blocker-a', 'wake-blocker-b'],
    },
  ]);
});

test('building a snapshot is read-only and does not invoke the recursive forecaster path', () => {
  const s = prepared();
  const before = JSON.stringify(s);
  const snap = buildSnapshot(s, content);
  expect(JSON.stringify(s)).toBe(before);
  expect('forecast' in snap).toBe(false);
});
