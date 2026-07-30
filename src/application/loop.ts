import {
  buildSnapshot,
  step,
  type Command,
  type CommandOutcome,
  type DomainEvent,
  type SimSnapshot,
} from '../sim/step';
import type { ContentRegistry } from '../sim/content';
import {
  dayNumber,
  minuteOfDay,
  morningCheckMinute,
  targetsFor,
  TICKS_PER_DAY,
} from '../sim/clock';
import { restoreSimState, type SimState } from '../sim/state';
import {
  newSession,
  restoreSession,
  type GameObservation,
  type SessionState,
} from '../game/session';
import { advanceGame, type GameAction } from '../game/tick';
import { dealWrinkleForDay } from '../game/wrinkles';
import { appendDailyStorylet } from '../game/storylets';
import { offerLetterIfDue } from '../game/letter';
import { ForecastCache } from './forecast-cache';
import { composeSnapshot, type GameSnapshot } from './snapshot';
import {
  DEFAULT_SIM_RULES,
  restoreSimRules,
  type SimRules,
} from '../sim/rules';
import type { CareerPayload } from './career-state';
import {
  PrngSnapshotSchema,
  PrngStreams,
  type PrngSnapshot,
} from '../sim/prng';

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
  onBoundary?: (boundary: CompletedBoundary) => void;
  /** Lifecycle changes only; countdown frames do not force React re-renders. */
  onUndoToast?: (toast: UndoToast | null) => void;
}

export interface CompletedBoundary {
  events: readonly DomainEvent[];
  outcomes: readonly CommandOutcome[];
  actions: readonly GameAction[];
  observation: GameObservation;
  /** A pure pre-sim game reducer announced today's saved wrinkle. */
  wrinkleDealt?: boolean;
}

export interface LoopOptions {
  /** Product setting seam; live play defaults on, deterministic watched-day tools opt out. */
  sleepSkipEnabled?: boolean;
  /** Announced mechanical truth shared by live step and forecast. */
  simRules?: SimRules;
  /** Called exactly once for each complete minute boundary. */
  simRulesForBoundary?: (
    sim: SimState,
    session: SessionState,
  ) => SimRules;
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
  private sessionState: SessionState;
  private readonly initialSessionState: SessionState;
  private prngState: PrngSnapshot;
  private readonly initialPrngState: PrngSnapshot;
  private readonly initialPending: Command[];
  private readonly initialPendingActions: GameAction[];
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
  private simRules: SimRules;
  private sleepSkipEnabledValue: boolean;

