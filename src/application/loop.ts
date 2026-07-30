import {
  buildSnapshot,
  step,
  type Command,
  type CommandOutcome,
  type DomainEvent,
  type SimSnapshot,
} from '../sim/step';
import type { ContentRegistry } from '../sim/content';
import { dayNumber, minuteOfDay, targetsFor, TICKS_PER_DAY } from '../sim/clock';
import { restoreSimState, type SimState } from '../sim/state';
import { newSession, resetSession as resetGameSession, type SessionState } from '../game/session';
import { advanceGame, type GameAction } from '../game/tick';
import { ForecastCache } from './forecast-cache';
import { composeSnapshot, type GameSnapshot } from './snapshot';

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
/** SPEC §11.4: active, foreground presentation time before a night sleep dissolves. */
export const SLEEP_SKIP_IDLE_MS = 10_000;
const NIGHT_SLEEP_START_MINUTE = 21 * 60;
const DAY_ONE_PACKAGE_MINUTE = 10 * 60;
const DAY_ONE_PACKAGE_ID = 'package-delivery';

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
  onSnapshot?: (snapshot: GameSnapshot) => void;
  onEvents?: (events: readonly DomainEvent[]) => void;
  /** Lifecycle changes only; countdown frames do not force React re-renders. */
  onUndoToast?: (toast: UndoToast | null) => void;
}

export interface LoopOptions {
  /** Product setting seam; live play defaults on, deterministic watched-day tools opt out. */
  sleepSkipEnabled?: boolean;
}

export interface UndoToast {
  receiptId: string;
  remainingMs: number;
}

/**
 * Owns the live simulation. Never reads a clock itself — `advance(elapsedMs)` is called
 * by whatever is driving frames (requestAnimationFrame in the app, a test loop in Jest).
 */
export class GameLoop {
  private state: SimState;
  private readonly initialState: SimState;
  private sessionState: SessionState = newSession();
  private readonly forecastCache = new ForecastCache();
  private commitmentRevision = 0;
  private accumulatorMs = 0;
  private speedValue: Speed = 1;
  private pausedBySystem = false;
  private pending: Command[] = [];
  private pendingActions: GameAction[] = [];
  private undoToastState: UndoToast | null = null;
  private lastSimSnapshot: SimSnapshot;
  private lastSnapshot: GameSnapshot;
  private droppedFrames = 0;
  private ticksRun = 0;
  private frozenAlpha = 0;
  private sleepSkipIdleMsValue = 0;
  private sleepSkipCandidateKey: string | null = null;

  constructor(
    initial: SimState,
    private readonly content: ContentRegistry,
    private readonly observer: LoopObserver = {},
    private readonly options: LoopOptions = {},
  ) {
    this.initialState = restoreSimState(JSON.parse(JSON.stringify(initial)));
    this.state = restoreSimState(JSON.parse(JSON.stringify(initial)));
    // The renderer must always have something to draw: the world exists at t=0, and a
    // game opened paused would otherwise show a blank screen until the first tick.
    this.lastSimSnapshot = buildSnapshot(this.state, content);
    this.lastSnapshot = this.compose(this.lastSimSnapshot);
    this.syncSleepSkipCandidate();
  }

  get speed(): Speed {
    return this.speedValue;
  }

  /** The speed actually in effect — system pause (backgrounding) overrides the player's choice. */
  get effectiveSpeed(): Speed {
    return this.pausedBySystem ? 0 : this.speedValue;
  }

  get snapshot(): GameSnapshot {
    return this.lastSnapshot;
  }

  /** The `game/` half of the top-level tick — goal progress, wrinkles, decorations, recap. */
  get session(): SessionState {
    return this.sessionState;
  }

  get stats(): { ticksRun: number; droppedFrames: number; accumulatorMs: number } {
    return { ticksRun: this.ticksRun, droppedFrames: this.droppedFrames, accumulatorMs: this.accumulatorMs };
  }

  /** Application-owned real-time presentation state; the canonical receipt is in sim/. */
  get undoToast(): UndoToast | null {
    return this.undoToastState;
  }

  /** Application-owned real time, exposed for reset and timing evidence only. */
  get sleepSkipIdleMs(): number {
    return this.sleepSkipIdleMsValue;
  }

  /** Exposed for tests and evidence digests only. The UI reads snapshots, never this. */
  peekState(): SimState {
    return this.state;
  }

  setSpeed(speed: Speed): void {
    if (speed === this.speedValue) return; // idempotent: mashing a button must not stall the clock
    this.retimeTo(speed === 0 ? 0 : speed);
    this.speedValue = speed;
    this.rebuildAccumulator();
  }

