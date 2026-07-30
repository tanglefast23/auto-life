import type { ContentRegistry } from '../sim/content';
import {
  PrngStreams,
  type PrngSnapshot,
} from '../sim/prng';
import type { SessionState } from './session';
import { selectWrinkleForBoundary } from './pre-boundary';

const SCRIPTED_DAY_ONE_WRINKLE = 'package-delivery';

export interface WrinkleDealResult {
  session: SessionState;
  prng: PrngSnapshot;
  changed: boolean;
}

/**
 * Deals at most once for a calendar day. The caller owns the boundary; this
 * pure reducer owns only the saved deck and the named wrinkles stream.
 */
export function dealWrinkleForDay(
  session: SessionState,
  prng: PrngSnapshot,
  day: number,
  content: ContentRegistry,
): WrinkleDealResult {
  if (
    day < 2 ||
    session.wrinkles.dealt.some((entry) => entry.day === day) ||
    session.wrinkles.announced !== null
  ) {
    return { session, prng, changed: false };
  }

  const available = content.wrinkles.entries
    .filter(
      (entry) =>
        entry.id !== SCRIPTED_DAY_ONE_WRINKLE &&
        entry.firstDay <= day,
    )
    .map((entry) => entry.id);
  const priorWindowDeals = session.wrinkles.dealt
    .filter(
      (entry) =>
        entry.wrinkleId !== null &&
        entry.day >= day - content.wrinkles.noRepeatDays &&
        entry.day < day,
    );
  const recent = new Set(
    priorWindowDeals.map((entry) => entry.wrinkleId!),
  );
  const savedRecentDealtIds = priorWindowDeals
    .filter(
      (entry) =>
        entry.day >
        day - content.wrinkles.noRepeatDays,
    )
    .map((entry) => entry.wrinkleId!);
  const eligible = available.filter((id) => !recent.has(id));
  let remaining = session.wrinkles.remainingDeckIds.filter(
    (id) => eligible.includes(id),
  );
  if (remaining.length === 0) remaining = [...eligible];

  const selection = selectWrinkleForBoundary(
    prng,
    remaining,
    content.wrinkles.quietDayWeight,
  );
  if (selection.selectedWrinkleId === null) {
    return {
      prng: selection.prng,
      changed: true,
      session: {
        ...session,
        wrinkles: {
          ...session.wrinkles,
          remainingDeckIds: remaining,
          recentDealtIds: savedRecentDealtIds,
          dealt: [
            ...session.wrinkles.dealt,
            {
              day,
              wrinkleId: null,
              variantId: null,
              resolved: true,
            },
          ],
        },
      },
    };
  }

  const wrinkle = content.wrinkles.entries.find(
    (entry) => entry.id === selection.selectedWrinkleId,
  );
  if (wrinkle === undefined) {
    throw new Error(
      `selected wrinkle "${selection.selectedWrinkleId}" is not registered`,
    );
  }
  const streams = PrngStreams.restore(selection.prng);
  const variantIndex =
    wrinkle.variants.length === 1
      ? 0
      : drawIndex(streams.next('wrinkles'), wrinkle.variants.length);
  const variant = wrinkle.variants[variantIndex]!;
  const parameters: Record<string, string | number | boolean> = {};
  if (wrinkle.effect.kind === 'timed-window') {
    const targetIndex = drawIndex(
      streams.next('wrinkles'),
      wrinkle.effect.replacementTargetOffsets.length,
    );
    parameters.targetAtWakeOffset =
      wrinkle.effect.replacementTargetOffsets[targetIndex]!;
  }

  const wrinkleId = wrinkle.id;
  const nextRecentDealtIds = addUnique(
    savedRecentDealtIds,
    wrinkleId,
  );
  return {
    prng: streams.serialize(),
    changed: true,
    session: {
      ...session,
      wrinkles: {
        ...session.wrinkles,
        firedIds: addUnique(
          session.wrinkles.firedIds,
          wrinkleId,
        ),
        pendingId: wrinkleId,
        choiceReadyId: wrinkleId,
        remainingDeckIds: remaining.filter((id) => id !== wrinkleId),
        recentDealtIds: nextRecentDealtIds,
        dealt: [
          ...session.wrinkles.dealt,
          {
            day,
            wrinkleId,
            variantId: variant.id,
            resolved: false,
          },
        ],
        announced: {
          day,
          wrinkleId,
          variantId: variant.id,
          parameters,
        },
      },
    },
  };
}

function drawIndex(draw: number, length: number): number {
  return Math.min(length - 1, Math.floor(draw * length));
}

function addUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}
