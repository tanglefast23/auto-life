import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { content } from '../../src/sim/content';
import { A0_BODY_FRAMES, A0_HAIR, A0_OUTFIT } from '../../src/render/sprites/a0';
import { rasterize, SPRITE_H, SPRITE_W, type BodyFrame } from '../../src/render/sprite-spec';
import {
  CREAM_SHADOW,
  DUSK_PLUM,
  GREY,
  hexToRgb,
  INK,
  LEAF_GREEN,
  LANTERN_GOLD,
  TERRACOTTA,
  WATER_BLUE,
  WOOD,
} from '../../src/render/palette';
import { blit, createBitmap, encodePng, type Bitmap } from './png';
import { auditBitmap, formatReport, reportIsClean } from './validate-palette';

/**
 * Builds the single placeholder texture the P3 scene draws with `<Atlas>`.
 *
 * Master §9: Atlas is mandatory from the first sprite renderer — never one component
 * per sprite. That means every tile, object, and character frame has to live in ONE
 * image with a sub-rect index, which is what this produces.
 *
 * Master convention 7: these are placeholders. Flat palette boxes for the world, and
 * the A0 character frames for the sim. Real art is P6's. The one thing that is NOT a
 * simplification is the character's face and hair layers — A0 proved facing is
 * unreadable without them (evidence/A0.md), so they ship here.
 */

export const TILE = 32;

/** Placeholder tile fills. Each room gets a distinguishable ramp so the layout reads at a glance. */
const ROOM_FILL: Record<string, { base: string; edge: string }> = {
  bedroom: { base: DUSK_PLUM.light, edge: DUSK_PLUM.base },
  bathroom: { base: WATER_BLUE.light, edge: WATER_BLUE.base },
  living: { base: WOOD.light, edge: WOOD.base },
  kitchen: { base: GREY.light, edge: GREY.base },
  hall: { base: WOOD.base, edge: WOOD.shadow },
};
// design.md §3 Track B: world outlines are the fill ramp's SHADOW, never Ink — Ink
// outlines are the UI track. Pass 4 caught wall/tv/bench using Ink while the
// palette-membership validator still reported green (it checks colours, not roles).
const WALL_FILL = { base: WOOD.shadow, edge: WOOD.shadow };

/** Placeholder object fills, by object id. Ramp choice follows design.md §2's "owns" column. */
const OBJECT_FILL: Record<string, { base: string; edge: string }> = {
  bed: { base: DUSK_PLUM.base, edge: DUSK_PLUM.shadow },
  toilet: { base: WATER_BLUE.base, edge: WATER_BLUE.shadow },
  sink: { base: WATER_BLUE.base, edge: WATER_BLUE.shadow },
  shower: { base: WATER_BLUE.base, edge: WATER_BLUE.shadow },
  fridge: { base: GREY.base, edge: GREY.shadow },
  microwave: { base: GREY.base, edge: GREY.shadow },
  counter: { base: WOOD.base, edge: WOOD.shadow },
  couch: { base: TERRACOTTA.base, edge: TERRACOTTA.shadow },
  tv: { base: GREY.shadow, edge: GREY.shadow },
  bench: { base: GREY.shadow, edge: GREY.shadow },
  treadmill: { base: GREY.base, edge: GREY.shadow },
  rug: { base: TERRACOTTA.light, edge: TERRACOTTA.base },
  guitar: { base: WOOD.light, edge: WOOD.shadow },
  'front-door': { base: WOOD.base, edge: WOOD.shadow },
  wardrobe: { base: WOOD.base, edge: WOOD.shadow },
};

function box(w: number, h: number, base: string, edge: string): Bitmap {
  const bmp = createBitmap(w, h);
  const b = hexToRgb(base);
  const e = hexToRgb(edge);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const c = onEdge ? e : b;
      const i = (y * w + x) * 4;
      bmp.data[i] = c.r;
      bmp.data[i + 1] = c.g;
      bmp.data[i + 2] = c.b;
      bmp.data[i + 3] = 255;
    }
  }
  return bmp;
}

function fillRect(
  bmp: Bitmap,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  const rgb = hexToRgb(color);
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      const i = (py * bmp.width + px) * 4;
      bmp.data[i] = rgb.r;
      bmp.data[i + 1] = rgb.g;
      bmp.data[i + 2] = rgb.b;
      bmp.data[i + 3] = 255;
    }
  }
}

function leafyPlant(): Bitmap {
  const bmp = createBitmap(16, 24);
  fillRect(bmp, 7, 6, 2, 11, LEAF_GREEN.shadow);
  fillRect(bmp, 2, 5, 6, 5, LEAF_GREEN.base);
  fillRect(bmp, 4, 2, 5, 6, LEAF_GREEN.light);
  fillRect(bmp, 8, 1, 5, 7, LEAF_GREEN.base);
  fillRect(bmp, 9, 7, 5, 5, LEAF_GREEN.light);
  fillRect(bmp, 3, 15, 10, 3, TERRACOTTA.shadow);
  fillRect(bmp, 4, 18, 8, 5, TERRACOTTA.base);
  fillRect(bmp, 5, 18, 6, 2, TERRACOTTA.light);
  return bmp;
}

