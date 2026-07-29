import { content, objectForActivity } from '../../src/sim/content';
import { buildWalkGrid } from '../../src/sim/travel';

const walkable = buildWalkGrid(content.homeMap, content.objects);
const isWalkableTile = (x: number, y: number) => content.homeMap.grid[y]?.[x] !== content.homeMap.walls;

test('every interactPoint is walkable after blocking footprints are applied', () => {
  for (const o of content.objects.objects) {
    const [x, y] = o.interactPoint;
    expect({ id: o.id, walkable: walkable[y]?.[x] ?? false }).toEqual({ id: o.id, walkable: true });
  }
});

test('every activity id has exactly one owning object', () => {
  for (const a of content.activities.activities) {
    expect(() => objectForActivity(a.id)).not.toThrow();
  }
});

test('every footprint tile is inside the grid and on a room tile (never a wall)', () => {
  for (const o of content.objects.objects) {
    for (const [x, y] of o.footprint) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(content.homeMap.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(content.homeMap.height);
      expect({ id: o.id, tile: [x, y], onRoom: isWalkableTile(x, y) }).toEqual({ id: o.id, tile: [x, y], onRoom: true });
    }
  }
});

test('no blocking object footprint covers another object\'s interactPoint', () => {
  for (const o of content.objects.objects) {
    if (o.blocksMovement === false) continue;
    for (const other of content.objects.objects) {
      const [ix, iy] = other.interactPoint;
      const covered = o.footprint.some(([x, y]) => x === ix && y === iy);
      expect({ blocker: o.id, target: other.id, covered }).toEqual({ blocker: o.id, target: other.id, covered: false });
    }
  }
});
