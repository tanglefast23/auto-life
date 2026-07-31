import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  newCareerState,
  type StoredCareer,
} from '../career-state';
import {
  CareerSaveController,
  type SaveReason,
  type SaveScheduler,
} from '../save-controller';

class FakeScheduler implements SaveScheduler {
  private nextId = 1;
  private timers = new Map<
    number,
    { dueAt: number; callback: () => void }
  >();

  constructor(private current = 10_000) {}

  now(): number {
    return this.current;
  }

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, {
      dueAt: this.current + delayMs,
      callback,
    });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  advance(ms: number): void {
    this.current += ms;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.dueAt <= this.current)
        .sort((a, b) => a[1].dueAt - b[1].dueAt)[0];
      if (next === undefined) return;
      this.timers.delete(next[0]);
      next[1].callback();
    }
  }
}

function freshCareer(savedAtEpochMs = 0): StoredCareer {
  const seed = 9191;
  const prng = PrngStreams.create(seed).serialize();
  return {
    ...newCareerState({
      rootSeed: seed,
      sim: newGameState('baseline', content.rates, seed, prng),
      prng,
    }),
    savedAtEpochMs,
  };
}

function setup(savedAtEpochMs = 0) {
  const scheduler = new FakeScheduler();
  let career = freshCareer(savedAtEpochMs);
  const ordinary: StoredCareer[] = [];
  const barriers: StoredCareer[] = [];
  const save = async (
    candidate: StoredCareer,
    at: number,
  ): Promise<StoredCareer> => {
    const saved = {
      ...candidate,
      generation: candidate.generation + 1,
      savedAtEpochMs: at,
    };
    ordinary.push(saved);
    return saved;
  };
  const saveBarrier = async (
    candidate: StoredCareer,
    at: number,
  ): Promise<StoredCareer> => {
    const saved = {
      ...candidate,
      generation: candidate.generation + 1,
      savedAtEpochMs: at,
    };
    barriers.push(saved);
    return saved;
  };
  const errors: unknown[] = [];
  const reasons: SaveReason[] = [];
  const controller = new CareerSaveController(
    { save, saveBarrier },
    () => career,
    (saved, reason) => {
      career = saved;
      reasons.push(reason);
    },
    (error) => errors.push(error),
    scheduler,
  );
  return {
    controller,
    scheduler,
    ordinary,
    barriers,
    errors,
    reasons,
    career: () => career,
  };
}

const observation = {
  day: 1,
  absoluteMinute: 480,
  minuteOfDay: 480,
  isMidnight: false,
  isMorningCheck: false,
  bars: {
    energy: 600_000,
    nutrition: 600_000,
    movement: 600_000,
    hygiene: 600_000,
  },
  currentActivityId: null,
  urgentCount: 0,
} as const;

test('accepted queue edits use a 500 ms trailing debounce', async () => {
  const { controller, scheduler, ordinary } = setup();
  controller.observeBoundary({
    watched: true,
    events: [],
    actions: [],
    observation,
    outcomes: [
      { type: 'moveCard', status: 'accepted', cardId: 'c1' },
    ],
  });
  scheduler.advance(499);
  await controller.whenIdle();
  expect(ordinary).toHaveLength(0);
  scheduler.advance(1);
  await controller.whenIdle();
  expect(ordinary).toHaveLength(1);
  controller.stop();
});

test('ordinary saves coalesce to five seconds and a major decision supersedes the wait', async () => {
  const { controller, scheduler, ordinary } = setup(9_000);
  controller.observeBoundary({
    watched: true,
    events: [
      {
        type: 'activityCompleted',
        detail: 'shower',
        atMinute: 480,
      },
    ],
    actions: [],
    outcomes: [],
    observation,
  });
  scheduler.advance(3_999);
  await controller.whenIdle();
  expect(ordinary).toHaveLength(0);

  controller.observeBoundary({
    watched: true,
    events: [],
    outcomes: [],
    observation,
    actions: [
      {
        type: 'decorationChosen',
        wrinkleId: 'package-delivery',
        decorationId: 'leafy-plant',
      },
    ],
  });
  await controller.whenIdle();
  expect(ordinary).toHaveLength(1);
  scheduler.advance(1);
  await controller.whenIdle();
  expect(ordinary).toHaveLength(1);
  controller.stop();
});

test('lifecycle barriers cancel pending churn and use the barrier writer', async () => {
  const { controller, scheduler, ordinary, barriers } = setup(9_000);
  controller.requestQueueEdit();
  scheduler.advance(250);
  await controller.requestImmediate('visibility-hidden');
  expect(ordinary).toHaveLength(0);
  expect(barriers).toHaveLength(1);
  scheduler.advance(10_000);
  await controller.whenIdle();
  expect(ordinary).toHaveLength(0);
  controller.stop();
});

test('rejected commands and quiet boundaries do not invent save reasons', async () => {
  const { controller, ordinary } = setup();
  controller.observeBoundary({
    watched: true,
    events: [],
    actions: [],
    observation,
    outcomes: [
      {
        type: 'moveCard',
        status: 'rejected',
        reason: 'unknownCard',
      },
    ],
  });
  await controller.whenIdle();
  expect(ordinary).toHaveLength(0);
  controller.stop();
});

test('a new wrinkle deal saves immediately with its semantic reason', async () => {
  const { controller, ordinary, reasons } = setup();
  controller.observeBoundary({
    watched: true,
    events: [],
    actions: [],
    observation,
    outcomes: [],
    wrinkleDealt: true,
  });

  await controller.whenIdle();
  expect(ordinary).toHaveLength(1);
  expect(reasons).toEqual(['wrinkle-deal']);
  controller.stop();
});

test('a wrinkle decision uses the major-decision save path', async () => {
  const { controller, ordinary, reasons } = setup();
  controller.observeBoundary({
    watched: true,
    events: [],
    outcomes: [],
    observation,
    actions: [
      {
        type: 'wrinkleAction',
        wrinkleId: 'repair-visit',
        actionId: 'plan-around-repair',
      },
    ],
  });

  await controller.whenIdle();
  expect(ordinary).toHaveLength(1);
  expect(reasons).toEqual(['major-decision']);
  controller.stop();
});

test('a letter answer uses the major-decision save path', async () => {
  const { controller, ordinary, reasons } = setup();
  controller.observeBoundary({
    watched: true,
    events: [],
    outcomes: [],
    observation,
    actions: [
      {
        type: 'letterResponded',
        decision: 'accept',
      },
    ],
  });

  await controller.whenIdle();
  expect(ordinary).toHaveLength(1);
  expect(reasons).toEqual(['major-decision']);
  controller.stop();
});

test('the periodic trigger samples one complete current career', async () => {
  const { controller, scheduler, ordinary, career } = setup();
  controller.start();
  scheduler.advance(60_000);
  await controller.whenIdle();
  expect(ordinary).toHaveLength(1);
  expect(ordinary[0]!.careerId).toBe(career().careerId);
  controller.stop();
});