function sunnyVase(): Bitmap {
  const bmp = createBitmap(16, 24);
  fillRect(bmp, 7, 4, 2, 10, LEAF_GREEN.shadow);
  fillRect(bmp, 3, 2, 4, 4, LANTERN_GOLD.base);
  fillRect(bmp, 9, 1, 4, 4, LANTERN_GOLD.light);
  fillRect(bmp, 6, 4, 4, 3, LANTERN_GOLD.shadow);
  fillRect(bmp, 5, 12, 6, 3, DUSK_PLUM.shadow);
  fillRect(bmp, 3, 15, 10, 7, DUSK_PLUM.base);
  fillRect(bmp, 5, 15, 6, 4, DUSK_PLUM.light);
  fillRect(bmp, 5, 22, 6, 1, DUSK_PLUM.shadow);
  return bmp;
}

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface AtlasIndex {
  /** Atlas texture dimensions, so the renderer never guesses. */
  width: number;
  height: number;
  tile: number;
  sprites: Record<string, SpriteRect>;
}

interface Entry {
  name: string;
  bmp: Bitmap;
}

function collectEntries(): Entry[] {
  const entries: Entry[] = [];

  // Tiles: one per room glyph, plus the wall.
  for (const [room, fill] of Object.entries(ROOM_FILL)) {
    entries.push({ name: `tile.${room}`, bmp: box(TILE, TILE, fill.base, fill.edge) });
  }
  entries.push({ name: 'tile.wall', bmp: box(TILE, TILE, WALL_FILL.base, WALL_FILL.edge) });

  // Objects: sized to the footprint's bounding box so the scene can draw one quad each.
  for (const o of content.objects.objects) {
    const xs = o.footprint.map(([x]) => x);
    const ys = o.footprint.map(([, y]) => y);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * TILE;
    const h = (Math.max(...ys) - Math.min(...ys) + 1) * TILE;
    const fill = OBJECT_FILL[o.id];
    if (!fill) throw new Error(`no placeholder fill for object "${o.id}" — add one to OBJECT_FILL`);
    entries.push({ name: `object.${o.id}`, bmp: box(w, h, fill.base, fill.edge) });
  }

  entries.push({
    name: 'decoration.leafy-plant',
    bmp: leafyPlant(),
  });
  entries.push({
    name: 'decoration.sunny-vase',
    bmp: sunnyVase(),
  });

  // Character: A0's average build, full layer stack. v1 ships average only (design.md §6).
  for (const frame of A0_BODY_FRAMES as readonly BodyFrame[]) {
    const frameIndex = frame.id.endsWith('-1') ? 1 : 0;
    entries.push({
      name: `char.${frame.id.replace('average-', '')}`,
      bmp: rasterize({ frame, frameIndex, hair: A0_HAIR, outfit: A0_OUTFIT }),
    });
  }

  // The interact-point marker: a placeholder stand-in so travel targets are visible while
  // debugging the scene. Not shipped art; P6 removes it.
  entries.push({ name: 'debug.interact', bmp: box(8, 8, LEAF_GREEN.base, LEAF_GREEN.shadow) });

  return entries;
}

/**
 * Shelf packer: rows of sprites, wrapping at `maxWidth`. Deterministic (input order is
 * stable, so the atlas is byte-reproducible and safe to commit).
 */
function pack(entries: Entry[], maxWidth = 512): { atlas: Bitmap; index: AtlasIndex } {
  const placed: (SpriteRect & { name: string; bmp: Bitmap })[] = [];
  let cx = 0;
  let cy = 0;
  let rowH = 0;
  for (const e of entries) {
    if (cx + e.bmp.width > maxWidth) {
      cx = 0;
      cy += rowH + 1;
      rowH = 0;
    }
    placed.push({ name: e.name, bmp: e.bmp, x: cx, y: cy, w: e.bmp.width, h: e.bmp.height });
    cx += e.bmp.width + 1; // 1px gutter stops bilinear bleed if sampling ever changes
    rowH = Math.max(rowH, e.bmp.height);
  }
  const width = maxWidth;
  const height = cy + rowH;
  const atlas = createBitmap(width, height);
  const sprites: Record<string, SpriteRect> = {};
  for (const p of placed) {
    blit(atlas, p.bmp, p.x, p.y);
    sprites[p.name] = { x: p.x, y: p.y, w: p.w, h: p.h };
  }
  return { atlas, index: { width, height, tile: TILE, sprites } };
}

export function buildAtlas(): { atlas: Bitmap; index: AtlasIndex } {
  return pack(collectEntries());
}

export function main(): void {
  const { atlas, index } = buildAtlas();

  // The CI gate applies to placeholders too (design.md §12).
  const report = auditBitmap('atlas', atlas);
  if (!reportIsClean(report)) {
    console.error(formatReport(report));
    console.error('\nATLAS FAILED design.md §12.');
    process.exit(1);
  }

  const outDir = resolve(__dirname, '../../assets/generated');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'atlas.png'), encodePng(atlas));
  writeFileSync(resolve(outDir, 'atlas-index.json'), `${JSON.stringify(index, null, 2)}\n`);

  const names = Object.keys(index.sprites);
  console.log(`atlas ${atlas.width}×${atlas.height}, ${names.length} sprites, ${report.distinctColours} colours — validator green`);
  console.log(`  tiles:   ${names.filter((n) => n.startsWith('tile.')).length}`);
  console.log(`  objects: ${names.filter((n) => n.startsWith('object.')).length}`);
  console.log(`  chars:   ${names.filter((n) => n.startsWith('char.')).length}`);
  console.log(`wrote ${outDir}/atlas.png + atlas-index.json`);
}

if (require.main === module) main();
