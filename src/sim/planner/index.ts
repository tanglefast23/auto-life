import { scoreReactiveCard, URGENT_TIER } from './priority';
import type { ReactiveConfig } from '../content-schemas';
import type { Bars } from '../types';
import type { QueueCard } from '../queue';

/** The anchor-block priority tier (§7.3): above every Stage-2 score, below every URGENT score. */
export const BLOCK_TIER = 500;

export interface RoutineMemoryOrder {
  rankByActivity: Readonly<Record<string, number>>;
  absentRank: number;
}

export interface RoutineSortKey {
  scoreBucket: number;
  routineRank: number;
  enqueuedTick: number;
  stableId: string;
}

export function scoreBucket(baseScore: number): number {
  return Math.round(baseScore * 10);
}

export function compareRoutineSortKeys(
  a: RoutineSortKey,
  b: RoutineSortKey,
): number {
  if (a.scoreBucket !== b.scoreBucket) {
    return b.scoreBucket - a.scoreBucket;
  }
  if (a.routineRank !== b.routineRank) {
    return a.routineRank - b.routineRank;
  }
  if (a.enqueuedTick !== b.enqueuedTick) {
    return a.enqueuedTick - b.enqueuedTick;
  }
  if (a.stableId === b.stableId) return 0;
  return a.stableId < b.stableId ? -1 : 1;
}

/**
 * §7.7's sortReactivesAroundBlocks (Q2 ruling): each MAXIMAL AUTO run sorts
 * independently; sorting never crosses a PINNED card; anchor blocks travel as
 * intact units at their first member's position; urgent reactive singles rise to
 * the front of their own run. PINNED cards are never touched — the 10k-edit
 * property test holds the invariant.
 */
export function sortReactivesAroundBlocks(
  queue: readonly QueueCard[],
  bars: Bars,
  cfg: ReactiveConfig,
  routineMemory?: RoutineMemoryOrder | null,
): QueueCard[] {
  const result: QueueCard[] = [];
  let run: QueueCard[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    // Group the run into units: anchor blocks (by blockId, order preserved) and reactive singles.
    const units: Array<{
      cards: QueueCard[];
      sortKey: number;
      enqueuedTick: number;
      routineRank: number;
      stableId: string;
    }> = [];
    const seenBlocks = new Set<string>();
    for (const card of run) {
      if (card.blockId) {
        if (seenBlocks.has(card.blockId)) continue;
        seenBlocks.add(card.blockId);
        const cards = run.filter((c) => c.blockId === card.blockId);
        // §7.3: blocks hold a FIXED tier between URGENT (1000+) and reactive Stage 2 (≤4).
        units.push({
          cards,
          sortKey: BLOCK_TIER,
          enqueuedTick: cards[0]?.enqueuedTick ?? 0,
          routineRank: routineMemory?.absentRank ?? 0,
          stableId: cards[0]?.id ?? card.id,
        });
      } else {
        const rule = cfg.rules.find(
          (r) => r.activity === card.activityId || r.supersededBelow?.activity === card.activityId,
        );
        // Q7/T2: urgency is a generic queue tier, not a side effect of having a
        // reactive rule. Wrinkle/visitor cards have no bar rule, but must still
        // outrank anchor blocks after this tick's sort and every later sort.
        const key = rule ? scoreReactiveCard(card, rule, bars, cfg) : card.urgent ? URGENT_TIER : 0;
        units.push({
          cards: [card],
          sortKey: key,
          enqueuedTick: card.enqueuedTick,
          routineRank:
            routineMemory !== null &&
            routineMemory !== undefined &&
            !card.urgent &&
            rule !== undefined
              ? routineMemory.rankByActivity[card.activityId] ??
                routineMemory.absentRank
              : routineMemory?.absentRank ?? 0,
          stableId: card.id,
        });
      }
    }
    // Stable order: scored units sort by score desc; unscored blocks keep relative order
    // among themselves via enqueuedTick; ties break by enqueuedTick (§7.3).
    units.sort((a, b) =>
      routineMemory === null || routineMemory === undefined
        ? a.sortKey !== b.sortKey
          ? b.sortKey - a.sortKey
          : a.enqueuedTick - b.enqueuedTick
        : compareRoutineSortKeys(
            {
              scoreBucket: scoreBucket(a.sortKey),
              routineRank: a.routineRank,
              enqueuedTick: a.enqueuedTick,
              stableId: a.stableId,
            },
            {
              scoreBucket: scoreBucket(b.sortKey),
              routineRank: b.routineRank,
              enqueuedTick: b.enqueuedTick,
              stableId: b.stableId,
            },
          ),
    );
    for (const u of units) result.push(...u.cards);
    run = [];
  };

  for (const card of queue) {
    if (card.owner === 'PINNED') {
      flushRun();
      result.push(card);
    } else {
      run.push(card);
    }
  }
  flushRun();
  return result;
}
