import type {
  ForecastAnnotation,
  ForecastConflict,
  ForecastResult,
  ForecastWakeConflict,
} from '../sim/forecast';
import type { SimQueueCard, SimSnapshot } from '../sim/step';
import type { SessionState } from '../game/session';
import type { ForecastCacheValue } from './forecast-cache';

export interface PublishedQueueForecast extends ForecastAnnotation {
  conflicts: readonly ForecastConflict[];
  wakeConflicts: readonly ForecastWakeConflict[];
}

export interface PublishedQueueCard extends SimQueueCard {
  forecast: PublishedQueueForecast;
}

/**
 * What application/ publishes to UI consumers: the frozen intrinsic sim snapshot
 * plus the separately cached forecast, joined by card id exactly once here.
 */
export interface GameSnapshot extends Omit<SimSnapshot, 'queue'> {
  queue: PublishedQueueCard[];
  forecast: ForecastResult;
  forecastRevision: number;
  /** Game-ring truth published beside sim truth on the same top-level tick. */
  session: SessionState;
}

export function composeSnapshot(
  sim: SimSnapshot,
  cached: ForecastCacheValue,
  session: SessionState,
): GameSnapshot {
  const annotations = new Map(
    cached.forecast.annotations.map((annotation) => [annotation.cardId, annotation]),
  );
  const queue = sim.queue.map((card): PublishedQueueCard => {
    const annotation = annotations.get(card.id);
    if (annotation === undefined) {
      throw new Error(`forecast omitted queued card "${card.id}"`);
    }
    const conflicts = cached.forecast.conflicts.filter((conflict) =>
      conflict.responsibleCardIds.includes(card.id),
    );
    const wakeConflicts = cached.forecast.wakeConflicts.filter((conflict) =>
      conflict.responsibleCardIds.includes(card.id),
    );
    const joined = Object.freeze({
      ...annotation,
      conflicts: Object.freeze([...conflicts]),
      wakeConflicts: Object.freeze([...wakeConflicts]),
    });
    return Object.freeze({ ...card, forecast: joined });
  });
  Object.freeze(queue);
  return Object.freeze({
    ...sim,
    queue,
    forecast: cached.forecast,
    forecastRevision: cached.revision,
    session,
  });
}
