import {
  GameLoop,
  SLEEP_SKIP_IDLE_MS,
  type LoopObserver,
} from '../loop';
import { content } from '../../sim/content';
import {
  dayNumber,
  minuteOfDay,
  targetsFor,
  TICKS_PER_DAY,
} from '../../sim/clock';
import { toFixed } from '../../sim/fixed';
import { PrngStreams } from '../../sim/prng';
import { newGameState, type SimState } from '../../sim/state';
import type { DomainEvent } from '../../sim/step';
import type { Chronotype } from '../../sim/types';
import type { GameSnapshot } from '../snapshot';
import { newSession } from '../../game/session';
import { newCareerState } from '../career-state';

const ROOT_SEED = 1234;
const ANCHOR_IDS = ['wake', 'lunch', 'workout', 'dinner', 'bedtime'] as const;

type SleepKind = 'anchor' | 'urgent';

function sleepingState(
  chronotype: Chronotype,
  kind: SleepKind = 'anchor',
  options: {
    daytime?: boolean;
    queuedUrgency?: boolean;
    crossesUrgencyDuringSleep?: boolean;
  } = {},
): SimState {
  const state = newGameState(
    chronotype,
    content.rates,
    ROOT_SEED,
    content.perks,
  );
  const wake = targetsFor(chronotype, content.rates).wake;
  const minute = options.daytime
    ? (wake + 300) % 1440
    : kind === 'anchor'
      ? (wake + 935) % 1440
      : 21 * 60 + 5;
  const cardId = `${kind}-sleep`;

  state.clock.absoluteMinute = minute;
  state.bars = {
    energy: toFixed(20),
    nutrition: toFixed(80),
    movement: toFixed(80),
    hygiene: toFixed(
      options.queuedUrgency
        ? 10
        : options.crossesUrgencyDuringSleep
          ? 15.01
          : 80,
    ),
  };
  state.anchorsConsumedOnDay = Object.fromEntries(
    ANCHOR_IDS.map((anchorId) => [anchorId, 1]),
  );
  state.queue = [
    {
      id: cardId,
      activityId: 'sleep',
      owner: 'AUTO',
      urgent: kind === 'urgent',
      source: kind === 'anchor' ? 'anchor' : 'reactive',
      ...(kind === 'anchor' ? { blockId: 'bedtime#1' } : {}),
      enqueuedTick: minute,
    },
    ...(options.queuedUrgency
      ? [
          {
            id: 'queued-urgent-shower',
            activityId: 'shower',
            owner: 'AUTO' as const,
            urgent: true,
            source: 'reactive' as const,
            enqueuedTick: minute,
          },
        ]
      : []),
  ];
  state.current = { type: 'sleep', cardId };
  return state;
}

function observerLog(): {
  observer: LoopObserver;
  eventBatches: DomainEvent[][];
  snapshots: GameSnapshot[];
} {
  const eventBatches: DomainEvent[][] = [];
  const snapshots: GameSnapshot[] = [];
  return {
    eventBatches,
    snapshots,
    observer: {
      onEvents: (events) => eventBatches.push([...events]),
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    },
  };
}

function flatten(batches: readonly (readonly DomainEvent[])[]): DomainEvent[] {
  return batches.flatMap((batch) => [...batch]);
}

function advanceInFrames(loop: GameLoop, totalMs: number, frameMs = 100): number {
  let ticks = 0;
  let remaining = totalMs;
  while (remaining > 0) {
    const elapsed = Math.min(frameMs, remaining);
    ticks += loop.advance(elapsed);
    remaining -= elapsed;
  }
  return ticks;
}