  /**
   * Partial-tick progress is carried as NORMALISED alpha across every rate change,
   * including pause.
   *
   * Three faults lived here across two adversarial passes:
   *  - pass 2: `setSpeed` zeroed the accumulator, so pausing at 499 ms rewound
   *    interpolation, and (because the UI calls setSpeed on every press) mashing the
   *    already-active speed reset progress forever and the clock never advanced;
   *  - pass 4 (BLOCKER): rescaling used `msPerTick(effectiveSpeed)`, which is Infinity
   *    while paused, so the rescale silently no-opped and the RAW millisecond count
   *    survived. 400 ms banked at 1×, then Pause, then 4× left 400 ms against a 125 ms
   *    tick — the next `advance(0)` ran **three ticks the player never saw**, and alpha
   *    jumped 0.8 → 0 → 1.
   *
   * Freezing alpha on the way out and rebuilding milliseconds from it on the way in
   * makes the carried quantity rate-independent, which is the only form that survives a
   * pause.
   */
  private retimeTo(_next: Speed): void {
    this.frozenAlpha = this.alpha;
  }

  private rebuildAccumulator(): void {
    const per = msPerTick(this.effectiveSpeed);
    this.accumulatorMs = Number.isFinite(per) ? this.frozenAlpha * per : 0;
  }

  /** Progress through the current tick, 0..1 — the renderer's interpolation alpha. */
  get alpha(): number {
    const per = msPerTick(this.effectiveSpeed);
    if (!Number.isFinite(per) || per <= 0) return this.frozenAlpha;
    return Math.min(1, Math.max(0, this.accumulatorMs / per));
  }

  /**
   * SPEC §5 / C1: backgrounding is a hard pause. Kept separate from the player's speed
   * so returning to the tab restores whatever they had chosen.
   */
  setSystemPaused(paused: boolean): void {
    if (paused === this.pausedBySystem) return;
    // Same carry as setSpeed: freeze normalised progress, then rebuild milliseconds at
    // whatever rate is in effect afterwards.
    this.retimeTo(this.speedValue);
    this.pausedBySystem = paused;
    this.rebuildAccumulator();
  }

  /** Queue a command for the next minute boundary (step() applies commands in stage 1). */
  enqueue(command: Command): void {
    this.pending.push(command);
  }

  /** Queue a serializable UI observation for the next top-level game tick. */
  enqueueAction(action: GameAction): void {
    this.pendingActions.push(action);
  }

  /**
   * Any real player input restarts §11.4's quiet-time gate.
   *
   * Kept separate from queue commands because not every input mutates the sim
   * (opening details, moving focus, or tapping a speed already selected still counts).
   */
  notePlayerInput(): void {
    this.sleepSkipIdleMsValue = 0;
  }

  /** The only UI entry point for undo: an opaque, still-visible receipt id. */
  undoLastRemove(receiptId: string): boolean {
    if (this.undoToastState?.receiptId !== receiptId || this.undoToastState.remainingMs <= 0) {
      return false;
    }
    this.undoToastState = null;
    this.observer.onUndoToast?.(null);
    this.pending.push({ type: 'undoLastRemove', receiptId });
    return true;
  }

  /**
   * Commitment materialization is later, but §7.5 makes an accepted commitment
   * change a forecast trigger now. Recompose immediately so callers never need a
   * dummy sim tick to see the new forecast.
   */
  notifyCommitmentsChanged(): GameSnapshot {
    this.commitmentRevision += 1;
    this.lastSnapshot = this.compose(this.lastSimSnapshot);
    this.observer.onSnapshot?.(this.lastSnapshot);
    return this.lastSnapshot;
  }

  /**
   * Deterministic run reset, extended at T3 with the forecast cache and loop-owned
   * state introduced so far. Later P4 tasks extend this same boundary.
   */
  reset(): GameSnapshot {
    this.state = restoreSimState(JSON.parse(JSON.stringify(this.initialState)));
    this.sessionState = resetGameSession();
    this.forecastCache.reset();
    this.commitmentRevision = 0;
    this.accumulatorMs = 0;
    this.speedValue = 1;
    this.pausedBySystem = false;
    this.pending = [];
    this.pendingActions = [];
    this.undoToastState = null;
    this.observer.onUndoToast?.(null);
    this.droppedFrames = 0;
    this.ticksRun = 0;
    this.frozenAlpha = 0;
    this.sleepSkipIdleMsValue = 0;
    this.sleepSkipCandidateKey = null;
    this.lastSimSnapshot = buildSnapshot(this.state, this.content);
    this.lastSnapshot = this.compose(this.lastSimSnapshot);
    this.syncSleepSkipCandidate();
    this.observer.onSnapshot?.(this.lastSnapshot);
    return this.lastSnapshot;
  }

