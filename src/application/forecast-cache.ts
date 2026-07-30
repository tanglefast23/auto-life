import { forecast, type ForecastResult } from '../sim/forecast';
import type { ContentRegistry } from '../sim/content';
import type { SimState } from '../sim/state';
import { DEFAULT_SIM_RULES, type SimRules } from '../sim/rules';

export type ForecastComputer = (
  state: SimState,
  content: ContentRegistry,
  rules: SimRules,
) => ForecastResult;

export interface ForecastCacheValue {
  forecast: ForecastResult;
  /** Monotonic within one session; reset starts again at 1. */
  revision: number;
}

/**
 * §7.5's exact refresh policy. Forecasting can run hundreds of deterministic
 * ticks, so ordinary render ticks reuse the result. The key changes only when:
 *
 * - the queue/schedule itself changes;
 * - accepted commitments change; or
 * - the game clock enters a new hour.
 *
 * The signature is derived from canonical sim state rather than UI actions. That
 * means planner enqueue/cleanup, completion, stop, wrinkle insertion, remove and
 * later undo all invalidate without every caller remembering to "mark dirty".
 */
export class ForecastCache {
  private key: string | null = null;
  private value: ForecastCacheValue | null = null;
  private nextRevision = 1;

  constructor(private readonly compute: ForecastComputer = forecast) {}

  read(
    state: SimState,
    content: ContentRegistry,
    commitmentRevision: number,
    rules: SimRules = DEFAULT_SIM_RULES,
  ): ForecastCacheValue {
    const key = cacheKey(state, commitmentRevision, rules.key, rules.revision);
    if (key === this.key && this.value !== null) return this.value;

    const value = Object.freeze({
      forecast: this.compute(state, content, rules),
      revision: this.nextRevision++,
    });
    this.key = key;
    this.value = value;
    return value;
  }

  reset(): void {
    this.key = null;
    this.value = null;
    this.nextRevision = 1;
  }
}

function cacheKey(
  state: SimState,
  commitmentRevision: number,
  rulesKey: string,
  rulesRevision: number,
): string {
  const schedule = state.queue.map((card) => ({
    id: card.id,
    activityId: card.activityId,
    owner: card.owner,
    urgent: card.urgent,
    source: card.source,
    reason: card.reason,
    blockId: card.blockId,
    enqueuedTick: card.enqueuedTick,
  }));
  return JSON.stringify({
    schedule,
    currentCardId: state.current?.cardId ?? null,
    commitmentRevision,
    rulesKey,
    rulesRevision,
    gameHour: Math.floor(state.clock.absoluteMinute / 60),
  });
}
