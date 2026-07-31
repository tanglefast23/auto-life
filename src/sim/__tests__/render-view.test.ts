import { step } from '../step';
import { newGameState, SimStateSchema } from '../state';
import { content, objectForActivityIn } from '../content';
import { PrngStreams } from '../prng';
import { deriveRenderView, interpolateTravel, type TravelView } from '../render-view';
import { toFixed, toDisplay } from '../fixed';
import type { SimState } from '../state';

/**
 * P3 T3 — the render read-model. These tests exist because the P2 snapshot could not
 * draw the sim, and because the renderer must never be the place that decides what
 * "facing" or "sub-tile position" means.
 */

const fresh = (): SimState =>
  newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

/** Advance until a predicate holds, returning the state and snapshot at that point. */
function advanceUntil(pred: (r: ReturnType<typeof step>) => boolean, maxTicks = 2000) {
  let s = fresh();
  for (let i = 0; i < maxTicks; i++) {
    const r = step(s, [], content);
    s = r.next;
    if (pred(r)) return { s, r };
  }
  throw new Error('predicate never held');
}

describe('the render block is present and sufficient', () => {
  test('a snapshot carries position, facing, progress and mSpeed', () => {
    const r = step(fresh(), [], content);
    expect(r.snapshot.render.position).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    expect(['up', 'down', 'left', 'right']).toContain(r.snapshot.render.facing);
    expect(typeof r.snapshot.render.mSpeed).toBe('number');
  });

  test('position matches the sim, so the renderer never needs SimState', () => {
    const { s, r } = advanceUntil((x) => x.snapshot.processed === 'travel');
    expect(r.snapshot.render.position).toEqual({ x: s.position.x, y: s.position.y });
  });

  test('mSpeed tracks Energy (SPEC §11.3 tempo source)', () => {
    const s = fresh();
    expect(deriveRenderView(s, content).mSpeed).toBeCloseTo(0.5 + toDisplay(s.bars.energy) / 100, 10);
    const tired: SimState = { ...s, bars: { ...s.bars, energy: toFixed(0) } };
    expect(deriveRenderView(tired, content).mSpeed).toBeCloseTo(0.5, 10);
  });
});

describe('facing is derived, never stored', () => {
  test('SimState gained no fields — presentation stays out of the replay contract', () => {
    const keys = Object.keys(SimStateSchema.shape).sort();
    expect(keys).not.toContain('facing');
    expect(keys).not.toContain('render');
  });

  test('while travelling, facing follows the path direction', () => {
    const { r } = advanceUntil((x) => x.snapshot.processed === 'travel' && x.snapshot.render.travel !== null);
    const travel = r.snapshot.render.travel!;
    expect(travel.path.length).toBeGreaterThan(1);
    expect(travel.totalTicks).toBeGreaterThan(0);
    // Facing must be one of the two axes actually traversed by the path.
    const dxs = travel.path.slice(1).map((p, i) => p.x - travel.path[i]!.x);
    const dys = travel.path.slice(1).map((p, i) => p.y - travel.path[i]!.y);
    const movesHorizontally = dxs.some((d) => d !== 0);
    const movesVertically = dys.some((d) => d !== 0);
    const facing = r.snapshot.render.facing;
    if (facing === 'left' || facing === 'right') expect(movesHorizontally).toBe(true);
    else expect(movesVertically || travel.path.length === 1).toBe(true);
  });

  test('while running an activity, facing is the object\'s declared facing', () => {
    const { s, r } = advanceUntil((x) => x.snapshot.processed === 'activity');
    const cur = s.current;
    expect(cur?.type).toBe('activity');
    if (cur?.type !== 'activity') throw new Error('unreachable');
    const expected = objectForActivityIn(content, cur.dto.activityId).facing;
    expect(r.snapshot.render.facing).toBe(expected);
  });

  test('while asleep, facing is the bed\'s declared facing', () => {
    const { r } = advanceUntil((x) => x.snapshot.processed === 'sleep', 2000);
    expect(r.snapshot.render.facing).toBe(objectForActivityIn(content, 'sleep').facing);
  });

  test('idle faces the player — the one case with nothing to derive from', () => {
    const s = fresh();
    const idle: SimState = { ...s, current: null };
    expect(deriveRenderView(idle, content).facing).toBe('down');
  });
});

describe('activityProgress drives the ring over the sim (SPEC §11.1)', () => {
  test('null when idle, null while asleep', () => {
    const s = fresh();
    expect(deriveRenderView({ ...s, current: null }, content).activityProgress).toBeNull();
    const { r } = advanceUntil((x) => x.snapshot.processed === 'sleep', 2000);
    expect(r.snapshot.render.activityProgress).toBeNull();
  });

  test('rises monotonically within one activity and stays in [0,1]', () => {
    let s = fresh();
    const seen: number[] = [];
    let activityId: string | null = null;
    for (let i = 0; i < 400; i++) {
      const r = step(s, [], content);
      s = r.next;
      const cur = s.current;
      if (cur?.type !== 'activity') {
        if (seen.length > 2) break; // one activity captured
        continue;
      }
      if (activityId === null) activityId = cur.dto.activityId;
      if (cur.dto.activityId !== activityId) break;
      const p = r.snapshot.render.activityProgress;
      expect(p).not.toBeNull();
      expect(p!).toBeGreaterThanOrEqual(0);
      expect(p!).toBeLessThanOrEqual(1);
      seen.push(p!);
    }
    expect(seen.length).toBeGreaterThan(2);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
  });
});