  /** Advance by wall-clock milliseconds. Returns how many ticks actually ran. */
  advance(elapsedMs: number): number {
    this.elapsePresentationTime(elapsedMs);
    const plan = ticksToRun(this.accumulatorMs, elapsedMs, this.effectiveSpeed);
    this.accumulatorMs = plan.accumulatorMs;
    if (plan.dropped) this.droppedFrames += 1;
    for (let i = 0; i < plan.ticks; i++) this.runOneTick();
    const skippedTicks =
      this.sleepSkipIdleMsValue >= SLEEP_SKIP_IDLE_MS
        ? this.skipNightToWake()
        : 0;
    return plan.ticks + skippedTicks;
  }

  /**
   * Advance application-owned wall-clock effects without advancing the sim.
   *
   * A hidden browser tab has no dependable animation frames. The composition root
   * hands the whole hidden interval here on resume so the five-second Undo window
   * remains real time while game time stays hard-paused.
   */
  elapsePresentationTime(elapsedMs: number): void {
    this.elapseUndoToast(elapsedMs);
    this.elapseSleepSkipIdle(elapsedMs);
  }

  /** Run exactly one tick regardless of timing — used by tests and by step-through debugging. */
  runOneTick(): GameSnapshot {
    return this.runOneTickInternal(true).snapshot;
  }

  /**
   * §11.4's named batch boundary.
   *
   * This deliberately does not call `advance()`: that entry point caps a frame at
   * eight ticks and drops the rest. Instead, every minute to the next wake target
   * runs through the same sim → game → composed-snapshot tick as watched play.
   * Only observer publication is coalesced.
   */
  skipNightToWake(): number {
    this.syncSleepSkipCandidate();
    if (this.sleepSkipCandidateKey === null) return 0;

    const wakeTarget = targetsFor(this.state.chronotype, this.content.rates).wake;
    const now = minuteOfDay(this.state.clock.absoluteMinute);
    const ticksToWake = (wakeTarget - now + TICKS_PER_DAY) % TICKS_PER_DAY;
    if (ticksToWake === 0) return 0;

    const events: DomainEvent[] = [];
    let undoToastChanged = false;
    for (let i = 0; i < ticksToWake; i++) {
      const tick = this.runOneTickInternal(false);
      events.push(...tick.events);
      undoToastChanged = undoToastChanged || tick.undoToastChanged;
    }

    if (undoToastChanged) this.observer.onUndoToast?.(this.undoToastState);
    if (events.length > 0) this.observer.onEvents?.(events);
    this.observer.onSnapshot?.(this.lastSnapshot);
    return ticksToWake;
  }

  private runOneTickInternal(publish: boolean): {
    snapshot: GameSnapshot;
    events: readonly DomainEvent[];
    undoToastChanged: boolean;
  } {
    const commands = [
      ...this.gameCommandsForCurrentTick(),
      ...this.pending,
    ];
    this.pending = [];
    const actions = this.pendingActions;
    this.pendingActions = [];
    const r = step(this.state, commands, this.content);
    this.state = r.next;
    const undoToastChanged = this.applyCommandOutcomes(r.outcomes, publish);
    // Phase 3 of the top-level tick (see game/tick.ts): fold this tick's events into the
    // session *before* publishing, so an observer never sees a snapshot whose session has
    // not caught up with it.
    this.sessionState = advanceGame(
      this.sessionState,
      r.events,
      actions,
      r.outcomes,
    ).session;
    this.lastSimSnapshot = r.snapshot;
    this.lastSnapshot = this.compose(r.snapshot);
    this.ticksRun += 1;
    this.syncSleepSkipCandidate();
    if (publish) {
      if (r.events.length > 0) this.observer.onEvents?.(r.events);
      this.observer.onSnapshot?.(this.lastSnapshot);
    }
    return {
      snapshot: this.lastSnapshot,
      events: r.events,
      undoToastChanged,
    };
  }

  private compose(snapshot: SimSnapshot): GameSnapshot {
    const cached = this.forecastCache.read(
      this.state,
      this.content,
      this.commitmentRevision,
    );
    return composeSnapshot(snapshot, cached, this.sessionState);
  }

