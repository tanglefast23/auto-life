import { step, type Command, type DomainEvent, type SimSnapshot } from '../sim/step';
import type { ContentRegistry } from '../sim/content';
import type { SimState } from '../sim/state';

/**
 * The live tick loop (master §4: `application/` owns it, and only it).
 *
 * Split deliberately in two:
 *  - `ticksToRun` is a **pure** function of (accumulator, elapsed ms, speed). It reads
 *    no clock, so the timing rules are unit-testable without timers and `Date.now`
 *    never gets near the deterministic path.
 *  - `GameLoop` owns mutable state and calls `step()`. It is handed elapsed
 *    milliseconds from outside, so tests drive it frame-by-frame with exact numbers.
 *
 * SPEC §5: 1 tick = 1 game-minute = 500 ms at 1×, 250 ms at 2×, 125 ms at 4×.
 */

export type Speed = 0 | 1 | 2 | 4;
export const SPEEDS: readonly Speed[] = [0, 1, 2, 4];
export const MS_PER_TICK_AT_1X = 500;

/**
 * Ticks are dropped, never banked, past this many per frame.
 *
 * A tab that was throttled or a debugger that paused execution would otherwise hand us
 * a huge `elapsedMs` and silently fast-forward the sim — hours of simulated life the
 * player never saw. Backgrounding already hard-pauses (SPEC §5, C1); this is the brace
 * for every other stall.
 */
export const MAX_TICKS_PER_FRAME = 8;

export function msPerTick(speed: Speed): number {
  if (speed === 0) return Number.POSITIVE_INFINITY;
  return MS_PER_TICK_AT_1X / speed;
}

export interface TickPlan {
  ticks: number;
  accumulatorMs: number;
  /** True when the cap discarded time — surfaced so evidence can report it honestly. */
  dropped: boolean;
}

export function ticksToRun(accumulatorMs: number, elapsedMs: number, speed: Speed, cap = MAX_TICKS_PER_FRAME): TickPlan {
  // Paused: time does not accumulate. Resuming must not burst through a backlog.
  if (speed === 0) return { ticks: 0, accumulatorMs, dropped: false };
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { ticks: 0, accumulatorMs, dropped: false };

  const per = msPerTick(speed);
  let acc = accumulatorMs + elapsedMs;
  let ticks = Math.floor(acc / per);
  let dropped = false;
  if (ticks > cap) {
    ticks = cap;
    acc = 0; // discard the backlog rather than fast-forward
    dropped = true;
  } else {
    acc -= ticks * per;
  }
  return { ticks, accumulatorMs: acc, dropped };
}

export interface LoopObserver {
  onSnapshot?: (snapshot: SimSnapshot) => void;
  onEvents?: (events: readonly DomainEvent[]) => void;
}

/**
 * Owns the live simulation. Never reads a clock itself — `advance(elapsedMs)` is called
 * by whatever is driving frames (requestAnimationFrame in the app, a test loop in Jest).
 */
export class GameLoop {
  private state: SimState;
  private accumulatorMs = 0;
  private speedValue: Speed = 1;
  private pausedBySystem = false;
  private pending: Command[] = [];
  private lastSnapshot: SimSnapshot | null = null;
  private droppedFrames = 0;
  private ticksRun = 0;

  constructor(
    initial: SimState,
    private readonly content: ContentRegistry,
    private readonly observer: LoopObserver = {},
  ) {
    this.state = initial;
  }

  get speed(): Speed {
    return this.speedValue;
  }

  /** The speed actually in effect — system pause (backgrounding) overrides the player's choice. */
  get effectiveSpeed(): Speed {
    return this.pausedBySystem ? 0 : this.speedValue;
  }

  get snapshot(): SimSnapshot | null {
    return this.lastSnapshot;
  }

  get stats(): { ticksRun: number; droppedFrames: number; accumulatorMs: number } {
    return { ticksRun: this.ticksRun, droppedFrames: this.droppedFrames, accumulatorMs: this.accumulatorMs };
  }

  /** Exposed for tests and evidence digests only. The UI reads snapshots, never this. */
  peekState(): SimState {
    return this.state;
  }

  setSpeed(speed: Speed): void {
    this.speedValue = speed;
    // Changing speed must not carry a partial tick measured against the old rate,
    // or a 1×→4× flip would emit a spurious immediate tick.
    this.accumulatorMs = 0;
  }

  /**
   * SPEC §5 / C1: backgrounding is a hard pause. Kept separate from the player's speed
   * so returning to the tab restores whatever they had chosen.
   */
  setSystemPaused(paused: boolean): void {
    if (paused === this.pausedBySystem) return;
    this.pausedBySystem = paused;
    this.accumulatorMs = 0;
  }

  /** Queue a command for the next minute boundary (step() applies commands in stage 1). */
  enqueue(command: Command): void {
    this.pending.push(command);
  }

  /** Advance by wall-clock milliseconds. Returns how many ticks actually ran. */
  advance(elapsedMs: number): number {
    const plan = ticksToRun(this.accumulatorMs, elapsedMs, this.effectiveSpeed);
    this.accumulatorMs = plan.accumulatorMs;
    if (plan.dropped) this.droppedFrames += 1;
    for (let i = 0; i < plan.ticks; i++) this.runOneTick();
    return plan.ticks;
  }

  /** Run exactly one tick regardless of timing — used by tests and by step-through debugging. */
  runOneTick(): SimSnapshot {
    const commands = this.pending;
    this.pending = [];
    const r = step(this.state, commands, this.content);
    this.state = r.next;
    this.lastSnapshot = r.snapshot;
    this.ticksRun += 1;
    if (r.events.length > 0) this.observer.onEvents?.(r.events);
    this.observer.onSnapshot?.(r.snapshot);
    return r.snapshot;
  }
}
