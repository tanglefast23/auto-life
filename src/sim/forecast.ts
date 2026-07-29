import { step } from './step';
import { restoreSimState, type SimState } from './state';
import { toDisplay } from './fixed';
import { minuteOfDay, targetsFor, TICKS_PER_DAY } from './clock';
import type { ContentRegistry } from './content';
import type { BarId } from './types';

export interface ForecastEntry {
  cardId: string;
  activityId: string;
  predictedStartMinute: number;
}

export interface ForecastResult {
  horizonTicks: number;
  starts: ForecastEntry[];
  conflicts: Array<{ bar: BarId; atMinute: number }>;
  barsAtHorizon: Record<BarId, number>;
}

/**
 * The headless lookahead (SPEC §7.5): CLONES plain state and runs the SAME step()
 * path — a second tick implementation would drift, and the drift would surface as
 * the forecast lying to the player. PRNG state is cloned with the state (never the
 * live streams), so a forecast can never advance or spoil the real run's draws;
 * undealt wrinkles (P5) are absent by construction.
 */
export function forecast(state: SimState, content: ContentRegistry): ForecastResult {
  // Deep-clone through the validator: guarantees we run on plain data, not aliases.
  let sim = restoreSimState(JSON.parse(JSON.stringify(state)));
  const wakeTarget = targetsFor(sim.chronotype, content.rates).wake;
  const nowOffset = (minuteOfDay(sim.clock.absoluteMinute) - wakeTarget + TICKS_PER_DAY) % TICKS_PER_DAY;
  const ticksToWake = TICKS_PER_DAY - nowOffset;
  const horizonTicks = Math.min(ticksToWake, 720); // next wake or 12h, whichever is sooner

  const starts: ForecastEntry[] = [];
  const seenStarted = new Set<string>();
  const conflicts: ForecastResult['conflicts'] = [];
  const conflictSeen = new Set<string>();

  for (let t = 0; t < horizonTicks; t++) {
    // The minute ABOUT TO RUN — snapshot.minuteOfDay is post-advance, one late
    // for a start that happens THIS tick (round-2 math finding).
    const tickMinute = minuteOfDay(sim.clock.absoluteMinute);
    const before = sim.current;
    const r = step(sim, [], content);
    sim = r.next;
    const after = sim.current;
    const startedCard =
      after && (after.type === 'activity' || after.type === 'sleep')
        ? (after.type === 'activity' ? after.cardId : after.cardId ?? null)
        : null;
    const beforeCard =
      before && (before.type === 'activity' || before.type === 'sleep')
        ? (before.type === 'activity' ? before.cardId : before.cardId ?? null)
        : null;
    if (startedCard && startedCard !== beforeCard && !seenStarted.has(startedCard)) {
      seenStarted.add(startedCard);
      const activityId = after!.type === 'activity' ? after!.dto.activityId : 'sleep';
      starts.push({ cardId: startedCard, activityId, predictedStartMinute: tickMinute });
    }
    for (const bar of ['energy', 'nutrition', 'movement', 'hygiene'] as const) {
      if (r.snapshot.bars[bar] < 15 && !conflictSeen.has(bar)) {
        conflictSeen.add(bar);
        conflicts.push({ bar, atMinute: tickMinute });
      }
    }
  }

  // Bars exactly AT the horizon — an extra step here previously overshot by one tick.
  return {
    horizonTicks,
    starts,
    conflicts,
    barsAtHorizon: {
      energy: toDisplay(sim.bars.energy),
      nutrition: toDisplay(sim.bars.nutrition),
      movement: toDisplay(sim.bars.movement),
      hygiene: toDisplay(sim.bars.hygiene),
    },
  };
}
