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
import {
  ACTIVITY_HERO_ORIGINS,
  objectPresentation,
} from '../../src/render/object-presentation';

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
 *  - the **room** in both lighting states, plus the real 2×-room/3×-hero draw ratio;
 *  - every **character pose**, in each appearance, plus a flat-Ink silhouette strip;
 *  - **decorations and icons** at 1× and 4×.
 */

const TILE = 32;

function roomSheet(lighting: Lighting, includeSourceHero = true): Bitmap {
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
    (a, b) => {
      const av = objectPresentation(a);
      const bv = objectPresentation(b);
      return av.y + av.height - (bv.y + bv.height);
    },
  );
  for (const o of sorted) {
    const visual = objectPresentation(o);
    blit(bmp, renderObject(o.id), visual.x, visual.y);
  }

  if (includeSourceHero) {
    // Source-size context. The live renderer is shown separately below because its 1.5×
    // logical scale is a crisp 3× sprite only once the room is at 2× physical scale.
    blit(
      bmp,
      renderCharacterFrame('walk-down-0', APPEARANCE_PALETTES['moss-green']!),
      6 * TILE,
      9 * TILE - 16,
    );
  }
  return bmp;
}

/**
 * All furniture contacts at the real live ratio: room/object pixels at 2x, hero pixels at
 * 3x. Each crop uses the activity's exact presentation origin, so this sheet catches the
 * "sitting on the floor in front of the couch" class of error directly.
 */
function interactionSheet(): Bitmap {
  const activities = content.activities.activities.filter(
    (activity) => activity.id !== 'idle' && ACTIVITY_HERO_ORIGINS[activity.id] !== undefined,
  );
  const base = scaleNearest(roomSheet('day', false), 2);
  const cellW = 352;
  const cellH = 320;
  const cells = activities.map((activity) => {
    const object = content.objects.objects.find((candidate) => candidate.id === activity.object)!;
    const visual = objectPresentation(object);
    const origin = ACTIVITY_HERO_ORIGINS[activity.id]!;
    const staged = createBitmap(base.width, base.height);
    blit(staged, base, 0, 0);
    blit(staged, scaleNearest(renderObject(object.id, 'active'), 2), visual.x * 2, visual.y * 2);
    const frame = activity.pose === 'stand'
      ? `walk-${object.facing}-0`
      : `${activity.pose}-0`;
    blit(
      staged,
      scaleNearest(renderCharacterFrame(frame, APPEARANCE_PALETTES['moss-green']!), 3),
      origin.x * 2,
      origin.y * 2,
    );
    const centreX = ((visual.x + visual.width / 2 + origin.x + 24) / 2) * 2;
    const centreY = ((visual.y + visual.height / 2 + origin.y + 36) / 2) * 2;
    const cropX = Math.round(Math.max(0, Math.min(base.width - cellW, centreX - cellW / 2)));
    const cropY = Math.round(Math.max(0, Math.min(base.height - cellH, centreY - cellH / 2)));
    const cell = createBitmap(cellW, cellH);
    blit(cell, staged, -cropX, -cropY);
    return cell;
  });
  return grid(cells, 4, cellW, cellH, 4);
}

/** The live ratio at the common 2× world scale: 2× room pixels, 3× hero pixels. */
function liveRoomSheet(lighting: Lighting): Bitmap {
  const bmp = scaleNearest(roomSheet(lighting, false), 2);
  const hero = scaleNearest(
    renderCharacterFrame('walk-down-0', APPEARANCE_PALETTES['moss-green']!),
    3,
  );
  const tileX = 6 * TILE * 2;
  const footY = 10 * TILE * 2;
  blit(bmp, hero, tileX + (TILE * 2 - hero.width) / 2, footY - hero.height);
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
  write('p7-hfm-room-day-source-1x.png', roomSheet('day'));
  write('p7-hfm-room-evening-source-1x.png', roomSheet('evening'));
  write('p7-hfm-room-day-live-2x.png', liveRoomSheet('day'));
  write('p7-hfm-room-evening-live-2x.png', liveRoomSheet('evening'));
  write('p7-hfm-interactions-live-2x.png', interactionSheet());

  // Objects at 2x, with a flat-Ink silhouette row beneath each — design.md §6's test.
  const objectCells = content.objects.objects.flatMap((o) => {
    const bmp = renderObject(o.id);
    const cell = createBitmap(136, 260);
    blit(cell, bmp, 0, 0);
    const flat = silhouette(bmp);
    if (bmp.height + flat.height + 2 <= cell.height) blit(cell, flat, 0, bmp.height + 2);
    return [cell];
  });
  write('p7-hfm-objects-2x.png', scaleNearest(grid(objectCells, 5, 136, 260), 2));

  // Every pose, every appearance.
  for (const [id, palette] of Object.entries(APPEARANCE_PALETTES)) {
    const cells = CHARACTER_BILL.map((frame) => renderCharacterFrame(frame, palette));
    write(`p7-hfm-poses-${id}-2x.png`, scaleNearest(grid(cells, 12, 32, 48), 2));
  }
  // Silhouette strip: the readability test design.md §6 actually names.
  write(
    'p7-hfm-poses-silhouette-2x.png',
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
    'p7-hfm-decorations-4x.png',
    scaleNearest(grid(Object.keys(DECORATION_SPRITES).map(renderDecoration), 6, 24, 24), 4),
  );
  write('p7-hfm-icons-4x.png', scaleNearest(grid(Object.keys(ICON_SPRITES).map(renderIcon), 13, 12, 12), 4));
}

if (require.main === module) main();
