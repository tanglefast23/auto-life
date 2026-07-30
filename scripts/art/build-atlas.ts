import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { content } from '../../src/sim/content';
import { APPEARANCE_PALETTES } from '../../src/render/appearance';
import { CHARACTER_BILL, POSE_FRAMES, renderCharacterFrame } from '../../src/render/sprites/character';
import { renderObject } from '../../src/render/sprites/objects';
import { DECORATION_SPRITES, renderDecoration } from '../../src/render/sprites/decorations';
import { ICON_SPRITES, renderIcon } from '../../src/render/sprites/icons';
import { LIGHTING_STATES, registerTiles, renderTile, TILE_SPRITES } from '../../src/render/sprites/tiles';
import { blit, createBitmap, encodePng, type Bitmap } from './png';
import { auditBitmap, formatReport, reportIsClean, type Track } from './validate-palette';

/**
 * Builds the single texture the scene draws with `<Atlas>`.
 *
 * Master §9: Atlas is mandatory from the first sprite renderer — never one component per
 * sprite. Every tile, object, character frame, decoration and icon lives in ONE image with
 * a sub-rect index, which is what this produces.
 *
 * P6 replaced every placeholder this file used to generate. It no longer contains a single
 * `box()` call: objects, tiles, characters, decorations and icons are all authored shape
 * sets, and each renderer throws for an unauthored id rather than emitting a blank — so a
 * new object or activity in content fails the build instead of shipping as a grey square.
 *
 * Output is byte-reproducible, so `npm run art:check` can diff the committed atlas against
 * a fresh build and mean something.
 *
 * **Why RGBA and not indexed PNG (P6 T1, tested 2026-07-31).** design.md §2 asks for
 * indexed PNG and P3 deferred it to this phase. `encodeIndexedPng` was written, its
 * round-trip is proven in `art-gates.test.ts`, and Chrome decodes its output correctly
 * (verified in the exported build: colour type 3, 1024×420, 15 KB versus 30 KB for RGBA).
 * **CanvasKit does not.** `useImage` returned null forever, `WorldScene` rendered nothing,
 * and the world was blank with no console error to explain it — the exact silent-blank
 * failure mode P0's kill-gate exists to catch, reached from a different direction.
 *
 * So the encoder stays, tested and unused, and the atlas ships RGBA. This is a container
 * change only: the palette validator enforces §2 membership on every pixel in CI, so no
 * off-palette colour can ship either way. Owner for revisiting: **v1.1**, when the mobile
 * pass re-examines the Skia version.
 */

export const TILE = 32;

/** Pack width. Raised from 512 in P6: four baked appearances put 192 character frames in. */
const PACK_WIDTH = 1024;

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
  /** Frame count per pose key, so the renderer never hard-codes a cycle length. */
  poses: Record<string, number>;
  /** Appearance ids that have baked character frames. */
  appearances: string[];
}

interface Entry {
  name: string;
  bmp: Bitmap;
  track: Track;
}

function collectEntries(): Entry[] {
  const entries: Entry[] = [];

  // Tiles: one per room per lighting state, plus the wall and the lamp pool.
  registerTiles(content.homeMap.materials);
  for (const name of Object.keys(TILE_SPRITES)) {
    const bmp = renderTile(name);
    // The daytime lamp is deliberately empty — a lit lamp at noon would read as a bug —
    // so it is the one sprite allowed to have no opaque pixels.
    if (name === 'lamp.day') continue;
    entries.push({ name: `tile.${name}`, bmp, track: 'world' });
  }

  // Objects: authored silhouettes sized to the footprint's bounding box.
  for (const o of content.objects.objects) {
    entries.push({ name: `object.${o.id}`, bmp: renderObject(o.id), track: 'world' });
    if (o.activities.length > 0) {
      entries.push({ name: `object.${o.id}.active`, bmp: renderObject(o.id, 'active'), track: 'world' });
    }
  }

  for (const name of Object.keys(DECORATION_SPRITES)) {
    entries.push({ name: `decoration.${name}`, bmp: renderDecoration(name), track: 'world' });
  }

  // Characters: the full bill baked once per appearance. Same shapes, different palette
  // indices — design.md §6's "zero redrawn frames", literally.
  for (const [paletteId, palette] of Object.entries(APPEARANCE_PALETTES)) {
    for (const frame of CHARACTER_BILL) {
      entries.push({
        name: `char.${paletteId}.${frame}`,
        bmp: renderCharacterFrame(frame, palette),
        track: 'character',
      });
    }
  }

  for (const name of Object.keys(ICON_SPRITES)) {
    entries.push({ name: `icon.${name}`, bmp: renderIcon(name), track: 'ui' });
  }

  return entries;
}

/**
 * Shelf packer: rows of sprites wrapping at `PACK_WIDTH`. Deterministic — input order is
 * stable, so the atlas is byte-reproducible and safe to commit.
 */
function pack(entries: Entry[], maxWidth = PACK_WIDTH): { atlas: Bitmap; index: AtlasIndex } {
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
  return {
    atlas,
    index: {
      width,
      height,
      tile: TILE,
      sprites,
      poses: { ...POSE_FRAMES },
      appearances: Object.keys(APPEARANCE_PALETTES),
    },
  };
}

export function buildAtlas(): { atlas: Bitmap; index: AtlasIndex } {
  return pack(collectEntries());
}

export function main(): void {
  const entries = collectEntries();

  // The design.md §12 gate applies per entry, not just to the packed sheet: auditing only
  // the flattened atlas cannot tell a world sprite from a character one, and the Track-B
  // outline rule differs between them.
  const failures = entries
    .map((e) => auditBitmap(e.name, e.bmp, e.track))
    .filter((r) => !reportIsClean(r));
  if (failures.length > 0) {
    for (const r of failures) console.error(formatReport(r));
    console.error(`\n${failures.length} asset(s) FAILED design.md §12.`);
    process.exit(1);
  }

  const { atlas, index } = pack(entries);
  const report = auditBitmap('atlas', atlas, 'ui'); // the packed sheet mixes tracks
  if (report.paletteViolations.length > 0 || report.forbiddenExtremes.length > 0) {
    console.error(formatReport(report));
    process.exit(1);
  }

  const outDir = resolve(__dirname, '../../assets/generated');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'atlas.png'), encodePng(atlas));
  writeFileSync(resolve(outDir, 'atlas-index.json'), `${JSON.stringify(index, null, 2)}\n`);

  const names = Object.keys(index.sprites);
  const count = (prefix: string) => names.filter((n) => n.startsWith(prefix)).length;
  console.log(
    `atlas ${atlas.width}×${atlas.height}, ${names.length} sprites, ${report.distinctColours} colours — validator green`,
  );
  console.log(`  tiles:       ${count('tile.')} (${LIGHTING_STATES.length} lighting states)`);
  console.log(`  objects:     ${count('object.')}`);
  console.log(`  decorations: ${count('decoration.')}`);
  console.log(`  characters:  ${count('char.')} (${index.appearances.length} appearances × ${CHARACTER_BILL.length})`);
  console.log(`  icons:       ${count('icon.')}`);
  console.log(`wrote ${outDir}/atlas.png + atlas-index.json`);
}

if (require.main === module) main();
