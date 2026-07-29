import type { HomeMapConfig, ObjectsConfig } from './content-schemas';
import type { Bars } from './types';

export interface TilePos {
  x: number;
  y: number;
}

/**
 * Walkability: room tiles minus walls minus blocking object footprints. An object's
 * own interactPoint is where the sim STANDS, so footprint tiles are never
 * interactPoints for blocking objects (the content gate asserts this).
 */
export function buildWalkGrid(map: HomeMapConfig, objects: ObjectsConfig): boolean[][] {
  const walkable: boolean[][] = map.grid.map((row) => [...row].map((c) => c !== map.walls));
  for (const o of objects.objects) {
    if (o.blocksMovement === false) continue;
    for (const [x, y] of o.footprint) {
      const row = walkable[y];
      if (row) row[x] = false;
    }
  }
  return walkable;
}

/**
 * Deterministic 4-directional A*. Ties on f break by lowest g, then lowest tile
 * index (y * width + x) — a TOTAL order, never insertion order (the shuffled-
 * expansion test exists to catch exactly that bug).
 */
export function findPath(
  walkable: boolean[][],
  from: TilePos,
  to: TilePos,
  neighbourOrder: readonly ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'],
): TilePos[] | null {
  const height = walkable.length;
  const width = walkable[0]?.length ?? 0;
  const idx = (p: TilePos) => p.y * width + p.x;
  const inBounds = (p: TilePos) => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height;
  const open = new Map<number, { pos: TilePos; g: number; f: number }>();
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const h = (p: TilePos) => Math.abs(p.x - to.x) + Math.abs(p.y - to.y);

  if (!inBounds(from) || !inBounds(to) || !walkable[from.y]?.[from.x] || !walkable[to.y]?.[to.x]) {
    return null;
  }
  open.set(idx(from), { pos: from, g: 0, f: h(from) });
  gScore.set(idx(from), 0);

  while (open.size > 0) {
    // Total-order extraction: lowest f, then lowest g, then lowest index.
    let best: { key: number; pos: TilePos; g: number; f: number } | null = null;
    for (const [key, node] of open) {
      if (
        best === null ||
        node.f < best.f ||
        (node.f === best.f && node.g < best.g) ||
        (node.f === best.f && node.g === best.g && key < best.key)
      ) {
        best = { key, ...node };
      }
    }
    if (!best) break;
    open.delete(best.key);
    if (best.key === idx(to)) {
      const path: TilePos[] = [best.pos];
      let cursor = best.key;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)!;
        path.unshift({ x: cursor % width, y: Math.floor(cursor / width) });
      }
      return path;
    }
    // Expansion order is a parameter ONLY so the determinism test can prove the
    // result is order-independent (the total-order tie-break carries that weight).
    const offsets = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const neighbours: TilePos[] = neighbourOrder.map((d) => ({ x: best.pos.x + offsets[d].x, y: best.pos.y + offsets[d].y }));
    for (const n of neighbours) {
      if (!inBounds(n) || !walkable[n.y]?.[n.x]) continue;
      const key = idx(n);
      const tentative = best.g + 1;
      if (tentative < (gScore.get(key) ?? Number.POSITIVE_INFINITY)) {
        gScore.set(key, tentative);
        cameFrom.set(key, best.key);
        open.set(key, { pos: n, g: tentative, f: tentative + h(n) });
      }
    }
  }
  return null;
}

/**
 * Travel ticks, derived in integers (P1's durationTicks discipline — SPEC §6.5):
 * tiles/min = 3 × (0.75 + Movement/200); with Movement = movementFixed/6000 this is
 * (3 × (900000 + movementFixed)) / 1200000, so
 * ticks = ceil(tiles × 1200000 / (3 × (900000 + movementFixed))).
 * (The P2 draft plan quoted 150000 here — a mis-scaled constant; recorded in evidence.)
 */
export function travelTicks(tiles: number, bars: Bars): number {
  if (!Number.isInteger(tiles) || tiles < 0) throw new Error(`invalid tile count: ${tiles}`);
  if (tiles === 0) return 0;
  const denom = 3 * (900_000 + bars.movement);
  return Math.max(1, Math.floor((tiles * 1_200_000 + denom - 1) / denom));
}
