import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { content } from '../../src/sim/content';
import { APPEARANCE_PALETTES } from '../../src/render/appearance';
import { CHARACTER_BILL, renderCharacterFrame } from '../../src/render/sprites/character';
import { renderObject } from '../../src/render/sprites/objects';
import { renderDecoration, DECORATION_SPRITES } from '../../src/render/sprites/decorations';
import { renderIcon, ICON_SPRITES } from '../../src/render/sprites/icons';
import { registerTiles, renderTile, type Lighting } from '../../src/render/sprites/tiles';
import { blit, createBitmap, encodePng, scaleNearest, type Bitmap } from './png';
import { silhouette } from '../../src/render/sprite-spec';

/**
 * Renders review sheets a human actually looks at (P6 T2/T4, design.md §12 step 5).
 *
 * The automated gates prove a sprite is not a rectangle, is on-palette, and has a unique
 * silhouette. **They cannot prove it is a fridge.** HFM's handover is explicit about this
 * (docs/lessons-from-hero-football-manager.md §2.4): its first automated hair recolour
 * passed a test that shared the transform's own faulty assumption, and only a contact
 * sheet caught it.
 *
 * Three sheets, matching that lesson's "inspect worst cases, not the average":
 *  - the **room** in both lighting states, at true size and 2×;
 *  - every **character pose**, in each appearance, plus a flat-Ink silhouette strip;
 *  - **decorations and icons** at 1× and 4×.
 */

const TILE = 32;

function roomSheet(lighting: Lighting): Bitmap {
  const map = content.homeMap;
  const bmp = createBitmap(map.width * TILE, map.height * TILE);
  const glyphToRoom = new Map<string, string>();
  for (const [room, glyph] of Object.entries(map.rooms)) glyphToRoom.set(glyph, room);

  for (let y = 0; y < map.grid.length; y++) {
    const row = map.grid[y]!;
    for (let x = 0; x < row.length; x++) {
      const glyph = row[x]!;
      const room = glyphToRoom.get(glyph);
      const name = glyph === map.walls ? `wall.${lighting}` : `${room}.${lighting}`;
      blit(bmp, renderTile(name), x * TILE, y * TILE);
    }
  }
  if (lighting === 'evening') {
    for (const [x, y] of map.lamps) blit(bmp, renderTile('lamp.evening'), x * TILE, y * TILE);
  }

  // Objects, painted bottom-row-last so a lower object overlaps a higher one.
  const sorted = [...content.objects.objects].sort(
    (a, b) => Math.max(...a.footprint.map(([, y]) => y)) - Math.max(...b.footprint.map(([, y]) => y)),
  );
  for (const o of sorted) {
    const x = Math.min(...o.footprint.map(([fx]) => fx));
    const y = Math.min(...o.footprint.map(([, fy]) => fy));
    blit(bmp, renderObject(o.id), x * TILE, y * TILE);
  }

  // The sim, standing in the living room so the scale reads against the furniture.
  blit(bmp, renderCharacterFrame('walk-down-0', APPEARANCE_PALETTES['moss-green']!), 6 * TILE, 9 * TILE - 16);
  return bmp;
}

function grid(cells: readonly Bitmap[], columns: number, cellW: number, cellH: number, pad = 2): Bitmap {
  const rows = Math.ceil(cells.length / columns);
  const bmp = createBitmap(columns * (cellW + pad) + pad, rows * (cellH + pad) + pad);
  cells.forEach((cell, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    blit(bmp, cell, pad + col * (cellW + pad), pad + row * (cellH + pad));
  });
  return bmp;
}

function main(): void {
  registerTiles(content.homeMap.materials);
  const outDir = resolve(__dirname, '../../docs/superpowers/evidence');
  mkdirSync(outDir, { recursive: true });

  const write = (name: string, bmp: Bitmap) => {
    writeFileSync(resolve(outDir, name), encodePng(bmp));
    console.log(`  ${name}  ${bmp.width}×${bmp.height}`);
  };

  console.log('review sheets:');
  write('p6-room-day.png', roomSheet('day'));
  write('p6-room-evening.png', roomSheet('evening'));
  write('p6-room-day-2x.png', scaleNearest(roomSheet('day'), 2));

  // Objects at 2x, with a flat-Ink silhouette row beneath each — design.md §6's test.
  const objectCells = content.objects.objects.flatMap((o) => {
    const bmp = renderObject(o.id);
    const cell = createBitmap(3 * TILE, 2 * TILE);
    blit(cell, bmp, 0, 0);
    blit(cell, silhouette(bmp), 0, 2 * TILE - bmp.height > 0 ? bmp.height + 2 : 0);
    return [cell];
  });
  write('p6-objects-2x.png', scaleNearest(grid(objectCells, 5, 3 * TILE, 2 * TILE), 2));

  // Every pose, every appearance.
  for (const [id, palette] of Object.entries(APPEARANCE_PALETTES)) {
    const cells = CHARACTER_BILL.map((frame) => renderCharacterFrame(frame, palette));
    write(`p6-poses-${id}-2x.png`, scaleNearest(grid(cells, 12, 32, 48), 2));
  }
  // Silhouette strip: the readability test design.md §6 actually names.
  write(
    'p6-poses-silhouette-2x.png',
    scaleNearest(
      grid(
        CHARACTER_BILL.map((f) => silhouette(renderCharacterFrame(f, APPEARANCE_PALETTES['moss-green']!))),
        12,
        32,
        48,
      ),
      2,
    ),
  );

  write(
    'p6-decorations-4x.png',
    scaleNearest(grid(Object.keys(DECORATION_SPRITES).map(renderDecoration), 6, 24, 24), 4),
  );
  write('p6-icons-4x.png', scaleNearest(grid(Object.keys(ICON_SPRITES).map(renderIcon), 13, 12, 12), 4));
}

if (require.main === module) main();
