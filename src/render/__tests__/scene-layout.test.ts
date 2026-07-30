import { content } from '../../sim/content';
import atlasIndexJson from '../../../assets/generated/atlas-index.json';
import {
  advancePhase,
  buildCharacterQuad,
  buildDecorationQuads,
  buildObjectQuads,
  buildStaticQuads,
  buildTileQuads,
  characterSprite,
  CHAR_H,
  lookup,
  snapToPhysicalPixel,
  TILE,
  type AtlasIndex,
} from '../scene-layout';
import type { RenderView } from '../../sim/render-view';

const index = atlasIndexJson as AtlasIndex;

/** P3 T6 — the scene decides what goes where; this proves it without a canvas. */

describe('the atlas covers everything the scene asks for', () => {
  test('every quad the static scene emits resolves to a real sprite', () => {
    for (const q of buildStaticQuads(content.homeMap, content.objects)) {
      expect(() => lookup(index, q.sprite)).not.toThrow();
    }
  });

  test('every character sprite the selector can produce exists', () => {
    for (const pose of ['walk', 'stand', 'sit', 'sleep'] as const) {
      for (const facing of ['up', 'down', 'left', 'right'] as const) {
        for (const phase of [0, 0.6]) {
          expect(() => lookup(index, characterSprite(pose, facing, phase))).not.toThrow();
        }
      }
    }
  });

  test('a missing sprite fails loudly with a fix instruction, not silently', () => {
    expect(() => lookup(index, 'char.does-not-exist')).toThrow(/regenerate with npm run art:atlas/);
  });
});