  constructor(
    initial: SimState | CareerPayload,
    private readonly content: ContentRegistry,
    private readonly observer: LoopObserver = {},
    private readonly options: LoopOptions = {},
  ) {
    const career =
      'sim' in initial && 'game' in initial ? initial : null;
    const initialSim = restoreSimState(
      JSON.parse(JSON.stringify(career?.sim ?? initial)),
    );
    if (
      career !== null &&
      initialSim.removalReceipt !== null &&
      !career.pendingCommands.some(
        (command) =>
          command.type === 'undoLastRemove' &&
          command.receiptId === initialSim.removalReceipt?.id,
      )
    ) {
      initialSim.removalReceipt = null;
    }
    this.simRules = restoreSimRules(
      JSON.parse(
        JSON.stringify(options.simRules ?? DEFAULT_SIM_RULES),
      ),
    );
    this.sleepSkipEnabledValue = options.sleepSkipEnabled !== false;
    this.initialState = restoreSimState(
      JSON.parse(JSON.stringify(initialSim)),
    );
    this.state = restoreSimState(JSON.parse(JSON.stringify(initialSim)));
    const restoredInitialSession = restoreSession(
      JSON.parse(JSON.stringify(career?.game ?? newSession())),
    );
    const initialGame = offerLetterIfDue(
      restoredInitialSession,
      dayNumber(initialSim.clock.absoluteMinute),
    );
    this.initialSessionState = restoreSession(
      JSON.parse(JSON.stringify(initialGame)),
    );
    this.sessionState = restoreSession(
      JSON.parse(JSON.stringify(this.initialSessionState)),
    );
    this.initialPrngState = PrngSnapshotSchema.parse(
      JSON.parse(
        JSON.stringify(
          career?.prng ?? PrngStreams.create(0).serialize(),
        ),
      ),
    );
    this.prngState = PrngSnapshotSchema.parse(
      JSON.parse(JSON.stringify(this.initialPrngState)),
    );
    this.initialPending = JSON.parse(
      JSON.stringify(career?.pendingCommands ?? []),
    ) as Command[];
    this.initialPendingActions = JSON.parse(
      JSON.stringify(career?.pendingGameActions ?? []),
    ) as GameAction[];
    this.pending = JSON.parse(JSON.stringify(this.initialPending)) as Command[];
    this.pendingActions = JSON.parse(
      JSON.stringify(this.initialPendingActions),
    ) as GameAction[];
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

  /** Application-owned deterministic streams, exposed only for save composition. */
  peekPrng(): PrngSnapshot {
    return PrngSnapshotSchema.parse(
      JSON.parse(JSON.stringify(this.prngState)),
    );
  }

  /**
   * One complete deterministic checkpoint. Presentation-only state such as
   * interpolation, speed, open panels, and the Undo toast stays outside it.
   */
  exportCareerPayload(base: CareerPayload): CareerPayload {
    const pending = this.pendingBoundaryWork;
    return {
      ...JSON.parse(JSON.stringify(base)) as CareerPayload,
      sim: restoreSimState(JSON.parse(JSON.stringify(this.state))),
      game: restoreSession(JSON.parse(JSON.stringify(this.sessionState))),
      prng: this.peekPrng(),
      pendingCommands: pending.commands,
      pendingGameActions: pending.actions,
    };
  }

  /** Accepted work waiting for the next complete minute boundary. */
  get pendingBoundaryWork(): {
    commands: Command[];
    actions: GameAction[];
  } {
    return {
      commands: JSON.parse(JSON.stringify(this.pending)) as Command[],
      actions: JSON.parse(
        JSON.stringify(this.pendingActions),
      ) as GameAction[],
    };
  }

  setSpeed(speed: Speed): void {
    if (speed === this.speedValue) return; // idempotent: mashing a button must not stall the clock
    this.retimeTo(speed === 0 ? 0 : speed);
    this.speedValue = speed;
    this.rebuildAccumulator();
    if (speed === 0) this.flushPlayerPausedCommands();
  }

  setSleepSkipEnabled(enabled: boolean): void {
    this.sleepSkipEnabledValue = enabled;
    this.syncSleepSkipCandidate();
  }

  /** Refresh announced policy and the forecast without advancing a minute. */
  setSimRules(rules: SimRules): void {
    this.simRules = restoreSimRules(
      JSON.parse(JSON.stringify(rules)),
    );
    this.lastSnapshot = this.compose(this.lastSimSnapshot);
    this.observer.onSnapshot?.(this.lastSnapshot);
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

  /** Queue a command for the next minute boundary, or apply it now during a player pause. */
  enqueue(command: Command): void {
    this.pending.push(command);
    this.flushPlayerPausedCommands();
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
    this.flushPlayerPausedCommands();
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
    this.sessionState = restoreSession(
      JSON.parse(JSON.stringify(this.initialSessionState)),
    );
    this.prngState = PrngSnapshotSchema.parse(
      JSON.parse(JSON.stringify(this.initialPrngState)),
    );
    this.forecastCache.reset();
    this.commitmentRevision = 0;
    this.accumulatorMs = 0;
    this.speedValue = 1;
    this.pausedBySystem = false;
    this.pending = JSON.parse(JSON.stringify(this.initialPending)) as Command[];
    this.pendingActions = JSON.parse(
      JSON.stringify(this.initialPendingActions),
    ) as GameAction[];
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
    if (this.isLetterDue()) return 0;
    const plan = ticksToRun(this.accumulatorMs, elapsedMs, this.effectiveSpeed);
    this.accumulatorMs = plan.accumulatorMs;
    if (plan.dropped) this.droppedFrames += 1;
    let watchedTicks = 0;
    for (let i = 0; i < plan.ticks; i++) {
      this.runOneTickInternal(true);
      watchedTicks += 1;
      if (this.isLetterDue()) break;
    }
    const skippedTicks =
      !this.isLetterDue() &&
      this.sleepSkipIdleMsValue >= SLEEP_SKIP_IDLE_MS
        ? this.skipNightToWake()
        : 0;
    return watchedTicks + skippedTicks;
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

  /**
   * A player pause freezes time, not planning. Apply queue commands through
   * stage 1 only so the rail and forecast respond immediately while every
   * time-bearing system remains unchanged. A system/background pause retains
   * pending input for the next foreground boundary.
   */
  private flushPlayerPausedCommands(): void {
    if (
      this.speedValue !== 0 ||
      this.pausedBySystem ||
      this.isLetterDue() ||
      this.pending.length === 0
    ) {
      return;
    }
    const commands = this.pending;
    this.pending = [];
    const result = step(
      this.state,
      commands,
      this.content,
      this.simRules,
      { commandsOnly: true },
    );
    this.state = result.next;
    this.applyCommandOutcomes(result.outcomes, true);
    const observation = this.gameObservation();
    this.sessionState = advanceGame(
      this.sessionState,
      result.events,
      [],
      result.outcomes,
      observation,
      this.content,
      {
        autonomy: this.simRules.autonomy,
        practicePoints100: this.state.practice.points100,
      },
    ).session;
    this.lastSimSnapshot = result.snapshot;
    this.lastSnapshot = this.compose(result.snapshot);
    this.syncSleepSkipCandidate();
    this.observer.onBoundary?.({
      events: result.events,
      outcomes: result.outcomes,
      actions: [],
      observation,
    });
    if (result.events.length > 0) {
      this.observer.onEvents?.(result.events);
    }
    this.observer.onSnapshot?.(this.lastSnapshot);
  }

  /** Run exactly one tick regardless of timing — used by tests and by step-through debugging. */
  runOneTick(): GameSnapshot {
    if (
      this.sessionState.letter.status === 'due' &&
      !this.pendingActions.some(
        (action) => action.type === 'letterResponded',
      )
    ) {
      return this.lastSnapshot;
    }
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
    if (
      this.sleepSkipCandidateKey === null ||
      this.isLetterDue()
    ) {
      return 0;
    }

    const wakeTarget = targetsFor(this.state.chronotype, this.content.rates).wake;
    const now = minuteOfDay(this.state.clock.absoluteMinute);
    const ticksToWake = (wakeTarget - now + TICKS_PER_DAY) % TICKS_PER_DAY;
    if (ticksToWake === 0) return 0;

    const events: DomainEvent[] = [];
    let undoToastChanged = false;
    let ticksRun = 0;
    for (let i = 0; i < ticksToWake; i++) {
      const tick = this.runOneTickInternal(false);
      ticksRun += 1;
      events.push(...tick.events);
      undoToastChanged = undoToastChanged || tick.undoToastChanged;
      if (this.isLetterDue()) break;
    }

    if (undoToastChanged) this.observer.onUndoToast?.(this.undoToastState);
    if (events.length > 0) this.observer.onEvents?.(events);
    this.observer.onSnapshot?.(this.lastSnapshot);
    return ticksRun;
  }

  private runOneTickInternal(publish: boolean): {
    snapshot: GameSnapshot;
    events: readonly DomainEvent[];
    undoToastChanged: boolean;
  } {
    const prepared = dealWrinkleForDay(
      this.sessionState,
      this.prngState,
      dayNumber(this.state.clock.absoluteMinute),
      this.content,
    );
    const boundarySession = prepared.session;
    if (this.options.simRulesForBoundary !== undefined) {
      this.simRules = restoreSimRules(
        this.options.simRulesForBoundary(this.state, boundarySession),
      );
    }
    const commands = [
      ...this.gameCommandsForCurrentTick(),
      ...this.pending,
    ];
    this.pending = [];
    const actions = this.pendingActions;
    this.pendingActions = [];
    const r = step(this.state, commands, this.content, this.simRules);
    this.state = r.next;
    this.prngState = prepared.prng;
    const undoToastChanged = this.applyCommandOutcomes(r.outcomes, publish);
    const observation = this.gameObservation();
    // Phase 3 of the top-level tick (see game/tick.ts): fold this tick's events into the
    // session *before* publishing, so an observer never sees a snapshot whose session has
    // not caught up with it.
    const advancedGame = advanceGame(
      boundarySession,
      r.events,
      actions,
      r.outcomes,
      observation,
      this.content,
      {
        autonomy: this.simRules.autonomy,
        practicePoints100: this.state.practice.points100,
      },
    ).session;
    const storylet = appendDailyStorylet(
      advancedGame,
      this.prngState,
      r.events,
      observation,
      this.content,
    );
    this.sessionState = storylet.session;
    this.prngState = storylet.prng;
    this.lastSimSnapshot = r.snapshot;
    this.lastSnapshot = this.compose(r.snapshot);
    this.ticksRun += 1;
    this.syncSleepSkipCandidate();
    this.observer.onBoundary?.({
      events: r.events,
      outcomes: r.outcomes,
      actions,
      observation,
      wrinkleDealt: prepared.changed,
    });
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
      this.simRules,
    );
    return composeSnapshot(snapshot, cached, this.sessionState);
  }

  private gameObservation(): GameObservation {
    const currentActivityId = (() => {
      if (this.state.current === null) return null;
      if (this.state.current.type === 'activity') {
        return this.state.current.dto.activityId;
      }
      if (this.state.current.type === 'sleep') return 'sleep';
      return (
        this.state.queue.find(
          (card) => card.id === this.state.current?.cardId,
        )?.activityId ?? null
      );
    })();
    const currentMinuteOfDay = minuteOfDay(
      this.state.clock.absoluteMinute,
    );
    return Object.freeze({
      day: dayNumber(this.state.clock.absoluteMinute),
      absoluteMinute: this.state.clock.absoluteMinute,
      minuteOfDay: currentMinuteOfDay,
      isMidnight: currentMinuteOfDay === 0,
      isMorningCheck:
        currentMinuteOfDay ===
        morningCheckMinute(this.state.chronotype, this.content.rates),
      bars: Object.freeze({ ...this.state.bars }),
      currentActivityId,
      urgentCount: this.state.events.urgentCount,
    });
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
    if (!this.sleepSkipEnabledValue) return null;
    if (this.isLetterDue()) return null;
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

  private isLetterDue(): boolean {
    return this.sessionState.letter.status === 'due';
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
