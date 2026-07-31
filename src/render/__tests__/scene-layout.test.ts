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
  dwelledPose,
  IDLE_DWELL_MS,
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

  test('every character sprite the selector can produce exists, in every appearance', () => {
    const poses = [
      'walk', 'stand', 'sleep', 'nap', 'sit', 'eat', 'brush', 'shower',
      'lift', 'run', 'stretch', 'practice', 'toilet', 'quickwash', 'idle',
    ] as const;
    for (const paletteId of index.appearances) {
      for (const pose of poses) {
        for (const facing of ['up', 'down', 'left', 'right'] as const) {
          for (const phase of [0, 0.6, 0.99]) {
            for (const droop of [false, true]) {
              expect(() =>
                lookup(index, characterSprite(index, paletteId, pose, facing, phase, droop)),
              ).not.toThrow();
            }
          }
        }
      }
    }
  });

  test('every authored idle variant resolves, and an unknown one falls back', () => {
    for (const variant of ['window-gazing', 'slow-stretching', 'air-guitar']) {
      const name = characterSprite(index, 'moss-green', 'idle', 'down', 0, false, variant);
      expect(name).toBe(`char.moss-green.idle-${variant}-0`);
      expect(() => lookup(index, name)).not.toThrow();
    }
    // A save may carry a variant from a later version; a flourish must not crash a career.
    expect(characterSprite(index, 'moss-green', 'idle', 'down', 0, false, 'not-authored'))
      .toBe('char.moss-green.idle-0');
  });

  test('an unauthored pose throws instead of silently reusing a walk frame', () => {
    expect(() =>
      characterSprite(index, 'moss-green', 'flying' as never, 'down', 0),
    ).toThrow(/no frames for pose/);
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
    for (const room of Object.keys(content.homeMap.rooms)) {
      expect(used).toContain(`tile.${room}.day`);
    }
    expect(used).toContain('tile.wall.day');
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
      { sprite: 'decoration.trailing-vine', x: 264, y: 44 },
      { sprite: 'decoration.keepsake-box', x: 72, y: 268 },
      { sprite: 'decoration.framed-print', x: 104, y: 268 },
      { sprite: 'decoration.practice-poster', x: 328, y: 44 },
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
    droop: false,
  };

  test('stands feet-on-tile — the 48px sprite is lifted onto a 32px tile', () => {
    const q = buildCharacterQuad(index, 'moss-green', base, 0, 0);
    expect(q.x).toBe(5 * TILE);
    expect(q.y).toBe(7 * TILE - (CHAR_H - TILE));
  });

  test('glances at the queue rail on the right when the queue changes (SPEC §11.3)', () => {
    expect(buildCharacterQuad(index, 'moss-green', base, 0, 0).sprite)
      .toBe('char.moss-green.walk-down-0');
    expect(buildCharacterQuad(index, 'moss-green', base, 0, 0, null, 'right').sprite)
      .toBe('char.moss-green.walk-right-0');
  });

  test('a glance never redirects a walking sim — her facing is her direction of travel', () => {
    const walking: RenderView = {
      ...base,
      pose: 'walk',
      facing: 'left',
      travel: {
        path: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
        elapsedTicks: 0,
        totalTicks: 1,
      },
    };
    // Turning her head mid-path would draw her striding sideways.
    expect(buildCharacterQuad(index, 'moss-green', walking, 0, 0, null, 'right').sprite)
      .toBe(buildCharacterQuad(index, 'moss-green', walking, 0, 0).sprite);
  });

  test('a glance never disturbs a pose with one authored orientation', () => {
    const asleep: RenderView = { ...base, pose: 'sleep' };
    expect(buildCharacterQuad(index, 'moss-green', asleep, 0, 0, null, 'right').sprite)
      .toBe(buildCharacterQuad(index, 'moss-green', asleep, 0, 0).sprite);
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
    const start = buildCharacterQuad(index, 'moss-green', travelling, 0, 0).x;
    const mid = buildCharacterQuad(index, 'moss-green', travelling, 0.3, 0).x;
    const end = buildCharacterQuad(index, 'moss-green', travelling, 1, 0).x;
    expect(start).toBe(0);
    expect(end).toBe(4 * TILE);
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeLessThan(end);
    // The whole point: a sub-tile x. (alpha 0.5 would land on 2.0 tiles exactly —
    // interpolation working, assertion badly chosen; 0.3 gives 1.2 tiles.)
    expect(mid % TILE).not.toBe(0);
    expect(mid).toBeCloseTo(1.2 * TILE, 6);
  });

  test('walking runs a four-frame cycle; standing pins frame 0', () => {
    expect(characterSprite(index, 'moss-green', 'walk', 'down', 0.0)).toBe('char.moss-green.walk-down-0');
    expect(characterSprite(index, 'moss-green', 'walk', 'down', 0.3)).toBe('char.moss-green.walk-down-1');
    expect(characterSprite(index, 'moss-green', 'walk', 'down', 0.6)).toBe('char.moss-green.walk-down-2');
    expect(characterSprite(index, 'moss-green', 'walk', 'down', 0.9)).toBe('char.moss-green.walk-down-3');
    expect(characterSprite(index, 'moss-green', 'stand', 'down', 0.7)).toBe('char.moss-green.walk-down-0');
  });

  test('a tired sim droops instead of standing (design.md §10)', () => {
    expect(characterSprite(index, 'moss-green', 'stand', 'down', 0, true))
      .toBe('char.moss-green.stand-droop-0');
  });

  test('facing selects the direction sprite', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(characterSprite(index, 'moss-green', 'walk', facing, 0)).toBe(`char.moss-green.walk-${facing}-0`);
    }
  });

  test('sitting and sleeping now have their own frames, and are not each other', () => {
    // P3 mapped both onto one seated frame, which is why a sleeping sim looked like a
    // sitting one. They are separate poses in design.md §6's bill and must stay separate.
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(characterSprite(index, 'moss-green', 'sit', facing, 0.3)).toMatch(/^char\.moss-green\.sit-\d$/);
      expect(characterSprite(index, 'moss-green', 'sleep', facing, 0.9)).toMatch(/^char\.moss-green\.sleep-\d$/);
    }
    expect(characterSprite(index, 'moss-green', 'sit', 'down', 0))
      .not.toBe(characterSprite(index, 'moss-green', 'sleep', 'down', 0));
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

/**
 * The idle dwell guard.
 *
 * Making `idle` reachable exposed a second problem the read-model cannot see: measured on
 * a seven-day seeded run, *every* idle stretch under the default autonomy is exactly one
 * tick — 428 of them, mean run length 1.00. One tick is 0.5s of real time at 1× and 0.125s
 * at 4×, so the sim struck a pose 428 times a week and never held it long enough to read
 * as anything but a flicker. Goal 4's air-guitar reward is a *single frame*, which is the
 * worst case of all.
 *
 * So the read-model still says `idle` — that is the truth about what she is doing — and
 * the renderer declines to *draw* it until it has lasted long enough to be seen. A pose
 * you cannot hold is not a pose.
 */
describe('idle dwell', () => {
  it('keeps standing through a gap too short to read', () => {
    expect(dwelledPose('idle', 0)).toBe('stand');
    expect(dwelledPose('idle', IDLE_DWELL_MS - 1)).toBe('stand');
  });

  it('strikes the pose once it has lasted', () => {
    expect(dwelledPose('idle', IDLE_DWELL_MS)).toBe('idle');
    expect(dwelledPose('idle', IDLE_DWELL_MS * 10)).toBe('idle');
  });

  it('holds a single-tick gap below the threshold at every playback speed', () => {
    // One tick is 500ms of real time at 1× and 125ms at 4× — the two speeds the DoD
    // measures. Both must stay standing, or the guard does not guard anything.
    for (const oneTickMs of [500, 250, 125]) {
      expect(dwelledPose('idle', oneTickMs)).toBe('stand');
    }
  });

  it('never touches a pose that is not idle', () => {
    for (const pose of ['walk', 'sleep', 'practice', 'eat', 'stand'] as const) {
      expect(dwelledPose(pose, 0)).toBe(pose);
      expect(dwelledPose(pose, IDLE_DWELL_MS * 5)).toBe(pose);
    }
  });
});