describe('tiles', () => {
  test('one quad per grid cell, covering the whole 24×14 room', () => {
    const quads = buildTileQuads(content.homeMap);
    expect(quads).toHaveLength(content.homeMap.width * content.homeMap.height);
    const xs = quads.map((q) => q.x);
    const ys = quads.map((q) => q.y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe((content.homeMap.width - 1) * TILE);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe((content.homeMap.height - 1) * TILE);
  });

  test('glyph→room mapping comes from content, so every glyph is accounted for', () => {
    const used = new Set(buildTileQuads(content.homeMap).map((q) => q.sprite));
    for (const room of Object.keys(content.homeMap.rooms)) expect(used).toContain(`tile.${room}`);
    expect(used).toContain('tile.wall');
  });

  test('an unknown glyph is a loud content error, not a blank tile', () => {
    const broken = { ...content.homeMap, grid: ['?'] };
    expect(() => buildTileQuads(broken)).toThrow(/maps to no room or wall/);
  });
});

describe('objects', () => {
  test('one quad per object, positioned at its footprint top-left', () => {
    const quads = buildObjectQuads(content.objects);
    expect(quads).toHaveLength(content.objects.objects.length);
    const bed = content.objects.objects.find((o) => o.id === 'bed')!;
    const bedQuad = quads.find((q) => q.sprite === 'object.bed')!;
    expect(bedQuad.x).toBe(Math.min(...bed.footprint.map(([x]) => x)) * TILE);
    expect(bedQuad.y).toBe(Math.min(...bed.footprint.map(([, y]) => y)) * TILE);
  });

  test('draw order is lower-on-screen-last, and stable across calls', () => {
    const a = buildObjectQuads(content.objects);
    const b = buildObjectQuads(content.objects);
    expect(a.map((q) => q.sprite)).toEqual(b.map((q) => q.sprite));
    for (let i = 1; i < a.length; i++) expect(a[i]!.y).toBeGreaterThanOrEqual(a[i - 1]!.y - TILE * 2);
  });

  test('the atlas sprite matches each object footprint size', () => {
    for (const o of content.objects.objects) {
      const xs = o.footprint.map(([x]) => x);
      const ys = o.footprint.map(([, y]) => y);
      const r = lookup(index, `object.${o.id}`);
      expect(r.w).toBe((Math.max(...xs) - Math.min(...xs) + 1) * TILE);
      expect(r.h).toBe((Math.max(...ys) - Math.min(...ys) + 1) * TILE);
    }
  });
});

describe('run decorations', () => {
  test('grants map to stable world slots while unknown future ids fail soft', () => {
    expect(buildDecorationQuads([])).toEqual([]);
    expect(
      buildDecorationQuads([
        'leafy-plant',
        'sunny-vase',
        'bedroom-plant',
        'wrinkle-keepsake',
        'wrinkle-print',
        'practice-poster',
        'future-decoration',
      ]),
    ).toEqual([
      { sprite: 'decoration.leafy-plant', x: 648, y: 236 },
      { sprite: 'decoration.sunny-vase', x: 680, y: 236 },
      { sprite: 'decoration.leafy-plant', x: 264, y: 44 },
      { sprite: 'decoration.sunny-vase', x: 72, y: 268 },
      { sprite: 'decoration.leafy-plant', x: 104, y: 268 },
      { sprite: 'decoration.sunny-vase', x: 328, y: 44 },
    ]);
  });
});

describe('the character quad', () => {
  const base: RenderView = {
    position: { x: 5, y: 7 },
    facing: 'down',
    pose: 'stand',
    travel: null,
    activityProgress: null,
    mSpeed: 1,
  };

  test('stands feet-on-tile — the 48px sprite is lifted onto a 32px tile', () => {
    const q = buildCharacterQuad(base, 0, 0);
    expect(q.x).toBe(5 * TILE);
    expect(q.y).toBe(7 * TILE - (CHAR_H - TILE));
  });

  test('movement can be locked to the physical pixel grid without snapping back to tiles', () => {
    const logical = 38.4;
    const snapped = snapToPhysicalPixel(logical, 3);
    expect(snapped * 3).toBe(Math.round(logical * 3));
    expect(snapped).toBeGreaterThan(TILE);
    expect(snapped).toBeLessThan(TILE * 2);
  });

  test('pixel-grid locking fails soft for invalid display scales', () => {
    expect(snapToPhysicalPixel(38.4, 0)).toBe(38.4);
    expect(snapToPhysicalPixel(38.4, Number.NaN)).toBe(38.4);
  });

  test('while travelling the position is interpolated, not snapped', () => {
    const travelling: RenderView = {
      ...base,
      pose: 'walk',
      travel: {
        path: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
        elapsedTicks: 0,
        totalTicks: 1,
      },
    };
    const start = buildCharacterQuad(travelling, 0, 0).x;
    const mid = buildCharacterQuad(travelling, 0.3, 0).x;
    const end = buildCharacterQuad(travelling, 1, 0).x;
    expect(start).toBe(0);
    expect(end).toBe(4 * TILE);
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeLessThan(end);
    // The whole point: a sub-tile x. (alpha 0.5 would land on 2.0 tiles exactly —
    // interpolation working, assertion badly chosen; 0.3 gives 1.2 tiles.)
    expect(mid % TILE).not.toBe(0);
    expect(mid).toBeCloseTo(1.2 * TILE, 6);
  });

  test('walking alternates two frames; standing pins frame 0', () => {
    expect(characterSprite('walk', 'down', 0.0)).toBe('char.walk-down-0');
    expect(characterSprite('walk', 'down', 0.7)).toBe('char.walk-down-1');
    expect(characterSprite('stand', 'down', 0.7)).toBe('char.walk-down-0');
  });

  test('facing selects the direction sprite', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(characterSprite('walk', facing, 0)).toBe(`char.walk-${facing}-0`);
    }
  });

  test('sitting and sleeping use the seated frame regardless of facing', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(characterSprite('sit', facing, 0.3)).toBe('char.sit-down');
      expect(characterSprite('sleep', facing, 0.9)).toBe('char.sit-down');
    }
  });
});

describe('walk tempo tracks m_speed (SPEC §11.3)', () => {
  test('a rested sim cycles faster than a drained one', () => {
    const rested = advancePhase(0, 100, 1.5);
    const drained = advancePhase(0, 100, 0.5);
    expect(rested).toBeGreaterThan(drained);
    expect(rested / drained).toBeCloseTo(3, 5); // the full 0.5–1.5 m_speed range
  });

  test('phase stays in [0,1) so the frame selector never runs off the end', () => {
    let phase = 0;
    for (let i = 0; i < 500; i++) {
      phase = advancePhase(phase, 33, 1.5);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });

  test('a zero-length frame does not advance the cycle', () => {
    expect(advancePhase(0.25, 0, 1)).toBeCloseTo(0.25, 10);
  });
});
