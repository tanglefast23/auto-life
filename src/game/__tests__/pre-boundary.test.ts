import { PrngStreams } from '../../sim/prng';
import { selectWrinkleForBoundary } from '../pre-boundary';

test('pre-boundary wrinkle selection consumes only the wrinkles stream', () => {
  const baseline = PrngStreams.create(991).serialize();
  const otherDraws = PrngStreams.restore(baseline);
  otherDraws.next('storylets');
  otherDraws.next('storylets');
  otherDraws.next('cosmetic');

  const candidates = ['repair-visit', 'favorite-show', 'rough-night'];
  const first = selectWrinkleForBoundary(baseline, candidates);
  const second = selectWrinkleForBoundary(
    otherDraws.serialize(),
    candidates,
  );

  expect(second.selectedWrinkleId).toBe(first.selectedWrinkleId);
  expect(second.prng.streams.wrinkles).toEqual(
    first.prng.streams.wrinkles,
  );
  expect(first.prng.streams.storylets).toEqual(
    baseline.streams.storylets,
  );
  expect(first.prng.streams.cosmetic).toEqual(
    baseline.streams.cosmetic,
  );
});

test('an empty eligible set consumes no draw', () => {
  const before = PrngStreams.create(991).serialize();
  expect(selectWrinkleForBoundary(before, [])).toEqual({
    selectedWrinkleId: null,
    prng: before,
  });
});

test('quiet-day weight uses the same single wrinkles draw', () => {
  const before = PrngStreams.create(14).serialize();
  const result = selectWrinkleForBoundary(
    before,
    ['repair-visit'],
    10,
  );

  expect(result.selectedWrinkleId).toBeNull();
  expect(result.prng.streams.wrinkles.calls).toBe(
    before.streams.wrinkles.calls + 1,
  );
  expect(result.prng.streams.storylets).toEqual(
    before.streams.storylets,
  );
});
