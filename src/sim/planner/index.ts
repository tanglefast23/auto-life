import { scoreReactiveCard } from './priority';
import type { ReactiveConfig } from '../content-schemas';
import type { Bars } from '../types';
import type { QueueCard } from '../queue';

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
): QueueCard[] {
  const result: QueueCard[] = [];
  let run: QueueCard[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    // Group the run into units: anchor blocks (by blockId, order preserved) and reactive singles.
    const units: Array<{ cards: QueueCard[]; sortKey: number | null; enqueuedTick: number }> = [];
    const seenBlocks = new Set<string>();
    for (const card of run) {
      if (card.blockId) {
        if (seenBlocks.has(card.blockId)) continue;
        seenBlocks.add(card.blockId);
        const cards = run.filter((c) => c.blockId === card.blockId);
        units.push({ cards, sortKey: null, enqueuedTick: cards[0]?.enqueuedTick ?? 0 }); // blocks are never scored
      } else {
        const rule = cfg.rules.find(
          (r) => r.activity === card.activityId || r.supersededBelow?.activity === card.activityId,
        );
        const key = rule ? scoreReactiveCard(card, rule, bars, cfg) : 0;
        units.push({ cards: [card], sortKey: key, enqueuedTick: card.enqueuedTick });
      }
    }
    // Stable order: scored units sort by score desc; unscored blocks keep relative order
    // among themselves via enqueuedTick; ties break by enqueuedTick (§7.3).
    units.sort((a, b) => {
      const ka = a.sortKey ?? Number.NEGATIVE_INFINITY;
      const kb = b.sortKey ?? Number.NEGATIVE_INFINITY;
      if (ka !== kb) return kb - ka;
      return a.enqueuedTick - b.enqueuedTick;
    });
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