describe('interpolateTravel — the anti-teleport guarantee (SPEC §5)', () => {
  const straight: TravelView = {
    path: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
    elapsedTicks: 0,
    totalTicks: 2,
  };

  test('starts at the path head and ends exactly at the destination', () => {
    expect(interpolateTravel({ ...straight, elapsedTicks: 0 }, 0)).toEqual({ x: 0, y: 0 });
    expect(interpolateTravel({ ...straight, elapsedTicks: 2 }, 1)).toEqual({ x: 3, y: 0 });
  });

  test('produces sub-tile positions between ticks, not tile jumps', () => {
    // The whole point: a 4-tile path over 2 ticks advances 1.5 tiles per tick, so
    // half-way through tick 0 the sim must be at 0.75 tiles, never at 0 or 1.
    const mid = interpolateTravel({ ...straight, elapsedTicks: 0 }, 0.5);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(1.5);
    expect(Number.isInteger(mid.x)).toBe(false);
  });

  test('is monotonic across the whole journey', () => {
    let prev = -1;
    for (let tick = 0; tick <= straight.totalTicks; tick++) {
      for (const a of [0, 0.25, 0.5, 0.75, 1]) {
        const { x } = interpolateTravel({ ...straight, elapsedTicks: tick }, a);
        expect(x).toBeGreaterThanOrEqual(prev);
        prev = x;
      }
    }
    expect(prev).toBe(3);
  });

  test('clamps alpha and never runs past the destination', () => {
    expect(interpolateTravel({ ...straight, elapsedTicks: 2 }, 5)).toEqual({ x: 3, y: 0 });
    expect(interpolateTravel({ ...straight, elapsedTicks: 0 }, -3)).toEqual({ x: 0, y: 0 });
    expect(interpolateTravel({ ...straight, elapsedTicks: 99 }, 1)).toEqual({ x: 3, y: 0 });
  });

  test('handles an L-shaped path on both axes', () => {
    const bend: TravelView = {
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      elapsedTicks: 0,
      totalTicks: 2,
    };
    expect(interpolateTravel({ ...bend, elapsedTicks: 1 }, 0)).toEqual({ x: 0, y: 1 });
    expect(interpolateTravel({ ...bend, elapsedTicks: 2 }, 0)).toEqual({ x: 1, y: 1 });
  });

  test('degenerate paths do not throw', () => {
    expect(interpolateTravel({ path: [{ x: 4, y: 4 }], elapsedTicks: 0, totalTicks: 1 }, 0.5)).toEqual({ x: 4, y: 4 });
    expect(interpolateTravel({ path: [], elapsedTicks: 0, totalTicks: 0 }, 0.5)).toEqual({ x: 0, y: 0 });
  });

  /**
   * SPEC §5's loop is `if !current: startNext() or idle()`, and until Joe's 2026-07-31
   * ruling the second half had no renderer: nothing running read as `stand`, so the
   * authored `idle` pose, its three variants, and `scene-layout.ts`'s `droop && idle`
   * branch were all unreachable — 20 baked sprites with no way in.
   */
  test('nothing running is idle, not standing', () => {
    const s = fresh();
    expect(s.current).toBeNull();
    expect(deriveRenderView(s, content).pose).toBe('idle');
  });

  test('a running activity still poses as that activity, not idle', () => {
    const { s } = advanceUntil((x) => x.next.current?.type === 'activity');
    expect(deriveRenderView(s, content).pose).not.toBe('idle');
  });

  test('travelling still walks, so the gap rule cannot swallow a journey', () => {
    const { s, r } = advanceUntil((x) => x.snapshot.render.travel !== null);
    expect(deriveRenderView(s, content, r.snapshot.render.travel).pose).toBe('walk');
  });

  test('a real journey from the engine interpolates without leaving the path bounds', () => {
    const { r } = advanceUntil((x) => x.snapshot.render.travel !== null);
    const travel = r.snapshot.render.travel!;
    const xs = travel.path.map((p) => p.x);
    const ys = travel.path.map((p) => p.y);
    for (const a of [0, 0.33, 0.66, 1]) {
      const p = interpolateTravel(travel, a);
      expect(p.x).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(p.x).toBeLessThanOrEqual(Math.max(...xs));
      expect(p.y).toBeGreaterThanOrEqual(Math.min(...ys));
      expect(p.y).toBeLessThanOrEqual(Math.max(...ys));
    }
  });
});
