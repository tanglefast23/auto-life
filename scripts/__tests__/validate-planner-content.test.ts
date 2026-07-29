import { AdjacencySchema, AnchorsSchema, PracticeSchema, ReactiveSchema } from '../../src/sim/content-schemas';
import { content } from '../../src/sim/content';
import rawAnchors from '../../content/anchors.json';
import rawReactive from '../../content/reactive.json';
import rawAdjacency from '../../content/adjacency.json';
import rawPractice from '../../content/practice.json';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

test('all four planner content files parse and register', () => {
  expect(() => AnchorsSchema.parse(rawAnchors)).not.toThrow();
  expect(() => ReactiveSchema.parse(rawReactive)).not.toThrow();
  expect(() => AdjacencySchema.parse(rawAdjacency)).not.toThrow();
  expect(() => PracticeSchema.parse(rawPractice)).not.toThrow();
  expect(content.anchors.anchors).toHaveLength(5);
  expect(content.adjacency.pairs).toHaveLength(5);
});

test('anchor offsets reproduce SPEC §7.1 at baseline wakeTarget 420', () => {
  const byId = Object.fromEntries(content.anchors.anchors.map((a) => [a.id, a]));
  expect(420 + byId.lunch!.opensAt).toBe(720); // 12:00
  expect(420 + byId.lunch!.closesAt).toBe(900); // 15:00
  expect(420 + byId.lunch!.targetAt).toBe(780); // 13:00
  expect(420 + byId.workout!.opensAt).toBe(990); // 16:30
  expect(420 + byId.dinner!.targetAt).toBe(1140); // 19:00
  expect(420 + byId.bedtime!.opensAt).toBe(1350); // 22:30
  expect(420 + byId.bedtime!.targetAt).toBe(1350); // 22:30 [SPEC round-5 ruling: 23:00 crossed urgent nightly]
  expect(byId.wake!.block).toEqual(['toilet', 'brush', 'shower', 'meal']);
});

test('reactive windows reproduce SPEC §7.2 at baseline (nap 08:00–20:00, stretch to 21:00)', () => {
  const byId = Object.fromEntries(content.reactive.rules.map((r) => [r.id, r]));
  expect(byId.nap!.window).toEqual([60, 780]);
  expect(byId.stretch!.window).toEqual([60, 840]);
  expect(content.reactive.neverUrgent).toEqual(['movement']);
  expect(byId.urgentSleep!.supersedesGroup).toBe(true);
  expect(byId.snack!.supersededBelow).toEqual({ value: 20, activity: 'meal' });
});

test('malformed anchors are rejected', () => {
  const bad = clone(rawAnchors);
  bad.anchors[0]!.targetAt = 999;
  bad.anchors[0]!.closesAt = 60;
  expect(() => AnchorsSchema.parse(bad)).toThrow(/opensAt/);
  const dup = clone(rawAnchors);
  dup.anchors.push(clone(dup.anchors[0]!));
  expect(() => AnchorsSchema.parse(dup)).toThrow(/duplicate/);
});

test('adjacency pairs demand exactly one first/firstTag and bounded effects', () => {
  const both = clone(rawAdjacency);
  (both.pairs[0] as Record<string, unknown>).first = 'weights';
  expect(() => AdjacencySchema.parse(both)).toThrow(/exactly one/);
  const wildFactor = clone(rawAdjacency);
  (wildFactor.pairs.find((p) => p.id === 'fresh-mind')!.effect as { factor: number }).factor = 5;
  expect(() => AdjacencySchema.parse(wildFactor)).toThrow();
});

test('practice curves are non-increasing, start at 1.0, and cover the session cap', () => {
  const rising = clone(rawPractice);
  rising.blockCurve = [1.0, 1.1, 0.5, 0.2];
  expect(() => PracticeSchema.parse(rising)).toThrow(/non-increasing/);
  const short = clone(rawPractice);
  short.scatteredCurve = [1.0, 0.7];
  expect(() => PracticeSchema.parse(short)).toThrow(/cover/);
});

test('every reactive rule and anchor block references a real activity', () => {
  const ids = new Set(content.activities.activities.map((a) => a.id));
  for (const r of content.reactive.rules) {
    expect(ids.has(r.activity)).toBe(true);
    if (r.supersededBelow) expect(ids.has(r.supersededBelow.activity)).toBe(true);
  }
  for (const a of content.anchors.anchors) {
    for (const step of a.block) {
      if (step === '__preferredWorkout') continue; // resolved by the planner per §9.2 preference
      expect(ids.has(step)).toBe(true);
    }
  }
});