describe('named sleep-skip batch', () => {
  test.each<Chronotype>(['baseline', 'early', 'owl'])(
    '%s skip is identical to watching every top-level tick',
    (chronotype) => {
      const skippedLog = observerLog();
      const watchedLog = observerLog();
      const initial = sleepingState(chronotype, 'anchor', {
        crossesUrgencyDuringSleep: true,
      });
      const skipped = new GameLoop(initial, content, skippedLog.observer);
      const watched = new GameLoop(initial, content, watchedLog.observer);

      // A partial timing frame proves the batch preserves the loop accumulator too.
      expect(skipped.advance(250)).toBe(0);
      expect(watched.advance(250)).toBe(0);

      const skippedTicks = skipped.skipNightToWake();
      for (let watchedTicks = 0; watchedTicks < skippedTicks; watchedTicks++) {
        watched.runOneTick();
      }

      expect(skippedTicks).toBeGreaterThan(0);
      expect(skipped.peekState()).toEqual(watched.peekState());
      expect(skipped.session).toEqual(watched.session);
      expect(skipped.peekPrng()).toEqual(watched.peekPrng());
      const exportBase = newCareerState({
        rootSeed: 0,
        sim: initial,
        prng: PrngStreams.create(0).serialize(),
      }).payload;
      expect(
        JSON.stringify(skipped.exportCareerPayload(exportBase)),
      ).toBe(
        JSON.stringify(watched.exportCareerPayload(exportBase)),
      );
      expect(flatten(skippedLog.eventBatches)).toEqual(
        flatten(watchedLog.eventBatches),
      );
      expect(skipped.session.recap).toEqual(watched.session.recap);
      expect(skipped.session.goals).toEqual(watched.session.goals);
      expect(skipped.session.journal.entries).toHaveLength(1);
      expect(
        skipped.session.morningRecap?.journalEntryId,
      ).toBe(skipped.session.journal.entries[0]?.id);
      expect(skipped.snapshot).toEqual(watched.snapshot);
      expect(skipped.stats).toEqual(watched.stats);

      // The forced Hygiene crossing emits before wake, proving events were consumed
      // throughout the batch rather than reconstructed from its final state.
      expect(flatten(skippedLog.eventBatches).some((event) => event.type === 'urgent')).toBe(true);
      expect(skippedLog.eventBatches).toHaveLength(1);
      expect(skippedLog.snapshots).toHaveLength(1);
      expect(watchedLog.snapshots.length).toBe(skippedTicks);
      expect(skipped.stats.accumulatorMs).toBe(250);
      expect(minuteOfDay(skipped.peekState().clock.absoluteMinute)).toBe(
        targetsFor(chronotype, content.rates).wake,
      );
    },
  );

  test('a night urgent sleep can skip, but its own running card is not queued urgency', () => {
    const loop = new GameLoop(sleepingState('baseline', 'urgent'), content);

    expect(loop.skipNightToWake()).toBeGreaterThan(0);
    expect(loop.peekState().current?.type).not.toBe('sleep');
    expect(minuteOfDay(loop.peekState().clock.absoluteMinute)).toBe(
      targetsFor('baseline', content.rates).wake,
    );
  });

  test('daytime urgent sleep and another queued urgent card both block the batch', () => {
    const daytime = new GameLoop(
      sleepingState('baseline', 'urgent', { daytime: true }),
      content,
    );
    const queuedUrgency = new GameLoop(
      sleepingState('baseline', 'urgent', { queuedUrgency: true }),
      content,
    );

    expect(daytime.skipNightToWake()).toBe(0);
    expect(queuedUrgency.skipNightToWake()).toBe(0);
    expect(daytime.peekState().current?.type).toBe('sleep');
    expect(queuedUrgency.peekState().current?.type).toBe('sleep');
  });

  test('a Day-8 letter stops a sleep-skip at midnight before wake', () => {
    const initial = sleepingState('baseline');
    const startMinute = minuteOfDay(
      initial.clock.absoluteMinute,
    );
    initial.clock.absoluteMinute =
      6 * TICKS_PER_DAY + startMinute;
    const session = newSession();
    session.goals['balanced-week']!.status = 'rewarded';
    const log = observerLog();
    const loop = new GameLoop(
      newCareerState({
        rootSeed: ROOT_SEED,
        sim: initial,
        game: session,
        prng: PrngStreams.create(ROOT_SEED).serialize(),
      }).payload,
      content,
      log.observer,
    );

    const skippedTicks = loop.skipNightToWake();

    expect(skippedTicks).toBe(TICKS_PER_DAY - startMinute);
    expect(skippedTicks).toBeLessThan(
      (targetsFor('baseline', content.rates).wake -
        startMinute +
        TICKS_PER_DAY) %
        TICKS_PER_DAY,
    );
    expect(dayNumber(loop.peekState().clock.absoluteMinute)).toBe(8);
    expect(minuteOfDay(loop.peekState().clock.absoluteMinute)).toBe(0);
    expect(loop.session.letter.status).toBe('due');
    expect(
      flatten(log.eventBatches).some(
        (event) => event.type === 'wakeBoundary',
      ),
    ).toBe(false);
    expect(log.snapshots).toHaveLength(1);
    expect(loop.skipNightToWake()).toBe(0);
  });
});

