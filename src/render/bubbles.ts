import type { BarId } from '../sim/types';
import type { RatesConfig } from '../sim/content-schemas';
import { bandFor } from '../ui/bands';

/**
 * The world bubble layer (SPEC §11.1, design.md §8; P6 T6b).
 *
 * §11.1's world line reads: *"thought bubbles (need <40, preferences, hints), progress
 * ring over the sim, ⚠ forecast pulses."* Audited against the tree at P6 open, the ring
 * shipped in P3 and forecast warnings shipped on P4's queue cards — but **the need and
 * hint bubbles existed nowhere and were in no phase's owned list**, and P5's preference
 * bubble was a panel element rather than a bubble over the sim. Master §5 assigns them to
 * P6 (2026-07-31), the same way §11.4's sleep-skip was assigned to P4.
 *
 * Bubbles ship in Milestone A rather than with the juice, because a bubble over the sim's
 * head is how a player learns *why* she walked to the shower without opening a panel. That
 * is comprehension, not decoration, and Gate A is the comprehension gate.
 *
 * **Bounded deliberately** (master §5): derived only from state the engine already
 * publishes — the `bandFor()` bands, P5's preference reaction, P4's forecast warnings. No
 * new domain state, no new content, no new event. Pure, so the priority rule is testable
 * without a canvas.
 */

/** Highest priority first. A bubble that cannot outrank the current one does not appear. */
export const BUBBLE_PRIORITY = ['need', 'warning', 'preference', 'hint'] as const;
export type BubbleKind = (typeof BUBBLE_PRIORITY)[number];

/** design.md §8: "grumpy = plum tint, happy = leaf tint — never red." */
export type BubbleTint = 'plum' | 'leaf' | 'gold';

export interface Bubble {
  kind: BubbleKind;
  /** Atlas icon name, drawn at 12px inside the bubble (design.md §8). */
  icon: string;
  tint: BubbleTint;
  /** Which bar raised it, when the kind is need or warning. */
  barId: BarId | null;
  /** Stable id so a mounted test and a screen reader can both address it. */
  id: string;
}

export interface PreferenceReaction {
  kind: 'happy' | 'grumble';
  label: string;
}

export interface ForecastWarning {
  kind: 'cap-waste' | 'conflict';
  barId: BarId;
}

export interface BubbleInputs {
  /** Display-scale bar values, 0..100. */
  bars: Readonly<Record<BarId, number>>;
  preferenceReaction: PreferenceReaction | null;
  warning: ForecastWarning | null;
  /**
   * A hint is the one bubble with no engine trigger of its own: it is shown while the sim
   * is idle with nothing else to say, pointing at the queue. SPEC §11.1 lists hints, and
   * leaving the slot empty would recreate the exact silent-cut this owner assignment
   * exists to prevent — so it is specified rather than reserved.
   */
  idleWithEmptyQueue?: boolean;
  /** Asleep sims do not think out loud. */
  asleep?: boolean;
}

const BAR_ORDER: readonly BarId[] = ['energy', 'nutrition', 'movement', 'hygiene'];

/**
 * At most one bubble, by priority.
 *
 * Returns `null` rather than an empty array: SPEC §11.1 says "thought bubbles" but the
 * scene has one head to anchor them to, and two bubbles stacked over a 32px sim is
 * unreadable at 1×. One at a time, loudest first.
 */
export function bubbleFor(inputs: BubbleInputs, rates: RatesConfig): Bubble | null {
  if (inputs.asleep === true) return null;

  // 1. Need — a bar in its own alert band. Energy carries its own thresholds (SPEC §11.1
  //    records why: 20 at bedtime is designed, and the default <40 rule "would cry red
  //    every healthy evening"), so this asks `bandFor` rather than comparing to 40.
  for (const barId of BAR_ORDER) {
    const value = inputs.bars[barId];
    if (value === undefined) continue;
    if (bandFor(barId, value, rates).band === 'alert') {
      return { kind: 'need', icon: `icon.${barId}.alert`, tint: 'plum', barId, id: `need:${barId}` };
    }
  }

  // 2. Warning — a forecast consequence the player can still act on.
  if (inputs.warning !== null) {
    return {
      kind: 'warning',
      icon: 'icon.urgent',
      tint: 'plum',
      barId: inputs.warning.barId,
      id: `warning:${inputs.warning.kind}:${inputs.warning.barId}`,
    };
  }

  // 3. Preference — P5's reaction, moved over the sim's head where §11.1 puts it.
  if (inputs.preferenceReaction !== null) {
    const happy = inputs.preferenceReaction.kind === 'happy';
    return {
      kind: 'preference',
      icon: happy ? 'icon.practice' : 'icon.auto',
      tint: happy ? 'leaf' : 'plum',
      barId: null,
      id: `preference:${inputs.preferenceReaction.kind}`,
    };
  }

  // 4. Hint — nothing is wrong and nothing is queued; point at the queue.
  if (inputs.idleWithEmptyQueue === true) {
    return { kind: 'hint', icon: 'icon.pinned', tint: 'gold', barId: null, id: 'hint:queue' };
  }

  return null;
}
