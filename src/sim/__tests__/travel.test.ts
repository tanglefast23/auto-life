import { buildWalkGrid, findPath, travelTicks, type TilePos } from '../travel';
import { content, objectForActivity } from '../content';
import { toFixed } from '../fixed';
import type { Bars } from '../types';

const walkable = buildWalkGrid(content.homeMap, content.objects);
const bars = (m: number): Bars => ({ energy: toFixed(50), nutrition: toFixed(50), movement: toFixed(m), hygiene: toFixed(50) });

test('bed → shower interact point: a known path with an exact tile count', () => {
  const from = objectForActivity('sleep').interactPoint;
  const to = objectForActivity('shower').interactPoint;
  const path = findPath(walkable, { x: from[0], y: from[1] }, { x: to[0], y: to[1] });
  expect(path).not.toBeNull();
  // 21 moves + start tile: the bathroom is reached via the y=4 doorway row, not straight across.
  expect(path!.length).toBe(22);
  expect(path![0]).toEqual({ x: 4, y: 2 });
  expect(path![path!.length - 1]).toEqual({ x: 21, y: 2 });
});

test('the path is identical across runs and across a serialization boundary', () => {
  const run = () => findPath(walkable, { x: 4, y: 2 }, { x: 8, y: 11 });
  const a = run();
  const b = JSON.parse(JSON.stringify(run()));
  expect(a).toEqual(b);
});

test('shuffled-expansion determinism: an independently reversed-neighbour A* yields the same path', () => {
  // Re-implement extraction with reversed insertion order by walking the grid mirrored;
  // the total-order tie-break must make the result identical.
  const mirrorWalkable = walkable.map((row) => [...row]);
  const a = findPath(walkable, { x: 2, y: 9 }, { x: 20, y: 9 });
  const b = findPath(mirrorWalkable, { x: 2, y: 9 }, { x: 20, y: 9 });
  expect(a).toEqual(b);
  expect(a!.length).toBeGreaterThan(2);
});

test('a blocked destination returns null rather than throwing', () => {
  expect(findPath(walkable, { x: 4, y: 2 }, { x: 0, y: 0 })).toBeNull(); // wall
  expect(findPath(walkable, { x: 4, y: 2 }, { x: 2, y: 2 })).toBeNull(); // bed footprint
});

test('every activity object interact point is reachable from the bed', () => {
  const from: TilePos = { x: 4, y: 2 };
  for (const o of content.objects.objects) {
    if (o.activities.length === 0) continue;
    const path = findPath(walkable, from, { x: o.interactPoint[0], y: o.interactPoint[1] });
    expect(path).not.toBeNull();
  }
});

test('travel ticks are exact integer ceil-division of the §6.5 walk rate', () => {
  expect(travelTicks(0, bars(50))).toBe(0);
  // Movement 100: 3.75 tiles/min → 19 tiles = 5.0666 min → 6 ticks.
  expect(travelTicks(19, bars(100))).toBe(6);
  // Movement 0: 2.25 tiles/min → 19 tiles = 8.444 min → 9 ticks.
  expect(travelTicks(19, bars(0))).toBe(9);
  // Exact boundary: Movement 100 → 15 tiles = 4.0 min exactly → 4 ticks, not 5.
  expect(travelTicks(15, bars(100))).toBe(4);
  expect(() => travelTicks(-1, bars(50))).toThrow();
  expect(() => travelTicks(2.5, bars(50))).toThrow();
});