describe('ten-real-second idle gate', () => {
  test('pre-sleep time is not banked; the gate starts when Sleep actually starts', () => {
    const initial = sleepingState('baseline');
    initial.current = null;
    const loop = new GameLoop(initial, content);

    loop.elapsePresentationTime(SLEEP_SKIP_IDLE_MS - 1);
    expect(loop.sleepSkipIdleMs).toBe(0);

    loop.runOneTick();
    expect(loop.peekState().current?.type).toBe('sleep');
    expect(loop.sleepSkipIdleMs).toBe(0);

    advanceInFrames(loop, SLEEP_SKIP_IDLE_MS - 1);
    expect(loop.peekState().current?.type).toBe('sleep');
    loop.advance(1);
    expect(loop.peekState().current?.type).not.toBe('sleep');
  });

  test('input at 9.9 seconds restarts the gate instead of skipping early', () => {
    const loop = new GameLoop(sleepingState('baseline'), content);

    advanceInFrames(loop, SLEEP_SKIP_IDLE_MS - 100);
    expect(loop.peekState().current?.type).toBe('sleep');
    expect(loop.sleepSkipIdleMs).toBe(SLEEP_SKIP_IDLE_MS - 100);

    loop.notePlayerInput();
    expect(loop.sleepSkipIdleMs).toBe(0);

    advanceInFrames(loop, SLEEP_SKIP_IDLE_MS - 100);
    expect(loop.peekState().current?.type).toBe('sleep');

    const finalFrameTicks = loop.advance(100);
    expect(finalFrameTicks).toBeGreaterThan(1);
    expect(loop.peekState().current?.type).not.toBe('sleep');
    expect(minuteOfDay(loop.peekState().clock.absoluteMinute)).toBe(
      targetsFor('baseline', content.rates).wake,
    );
  });

  test('player pause and system background time are both excluded', () => {
    for (const pause of [
      (loop: GameLoop) => loop.setSpeed(0),
      (loop: GameLoop) => loop.setSystemPaused(true),
    ]) {
      const loop = new GameLoop(sleepingState('baseline'), content);
      advanceInFrames(loop, SLEEP_SKIP_IDLE_MS - 100);
      pause(loop);
      advanceInFrames(loop, 60_000);

      expect(loop.peekState().current?.type).toBe('sleep');
      expect(loop.sleepSkipIdleMs).toBe(SLEEP_SKIP_IDLE_MS - 100);

      if (loop.speed === 0) loop.setSpeed(1);
      else loop.setSystemPaused(false);
      loop.advance(100);
      expect(loop.peekState().current?.type).not.toBe('sleep');
    }
  });

  test('daytime or queued urgency never arms the automatic gate', () => {
    const daytime = new GameLoop(
      sleepingState('baseline', 'urgent', { daytime: true }),
      content,
    );
    const queuedUrgency = new GameLoop(
      sleepingState('baseline', 'urgent', { queuedUrgency: true }),
      content,
    );

    advanceInFrames(daytime, SLEEP_SKIP_IDLE_MS + 1_000);
    advanceInFrames(queuedUrgency, SLEEP_SKIP_IDLE_MS + 1_000);

    expect(daytime.peekState().current?.type).toBe('sleep');
    expect(queuedUrgency.peekState().current?.type).toBe('sleep');
    expect(daytime.sleepSkipIdleMs).toBe(0);
    expect(queuedUrgency.sleepSkipIdleMs).toBe(0);
  });

  test('reset clears the idle gate with the rest of loop-owned presentation state', () => {
    const loop = new GameLoop(sleepingState('baseline'), content);
    advanceInFrames(loop, SLEEP_SKIP_IDLE_MS - 100);
    expect(loop.sleepSkipIdleMs).toBe(SLEEP_SKIP_IDLE_MS - 100);

    loop.reset();

    expect(loop.sleepSkipIdleMs).toBe(0);
    expect(loop.stats).toEqual({
      ticksRun: 0,
      droppedFrames: 0,
      accumulatorMs: 0,
    });
  });

  test('the gate is elapsed-driven, so an unmounted screen leaves no timer that can skip later', () => {
    jest.useFakeTimers();
    try {
      const loop = new GameLoop(sleepingState('baseline'), content);
      advanceInFrames(loop, SLEEP_SKIP_IDLE_MS - 100);
      const before = JSON.stringify(loop.peekState());

      // GameScreen unmount stops RAF. With no frame handed to the loop, advancing
      // wall-clock timers alone cannot mutate deterministic or presentation state.
      jest.advanceTimersByTime(60_000);

      expect(JSON.stringify(loop.peekState())).toBe(before);
      expect(loop.sleepSkipIdleMs).toBe(SLEEP_SKIP_IDLE_MS - 100);
    } finally {
      jest.useRealTimers();
    }
  });
});
