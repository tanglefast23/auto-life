import { createBitmap, type Bitmap } from '../../../scripts/art/png';
import { paintShapes, type Shape } from '../sprite-spec';
import type { FloorMaterial } from '../../sim/content-schemas';
import {
  CREAM_BASE,
  CREAM_LIGHT,
  CREAM_SHADOW,
  DUSK_PLUM,
  GREY,
  LANTERN_GOLD,
  WOOD,
} from '../palette';
import { rect } from './parts';

/**
 * The day and evening tile sets (design.md §7, P6 T3).
 *
 * design.md §7 is explicit: **"Lighting is palette states, not shaders"** — day tiles are
 * cream-bright, evening tiles are plum-dim with gold pools, authored as *swapped tile
 * sets*. There is no filter, no overlay alpha, and no shader in this file. The evening set
 * is the same shapes painted with different palette indices.
 *
 * The word that governs the evening recipe is **plum-dim**, not merely "darker". A first
 * pass darkened each material inside its own ramp (darker wood, darker grey) and an audit
 * caught that it satisfied "visibly darker" while contradicting the bible: evening in this
 * game is a colour shift toward Dusk plum, which is why the plum ramp exists and why
 * `lighting.test.ts` asserts the hue moves, not just the luminance.
 *
 * Floor texture is per material, not per room, because SPEC §14's footsteps key off the
 * same material — one source, so a tile that looks like wood always sounds like wood.
 */

export const TILE = 32;

export const LIGHTING_STATES = ['day', 'evening'] as const;
export type Lighting = (typeof LIGHTING_STATES)[number];

interface TileRamp {
  base: string;
  seam: string;
  detail: string;
}

/**
 * Per material, per lighting state. Day uses each material's own ramp; evening swaps to
 * the Dusk plum ramp so the whole room shifts hue together, with the material's own shadow
 * kept as the seam so the floor is still readable as wood/tile/carpet after dark.
 */
const MATERIAL_RAMP: Record<FloorMaterial, Record<Lighting, TileRamp>> = {
  wood: {
    // HFM's cream-first canvas: wood is carried by the plank seams and warm inlay,
    // instead of turning most of the screen into one heavy brown field.
    day: { base: CREAM_BASE, seam: CREAM_SHADOW, detail: WOOD.light },
    evening: { base: DUSK_PLUM.base, seam: WOOD.shadow, detail: DUSK_PLUM.shadow },
  },
  tile: {
    day: { base: CREAM_LIGHT, seam: GREY.light, detail: GREY.base },
    evening: { base: DUSK_PLUM.light, seam: GREY.shadow, detail: DUSK_PLUM.shadow },
  },
  carpet: {
    day: { base: DUSK_PLUM.light, seam: DUSK_PLUM.base, detail: DUSK_PLUM.base },
    evening: { base: DUSK_PLUM.base, seam: DUSK_PLUM.shadow, detail: DUSK_PLUM.shadow },
  },
};

/**
 * Walls are structure, not floor: one ramp, dimmed the same way.
 *
 * **Wood panelling, not grey plaster.** The walls read as pale grout-crossed tile, which
 * made the room feel like a bathroom and left the whole scene one flat cream field. The
 * reference this game is being modelled on frames its interior in warm boards, and the
 * Wood ramp is already in the palette, so the wall now uses it directly: Wood base with a
 * shadow seam between boards and a light grain flick along them.
 *
 * Evening keeps the Dusk plum shift every other surface takes, with Wood's own shadow held
 * as the seam so the boards stay legible after dark.
 */
const WALL_RAMP: Record<Lighting, TileRamp> = {
  day: { base: WOOD.base, seam: WOOD.shadow, detail: WOOD.light },
  evening: { base: DUSK_PLUM.shadow, seam: WOOD.shadow, detail: DUSK_PLUM.base },
};

/**
 * Floor texture per material — this is what makes the three distinguishable in flat Ink,
 * and it is asserted rather than assumed.
 *
 *  - **wood:** two plank seams with staggered end joints;
 *  - **tile:** a grout cross on a 16px pitch;
 *  - **carpet:** a stipple on a 4px lattice, no straight lines at all.
 */
function floorShapes(material: FloorMaterial, ramp: TileRamp): Shape[] {
  const shapes: Shape[] = [rect(0, 0, TILE, TILE, ramp.base)];
  if (material === 'wood') {
    shapes.push(rect(0, 10, TILE, 1, ramp.seam), rect(0, 22, TILE, 1, ramp.seam));
    shapes.push(rect(12, 0, 1, 10, ramp.detail), rect(24, 11, 1, 11, ramp.detail), rect(5, 23, 1, 9, ramp.detail));
  } else if (material === 'tile') {
    shapes.push(rect(0, 15, TILE, 2, ramp.seam), rect(15, 0, 2, TILE, ramp.seam));
  } else {
    for (let y = 1; y < TILE; y += 4) {
      for (let x = (y % 8 === 1 ? 1 : 3); x < TILE; x += 4) {
        shapes.push(rect(x, y, 2, 2, ramp.detail));
      }
    }
  }
  return shapes;
}

