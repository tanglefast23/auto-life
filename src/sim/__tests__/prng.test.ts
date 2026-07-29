import { PrngStreams, PrngSnapshotSchema, STREAM_NAMES } from '../prng';

test('locked vector: seed 1234, first three wrinkles draws', () => {
  const p = PrngStreams.create(1234);
  expect([p.next('wrinkles'), p.next('wrinkles'), p.next('wrinkles')]).toEqual([
    0.8918027963954955, 0.9189240359701216, 0.3371217066887766,
  ]);
});

test('streams are independent: storylets draws never shift wrinkles', () => {
  const a = PrngStreams.create(77);
  const b = PrngStreams.create(77);
  b.next('storylets');
  b.next('storylets');
  expect(b.next('wrinkles')).toBe(a.next('wrinkles'));
});

test('JSON serialize/restore resumes exactly', () => {
  const a = PrngStreams.create(9);
  a.next('relationships');
  const b = PrngStreams.restore(JSON.parse(JSON.stringify(a.serialize())));
  expect(b.next('relationships')).toBe(a.next('relationships'));
});

test('clone draws never mutate the original', () => {
  const a = PrngStreams.create(5);
  const c = a.clone();
  c.next('careerEvents');
  c.next('careerEvents');
  expect(a.serialize().streams.careerEvents.calls).toBe(0);
});

test('state size and restore cost are constant regardless of history', () => {
  const a = PrngStreams.create(1);
  for (let i = 0; i < 10_000; i++) a.next('cosmetic');
  const snap = a.serialize();
  expect(snap.streams.cosmetic.calls).toBe(10_000);
  expect(JSON.stringify(snap).length).toBeLessThan(500); // five small records, never a history
  const b = PrngStreams.restore(snap); // O(5): no replay of the 10k draws
  expect(b.next('cosmetic')).toBe(a.next('cosmetic'));
});

test('the five exact stream names exist', () => {
  expect(STREAM_NAMES).toEqual(['wrinkles', 'storylets', 'relationships', 'careerEvents', 'cosmetic']);
});

test('untrusted snapshots are validated', () => {
  expect(() => PrngStreams.restore({ rootSeed: -1 })).toThrow();
  const good = PrngStreams.create(2).serialize();
  expect(() => PrngSnapshotSchema.parse(good)).not.toThrow();
  const bad = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
  (bad.streams as Record<string, unknown>).extra = { state: 1, calls: 0 };
  expect(() => PrngStreams.restore(bad)).toThrow();
});
