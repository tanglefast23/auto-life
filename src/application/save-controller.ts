import type { CommandOutcome, DomainEvent } from '../sim/step';
import type { GameAction } from '../game/tick';
import type { GameObservation } from '../game/session';
import type { CareerRepository } from './career-repository';
import type { StoredCareer } from './career-state';
import type { CompletedBoundary } from './loop';

export type SaveReason =
  | 'activity-completion'
  | 'queue-edit'
  | 'day-boundary'
  | 'wrinkle-deal'
  | 'periodic'
  | 'visibility-hidden'
  | 'pagehide'
  | 'major-decision'
  | 'return-to-title';

export interface SaveScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserScheduler: SaveScheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) =>
    globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const ORDINARY_COALESCE_MS = 5_000;
const QUEUE_DEBOUNCE_MS = 500;
const PERIODIC_MS = 60_000;

/**
 * Turns semantic game outcomes into complete-boundary career writes. It never
 * compares UI snapshots, and it samples the career only when the serialized
 * write actually begins.
 */
export class CareerSaveController {
  private queueTimer: unknown | null = null;
  private ordinaryTimer: unknown | null = null;
  private periodicTimer: unknown | null = null;
  private lastSavedAt: number;
  private stopped = false;
  private writeTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: Pick<
      CareerRepository,
      'save' | 'saveBarrier'
    >,
    private readonly getCareer: () => StoredCareer | null,
    private readonly onSaved: (
      career: StoredCareer,
      reason: SaveReason,
    ) => void,
    private readonly onError: (
      error: unknown,
      reason: SaveReason,
    ) => void,
    private readonly scheduler: SaveScheduler = browserScheduler,
  ) {
    this.lastSavedAt = getCareer()?.savedAtEpochMs ?? 0;
  }

  start(): void {
    if (this.stopped) return;
    this.schedulePeriodic();
  }

  stop(): void {
    this.stopped = true;
    this.clearQueueTimer();
    this.clearOrdinaryTimer();
    if (this.periodicTimer !== null) {
      this.scheduler.clearTimeout(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  observeBoundary(boundary: CompletedBoundary): void {
    if (hasAcceptedQueueEdit(boundary.outcomes)) {
      this.requestQueueEdit();
    }
    if (
      boundary.events.some(
        (event) => event.type === 'activityCompleted',
      )
    ) {
      this.requestOrdinary('activity-completion');
    }
    if (
      boundary.observation.isMidnight ||
      boundary.events.some((event) => event.type === 'wakeBoundary')
    ) {
      this.requestOrdinary('day-boundary');
    }
    if (boundary.wrinkleDealt === true) {
      this.requestOrdinary('wrinkle-deal');
    }
    if (boundary.actions.some(isMajorAction)) {
      this.requestImmediate('major-decision');
    }
  }

  requestQueueEdit(): void {
    if (this.stopped) return;
    this.clearQueueTimer();
    this.queueTimer = this.scheduler.setTimeout(() => {
      this.queueTimer = null;
      this.requestOrdinary('queue-edit');
    }, QUEUE_DEBOUNCE_MS);
  }

  requestOrdinary(reason: Exclude<
    SaveReason,
    | 'visibility-hidden'
    | 'pagehide'
    | 'major-decision'
    | 'return-to-title'
  >): void {
    if (this.stopped) return;
    const delay = Math.max(
      0,
      this.lastSavedAt + ORDINARY_COALESCE_MS - this.scheduler.now(),
    );
    if (delay === 0) {
      this.clearOrdinaryTimer();
      this.enqueueWrite(reason, false);
      return;
    }
    if (this.ordinaryTimer !== null) return;
    this.ordinaryTimer = this.scheduler.setTimeout(() => {
      this.ordinaryTimer = null;
      this.enqueueWrite(reason, false);
    }, delay);
  }

  requestImmediate(
    reason:
      | 'major-decision'
      | 'return-to-title'
      | 'visibility-hidden'
      | 'pagehide',
  ): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false);
    this.clearQueueTimer();
    this.clearOrdinaryTimer();
    return this.enqueueWrite(
      reason,
      reason === 'visibility-hidden' ||
        reason === 'pagehide' ||
        reason === 'return-to-title',
    );
  }

  whenIdle(): Promise<void> {
    return this.writeTail;
  }

  private enqueueWrite(
    reason: SaveReason,
    barrier: boolean,
  ): Promise<boolean> {
    const work = async () => {
      const career = this.getCareer();
      if (career === null || this.stopped) return false;
      try {
        const saved = barrier
          ? await this.repository.saveBarrier(
              career,
              this.scheduler.now(),
            )
          : await this.repository.save(career, this.scheduler.now());
        this.lastSavedAt = saved.savedAtEpochMs;
        this.onSaved(saved, reason);
        return true;
      } catch (error) {
        this.onError(error, reason);
        return false;
      }
    };
    const result = this.writeTail.then(work, work);
    this.writeTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private schedulePeriodic(): void {
    this.periodicTimer = this.scheduler.setTimeout(() => {
      this.periodicTimer = null;
      if (this.stopped) return;
      this.requestOrdinary('periodic');
      this.schedulePeriodic();
    }, PERIODIC_MS);
  }

  private clearQueueTimer(): void {
    if (this.queueTimer === null) return;
    this.scheduler.clearTimeout(this.queueTimer);
    this.queueTimer = null;
  }

  private clearOrdinaryTimer(): void {
    if (this.ordinaryTimer === null) return;
    this.scheduler.clearTimeout(this.ordinaryTimer);
    this.ordinaryTimer = null;
  }
}

function hasAcceptedQueueEdit(
  outcomes: readonly CommandOutcome[],
): boolean {
  return outcomes.some(
    (outcome) =>
      outcome.status === 'accepted' &&
      (
        outcome.type === 'insertPlayer' ||
        outcome.type === 'objectClick' ||
        outcome.type === 'moveCard' ||
        outcome.type === 'removeCard' ||
        outcome.type === 'undoLastRemove'
      ),
  );
}

function isMajorAction(action: GameAction): boolean {
  return (
    action.type === 'decorationChosen' ||
    action.type === 'goalRewardChosen' ||
    action.type === 'intentionSelected' ||
    action.type === 'wrinkleAction' ||
    action.type === 'letterResponded'
  );
}

export function saveReasonForBoundary(
  events: readonly DomainEvent[],
  actions: readonly GameAction[],
  observation: GameObservation,
): SaveReason | null {
  if (actions.some(isMajorAction)) return 'major-decision';
  if (
    observation.isMidnight ||
    events.some((event) => event.type === 'wakeBoundary')
  ) {
    return 'day-boundary';
  }
  if (events.some((event) => event.type === 'activityCompleted')) {
    return 'activity-completion';
  }
  return null;
}
