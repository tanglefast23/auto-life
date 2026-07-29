import { GameLoop, MAX_TICKS_PER_FRAME, msPerTick, ticksToRun, type Speed } from '../loop';
import { newGameState } from '../../sim/state';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';

/**
 * P3 T4. The headline assertion is speed-independence: the master §5 exit says "sim
 * result is speed-independent", and reading that as "roughly the same" would make it
 * untestable. Here it means bit-identical state.
 */

const fresh = () => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());
const digest = (loop: GameLoop) => JSON.stringify(loop.peekState());

describe('ticksToRun — pure timing rules (SPEC §5)', () => {
  test('500 / 250 / 125 ms per tick at 1× / 2× / 4×', () => {
    expect(msPerTick(1)).toBe(500);
    expect(msPerTick(2)).toBe(250);
    expect(msPerTick(4)).toBe(125);
  });

  test('one tick lands exactly on its boundary at every speed', () => {
    for (const speed of [1, 2, 4] as Speed[]) {
      const plan = ticksToRun(0, msPerTick(speed), speed);
      expect(plan.ticks).toBe(1);
      expect(plan.accumulatorMs).toBe(0);
    }
  });

  test('the remainder is carried, never dropped', () => {
    // 700 ms at 1× is one tick with 200 ms left over; the next 300 ms completes another.
    const first = ticksToRun(0, 700, 1);
    expect(first).toMatchObject({ ticks: 1, accumulatorMs: 200, dropped: false });
    const second = ticksToRun(first.accumulatorMs, 300, 1);
    expect(second).toMatchObject({ ticks: 1, accumulatorMs: 0 });
  });

  test('sub-tick frames accumulate instead of stalling', () => {
    let acc = 0;
    let total = 0;
    // 60 fps at 1×: ~16.67 ms frames should produce a tick every ~30 frames.
    for (let i = 0; i < 30; i++) {
      const plan = ticksToRun(acc, 1000 / 60, 1);
      acc = plan.accumulatorMs;
      total += plan.ticks;
    }
    expect(total).toBe(1);
  });

  test('pause accumulates nothing, so resuming never bursts', () => {
    const plan = ticksToRun(0, 10_000, 0);
    expect(plan).toMatchObject({ ticks: 0, accumulatorMs: 0 });
  });

  test('a long stall is capped and the backlog discarded, never fast-forwarded', () => {
    const plan = ticksToRun(0, 60_000, 4); // 8 real minutes of backlog
    expect(plan.ticks).toBe(MAX_TICKS_PER_FRAME);
    expect(plan.accumulatorMs).toBe(0);
    expect(plan.dropped).toBe(true);
  });

  test('hostile elapsed values are ignored rather than propagated', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(ticksToRun(0, bad, 1).ticks).toBe(0);
    }
  });
});

describe('speed-independence — the master §5 exit criterion', () => {
  test('the same number of ticks produces bit-identical state at 1×, 2× and 4×', () => {
    const TICKS = 600;
    const digests = ([1, 2, 4] as Speed[]).map((speed) => {
      const loop = new GameLoop(fresh(), content);
      loop.setSpeed(speed);
      // Feed exactly the wall-clock time that speed needs for TICKS ticks, one tick per frame.
      for (let i = 0; i < TICKS; i++) loop.advance(msPerTick(speed));
      expect(loop.stats.ticksRun).toBe(TICKS);
      return digest(loop);
    });
    expect(digests[1]).toBe(digests[0]);
    expect(digests[2]).toBe(digests[0]);
  });

  test('batching is irrelevant: many small frames equal one big frame', () => {
    const oneBig = new GameLoop(fresh(), content);
    oneBig.setSpeed(1);
    // 8 ticks in a single frame — exactly at the cap, so nothing is discarded.
    oneBig.advance(500 * MAX_TICKS_PER_FRAME);

    const manySmall = new GameLoop(fresh(), content);
    manySmall.setSpeed(1);
    for (let i = 0; i < MAX_TICKS_PER_FRAME * 5; i++) manySmall.advance(100); // 100 ms × 5 = 1 tick

    expect(oneBig.stats.ticksRun).toBe(MAX_TICKS_PER_FRAME);
    expect(manySmall.stats.ticksRun).toBe(MAX_TICKS_PER_FRAME);
    expect(digest(manySmall)).toBe(digest(oneBig));
  });

  test('changing speed mid-run does not change the outcome for a given tick count', () => {
    const steady = new GameLoop(fresh(), content);
    steady.setSpeed(1);
    for (let i = 0; i < 300; i++) steady.advance(500);

    const shifting = new GameLoop(fresh(), content);
    for (let i = 0; i < 300; i++) {
      const speed: Speed = i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 4;
      shifting.setSpeed(speed);
      shifting.advance(msPerTick(speed));
    }
    expect(shifting.stats.ticksRun).toBe(300);
    expect(digest(shifting)).toBe(digest(steady));
  });
});

describe('pause semantics', () => {
  test('speed 0 runs no ticks and freezes the snapshot', () => {
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(1);
    loop.advance(500);
    const before = digest(loop);
    loop.setSpeed(0);
    for (let i = 0; i < 100; i++) loop.advance(500);
    expect(loop.stats.ticksRun).toBe(1);
    expect(digest(loop)).toBe(before);
  });

  test('backgrounding hard-pauses and restores the chosen speed on return (SPEC §5, C1)', () => {
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(4);
    loop.setSystemPaused(true);
    expect(loop.effectiveSpeed).toBe(0);
    for (let i = 0; i < 50; i++) loop.advance(1000);
    expect(loop.stats.ticksRun).toBe(0);

    loop.setSystemPaused(false);
    expect(loop.effectiveSpeed).toBe(4);
    expect(loop.speed).toBe(4);
    loop.advance(msPerTick(4));
    expect(loop.stats.ticksRun).toBe(1);
  });

  test('no time passes while hidden, however long the tab was away', () => {
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(1);
    loop.setSystemPaused(true);
    const before = digest(loop);
    loop.advance(6 * 60 * 60 * 1000); // six hours
    expect(digest(loop)).toBe(before);
    expect(loop.stats.droppedFrames).toBe(0); // paused, not capped
  });
});

describe('commands and observation', () => {
  test('a queued command is applied on the next tick, then cleared', () => {
    const loop = new GameLoop(fresh(), content);
    loop.enqueue({ type: 'insertPlayer', activityId: 'practice' });
    loop.runOneTick();
    expect(loop.snapshot!.queueIds.length).toBeGreaterThan(0);
    const after = loop.snapshot!.queueIds.length;
    loop.runOneTick();
    // The command did not re-apply — the queue did not gain a second practice card.
    expect(loop.snapshot!.queueIds.length).toBeLessThanOrEqual(after);
  });

  test('observers receive a snapshot per tick and events when they occur', () => {
    const snapshots: number[] = [];
    let eventCount = 0;
    const loop = new GameLoop(fresh(), content, {
      onSnapshot: (s) => snapshots.push(s.minuteOfDay),
      onEvents: (e) => {
        eventCount += e.length;
      },
    });
    loop.setSpeed(1);
    for (let i = 0; i < 120; i++) loop.advance(500);
    expect(snapshots).toHaveLength(120);
    expect(eventCount).toBeGreaterThan(0); // the wake block completes activities
  });

  test('the snapshot carries the render block the scene needs', () => {
    const loop = new GameLoop(fresh(), content);
    loop.runOneTick();
    expect(loop.snapshot!.render.position).toBeDefined();
    expect(loop.snapshot!.render.mSpeed).toBeGreaterThan(0);
  });
});
