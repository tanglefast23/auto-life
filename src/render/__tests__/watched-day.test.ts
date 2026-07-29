import { GameLoop, msPerTick } from '../../application/loop';
import { newGameState } from '../../sim/state';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import atlasIndexJson from '../../../assets/generated/atlas-index.json';
import { buildCharacterQuad, buildStaticQuads, lookup, TILE, type AtlasIndex } from '../scene-layout';
import { buildWalkGrid } from '../../sim/travel';

const index = atlasIndexJson as AtlasIndex;

/**
 * "A complete placeholder day is watchable" (master §5's P3 exit), asserted headlessly.
 *
 * This exists because the browser cannot supply it: a headless pane is never composited,
 * so `requestAnimationFrame` fires zero frames and the app — correctly, per SPEC §5/C1 —
 * stays hard-paused. Measured: 0 RAF frames in 6.2 s. The rendered-frame evidence
 * therefore comes from a real browser (recorded in evidence/P3.md), and everything that
 * can be checked without a compositor is checked here instead.
 */

const fresh = () => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

/** Drive a whole day at a given speed, sampling the character quad every tick. */
function watchOneDay(speed: 1 | 2 | 4) {
  const loop = new GameLoop(fresh(), content);
  loop.setSpeed(speed);
  const per = msPerTick(speed);

  const quads: { x: number; y: number; sprite: string }[] = [];
  const tiles = new Set<string>();
  const sprites = new Set<string>();
  const labels = new Set<string>();
  let phase = 0;

  for (let t = 0; t < 1440; t++) {
    loop.advance(per);
    const snap = loop.snapshot!;
    // Sample mid-tick, where interpolation is actually doing work.
    phase = (phase + 0.37) % 1;
    const q = buildCharacterQuad(snap.render, 0.5, phase);
    quads.push(q);
    sprites.add(q.sprite);
    labels.add(snap.currentLabel);
    tiles.add(`${snap.render.position.x},${snap.render.position.y}`);
  }
  return { loop, quads, tiles, sprites, labels };
}

describe('a complete placeholder day is watchable', () => {
  const day = watchOneDay(1);

  test('the full day runs and the clock completes a cycle', () => {
    expect(day.loop.stats.ticksRun).toBe(1440);
    expect(day.loop.snapshot!.day).toBe(2); // 1440 ticks from Day 1 07:00 lands in Day 2
  });

  test('every character sprite drawn across the day exists in the atlas', () => {
    expect(day.sprites.size).toBeGreaterThan(1);
    for (const s of day.sprites) expect(() => lookup(index, s)).not.toThrow();
  });

  test('the sim visits several rooms — the day has visible movement in it', () => {
    // Distinct tiles occupied over the day. A stationary sim would be 1.
    expect(day.tiles.size).toBeGreaterThan(10);
  });

  test('the sim never leaves the walkable grid', () => {
    const walk = buildWalkGrid(content.homeMap, content.objects);
    for (const key of day.tiles) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      expect(walk[y]?.[x]).toBe(true);
    }
  });

  test('the character quad always stays inside the rendered room', () => {
    const maxX = content.homeMap.width * TILE;
    const maxY = content.homeMap.height * TILE;
    for (const q of day.quads) {
      expect(q.x).toBeGreaterThanOrEqual(0);
      expect(q.x).toBeLessThanOrEqual(maxX);
      // The 48px sprite overhangs its tile upward by 16px, so -16 is the floor.
      expect(q.y).toBeGreaterThanOrEqual(-TILE);
      expect(q.y).toBeLessThanOrEqual(maxY);
    }
  });

  test('the day contains the routine the SPEC describes, not just idling', () => {
    // §7.1's wake block plus the anchored meals and workout should all appear.
    for (const expected of ['toilet', 'brush', 'shower', 'meal', 'sleep']) {
      expect([...day.labels]).toContain(expected);
    }
    expect(day.labels).toContain('idle'); // 79% of waking minutes, by design at P3
  });

  test('interpolation produces sub-tile positions during travel', () => {
    const offGrid = day.quads.filter((q) => q.x % TILE !== 0);
    // Travel is ~32 game-min/day, so a full day must contain sub-tile frames.
    expect(offGrid.length).toBeGreaterThan(0);
  });
});

describe('the watched day is identical at every speed (master §5 exit)', () => {
  test('1×, 2× and 4× draw the same frames', () => {
    const one = watchOneDay(1);
    const two = watchOneDay(2);
    const four = watchOneDay(4);
    const asKey = (d: ReturnType<typeof watchOneDay>) => JSON.stringify(d.quads);
    expect(asKey(two)).toBe(asKey(one));
    expect(asKey(four)).toBe(asKey(one));
    // And the underlying sim agrees too.
    expect(JSON.stringify(two.loop.peekState())).toBe(JSON.stringify(one.loop.peekState()));
    expect(JSON.stringify(four.loop.peekState())).toBe(JSON.stringify(one.loop.peekState()));
  });
});

describe('the static scene is stable', () => {
  test('it is built once and never varies', () => {
    const a = buildStaticQuads(content.homeMap, content.objects);
    const b = buildStaticQuads(content.homeMap, content.objects);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // 24×14 tiles + one quad per object.
    expect(a).toHaveLength(content.homeMap.width * content.homeMap.height + content.objects.objects.length);
  });

  test('the first frame already has a world — no blank paint before tick 1', () => {
    const loop = new GameLoop(fresh(), content);
    expect(loop.snapshot).not.toBeNull();
    expect(loop.stats.ticksRun).toBe(0);
    expect(loop.snapshot!.render.position).toEqual({ x: 4, y: 2 }); // at the bed, per initial-state
    expect(loop.snapshot!.health).toBe(75); // SPEC §6.1 Day-1 start
  });
});