  /**
   * Phase 1 of the top-level tick: deterministic game-owned commands enter before
   * the sim step. Day 1's 10:00 package is scripted by §9.4, so it reads no PRNG.
   */
  private gameCommandsForCurrentTick(): Command[] {
    if (
      dayNumber(this.state.clock.absoluteMinute) !== 1 ||
      minuteOfDay(this.state.clock.absoluteMinute) !== DAY_ONE_PACKAGE_MINUTE ||
      this.sessionState.wrinkles.firedIds.includes(DAY_ONE_PACKAGE_ID) ||
      this.pending.some(
        (command) =>
          command.type === 'insertWrinkle' &&
          command.wrinkleId === DAY_ONE_PACKAGE_ID,
      ) ||
      !this.content.activities.activities.some(
        (activity) => activity.id === 'package',
      )
    ) {
      return [];
    }
    return [{
      type: 'insertWrinkle',
      wrinkleId: DAY_ONE_PACKAGE_ID,
      activityId: 'package',
    }];
  }

  private elapseUndoToast(elapsedMs: number): void {
    if (
      this.undoToastState === null ||
      !Number.isFinite(elapsedMs) ||
      elapsedMs <= 0
    ) {
      return;
    }
    const remainingMs = this.undoToastState.remainingMs - elapsedMs;
    if (remainingMs > 0) {
      this.undoToastState = Object.freeze({
        receiptId: this.undoToastState.receiptId,
        remainingMs,
      });
      return;
    }
    const receiptId = this.undoToastState.receiptId;
    this.undoToastState = null;
    this.observer.onUndoToast?.(null);
    // Expiry is presentation-time, but the canonical engine receipt must also
    // become unusable. Put this before every user command at the next boundary.
    this.pending.unshift({ type: 'expireRemovalReceipt', receiptId });
  }

  private sleepSkipKeyForCurrentState(): string | null {
    if (this.options.sleepSkipEnabled === false) return null;
    if (this.state.current?.type !== 'sleep') return null;

    const wakeTarget = targetsFor(this.state.chronotype, this.content.rates).wake;
    const minute = minuteOfDay(this.state.clock.absoluteMinute);
    const isNight =
      minute >= NIGHT_SLEEP_START_MINUTE ||
      minute < wakeTarget;
    if (!isNight) return null;

    // A running urgent sleep is the sleep being skipped, not urgency waiting in
    // the queue. Any other urgent card keeps the player in watched mode.
    const currentCardId = this.state.current.cardId;
    if (
      this.state.queue.some(
        (card) => card.urgent && card.id !== currentCardId,
      )
    ) {
      return null;
    }
    return `sleep:${currentCardId ?? 'detached'}`;
  }

  private syncSleepSkipCandidate(): void {
    const nextKey = this.sleepSkipKeyForCurrentState();
    if (nextKey !== this.sleepSkipCandidateKey) {
      this.sleepSkipCandidateKey = nextKey;
      this.sleepSkipIdleMsValue = 0;
    } else if (nextKey === null) {
      this.sleepSkipIdleMsValue = 0;
    }
  }

  private elapseSleepSkipIdle(elapsedMs: number): void {
    this.syncSleepSkipCandidate();
    if (
      this.sleepSkipCandidateKey === null ||
      this.effectiveSpeed === 0 ||
      !Number.isFinite(elapsedMs) ||
      elapsedMs <= 0
    ) {
      return;
    }
    this.sleepSkipIdleMsValue = Math.min(
      SLEEP_SKIP_IDLE_MS,
      this.sleepSkipIdleMsValue + elapsedMs,
    );
  }

  private applyCommandOutcomes(
    outcomes: readonly CommandOutcome[],
    publish: boolean,
  ): boolean {
    let changed = false;
    for (const outcome of outcomes) {
      if (
        outcome.type === 'removeCard' &&
        outcome.status === 'accepted' &&
        outcome.effect === 'removed'
      ) {
        this.undoToastState = Object.freeze({
          receiptId: outcome.receiptId,
          remainingMs: 5000,
        });
        changed = true;
        if (publish) this.observer.onUndoToast?.(this.undoToastState);
      } else if (outcome.type === 'undoLastRemove') {
        this.undoToastState = null;
        changed = true;
        if (publish) this.observer.onUndoToast?.(null);
      } else if (
        outcome.type === 'expireRemovalReceipt' &&
        outcome.status === 'accepted' &&
        this.undoToastState?.receiptId === outcome.receiptId
      ) {
        this.undoToastState = null;
        changed = true;
        if (publish) this.observer.onUndoToast?.(null);
      }
    }
    return changed;
  }
}
