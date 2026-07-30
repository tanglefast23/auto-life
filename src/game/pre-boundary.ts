import {
  PrngStreams,
  type PrngSnapshot,
} from '../sim/prng';

export interface PreBoundarySelection {
  selectedWrinkleId: string | null;
  prng: PrngSnapshot;
}

/**
 * Pure game-owned wrinkle selection for a deterministic boundary.
 *
 * Only the `wrinkles` stream is consumed. The caller supplies already-eligible
 * IDs, so content rules and save state decide visibility before randomness.
 */
export function selectWrinkleForBoundary(
  snapshot: PrngSnapshot,
  eligibleWrinkleIds: readonly string[],
  quietDayWeight = 0,
): PreBoundarySelection {
  const streams = PrngStreams.restore(
    JSON.parse(JSON.stringify(snapshot)) as unknown,
  );
  const totalWeight =
    eligibleWrinkleIds.length + Math.max(0, Math.trunc(quietDayWeight));
  if (totalWeight === 0) {
    return {
      selectedWrinkleId: null,
      prng: streams.serialize(),
    };
  }
  const draw = streams.next('wrinkles');
  const index = Math.min(totalWeight - 1, Math.floor(draw * totalWeight));
  return {
    selectedWrinkleId:
      index < eligibleWrinkleIds.length
        ? eligibleWrinkleIds[index] ?? null
        : null,
    prng: streams.serialize(),
  };
}