/**
 * Wall panelling: horizontal boards with staggered butt joints.
 *
 * Deliberately different from the wood *floor*, which runs two seams with vertical end
 * joints. A wall a player is looking at edge-on and a floor they are looking down at must
 * not share a texture, or the room loses its corners — so the boards here are thicker, the
 * grain flicks are horizontal rather than vertical, and the joint pattern is offset.
 */
function wallShapes(ramp: TileRamp): Shape[] {
  const shapes: Shape[] = [rect(0, 0, TILE, TILE, ramp.base)];
  // Three boards to the tile, seams at the board edges.
  for (const y of [0, 11, 22]) {
    shapes.push(rect(0, y, TILE, 1, ramp.seam));
  }
  // Staggered butt joints, so a wall run does not read as a grid.
  shapes.push(rect(18, 1, 1, 9, ramp.seam), rect(7, 12, 1, 9, ramp.seam), rect(26, 23, 1, 8, ramp.seam));
  // Grain: short horizontal flicks in the light step, never touching a seam.
  shapes.push(rect(3, 5, 9, 1, ramp.detail), rect(21, 4, 7, 1, ramp.detail));
  shapes.push(rect(11, 16, 10, 1, ramp.detail));
  shapes.push(rect(4, 27, 8, 1, ramp.detail), rect(19, 26, 5, 1, ramp.detail));
  return shapes;
}

/**
 * The gold pool design.md §7 names, drawn as a tile variant rather than a light shader.
 *
 * Concentric squares in the Lantern gold ramp, darkest outward, so the pool falls off
 * without a gradient. Gold is sanctioned here because a lamp **is** a light source — the
 * one non-reward use §2 allows.
 */
function goldPoolShapes(): Shape[] {
  // Stepped diamond, not concentric squares. The first version was three nested squares
  // and read as a gold tile someone had dropped on the floor rather than as light: a pool
  // has no corners. The vertical falloff is steeper than the horizontal one, so the pool
  // is wider than it is tall — light landing on a floor read from above-front, rather than
  // the upright gem the first diamond produced. Each band is one palette step, so the
  // falloff is a palette state exactly as design.md §7 requires — no gradient, no alpha.
  const band = (inset: number, colour: string): Shape[] => {
    const shapes: Shape[] = [];
    const half = TILE / 2;
    for (let y = 0; y < TILE; y++) {
      const dy = Math.abs(y - half + 0.5);
      const reach = half - inset - dy * 1.45;
      if (reach <= 0) continue;
      const w = Math.round(reach * 2);
      shapes.push(rect(Math.round(half - w / 2), y, w, 1, colour));
    }
    return shapes;
  };
  return [...band(1, LANTERN_GOLD.shadow), ...band(5, LANTERN_GOLD.base), ...band(10, LANTERN_GOLD.light)];
}

export interface TileSprite {
  shapes: Shape[];
}

/** Every tile sprite the atlas packs, keyed `<room|wall|lamp>.<lighting>`. */
export const TILE_SPRITES: Record<string, TileSprite> = {};

export function registerTiles(
  materials: Readonly<Record<string, FloorMaterial>>,
): Record<string, TileSprite> {
  for (const key of Object.keys(TILE_SPRITES)) delete TILE_SPRITES[key];
  for (const [room, material] of Object.entries(materials)) {
    for (const state of LIGHTING_STATES) {
      TILE_SPRITES[`${room}.${state}`] = { shapes: floorShapes(material, MATERIAL_RAMP[material][state]) };
    }
  }
  for (const state of LIGHTING_STATES) {
    TILE_SPRITES[`wall.${state}`] = { shapes: wallShapes(WALL_RAMP[state]) };
  }
  // Lamp pools exist only after dark; a lit lamp at noon would read as a mistake.
  TILE_SPRITES['lamp.day'] = { shapes: [] };
  TILE_SPRITES['lamp.evening'] = { shapes: goldPoolShapes() };
  return TILE_SPRITES;
}

export function renderTile(name: string): Bitmap {
  const spec = TILE_SPRITES[name];
  if (!spec) throw new Error(`no authored tile "${name}" — call registerTiles first`);
  const bmp = createBitmap(TILE, TILE);
  paintShapes(bmp, spec.shapes);
  return bmp;
}
