import { createBitmap, type Bitmap } from '../../../scripts/art/png';
import { paintShapes, type Shape } from '../sprite-spec';
import {
  DUSK_PLUM,
  INK,
  IZAKAYA_RED,
  LANTERN_GOLD,
  LEAF_GREEN,
  TERRACOTTA,
  WATER_BLUE,
  WOOD,
} from '../palette';
import { rect } from './parts';

/**
 * The 12px icon set (design.md §9, P6 T7).
 *
 * Before P6 the HUD used Unicode glyphs — `☾ ⑃ ⇗ ◍` in `bands.ts`. They were never on the
 * palette, their shapes varied by platform font, and the "alert" variants were the same
 * character with a combining stroke, which is not a shape change at all.
 *
 * SPEC §11.6 requires urgency be legible **without colour**, so every alert variant here
 * is a genuinely different silhouette, asserted in `icons.test.ts`. These are Track A
 * (UI) sprites: outlined in Ink by rule, which is the opposite of the world track.
 */

export const ICON = 12;

interface IconSprite {
  shapes: Shape[];
}

/** Energy — a moon. Alert: the same moon drooping, with a bite taken out of the top. */
const energy: IconSprite = {
  shapes: [
    rect(4, 1, 5, 2, DUSK_PLUM.base),
    rect(2, 3, 3, 6, DUSK_PLUM.base),
    rect(4, 9, 5, 2, DUSK_PLUM.base),
    rect(5, 3, 2, 6, DUSK_PLUM.light),
    rect(7, 2, 2, 8, INK),
  ],
};
const energyAlert: IconSprite = {
  shapes: [
    rect(2, 5, 3, 2, DUSK_PLUM.shadow),
    rect(3, 7, 6, 2, DUSK_PLUM.shadow),
    rect(5, 9, 5, 2, DUSK_PLUM.shadow),
    rect(1, 3, 2, 2, INK),
  ],
};

/** Nutrition — a fork. Alert: an empty bowl, a completely different outline. */
const nutrition: IconSprite = {
  shapes: [
    rect(3, 1, 1, 4, LEAF_GREEN.base),
    rect(5, 1, 1, 4, LEAF_GREEN.base),
    rect(7, 1, 1, 4, LEAF_GREEN.base),
    rect(3, 5, 5, 2, LEAF_GREEN.base),
    rect(5, 7, 2, 4, LEAF_GREEN.shadow),
  ],
};
const nutritionAlert: IconSprite = {
  shapes: [
    rect(1, 5, 10, 2, LEAF_GREEN.shadow),
    rect(2, 7, 8, 2, LEAF_GREEN.shadow),
    rect(4, 9, 4, 1, LEAF_GREEN.shadow),
    rect(1, 3, 2, 2, INK),
    rect(9, 3, 2, 2, INK),
  ],
};

/** Movement — a shoe. Alert: a stiff upright boot. */
const movement: IconSprite = {
  shapes: [
    rect(2, 6, 3, 4, TERRACOTTA.base),
    rect(5, 7, 5, 3, TERRACOTTA.base),
    rect(2, 10, 8, 1, TERRACOTTA.shadow),
    rect(3, 4, 2, 2, TERRACOTTA.light),
  ],
};
const movementAlert: IconSprite = {
  shapes: [
    rect(4, 1, 4, 7, TERRACOTTA.shadow),
    rect(3, 8, 6, 2, TERRACOTTA.shadow),
    rect(3, 10, 6, 1, INK),
    rect(5, 2, 2, 5, TERRACOTTA.base),
  ],
};

/** Hygiene — a droplet. Alert: a flat squiggle, no droplet at all. */
const hygiene: IconSprite = {
  shapes: [
    rect(5, 1, 2, 2, WATER_BLUE.light),
    rect(4, 3, 4, 3, WATER_BLUE.base),
    rect(3, 6, 6, 3, WATER_BLUE.base),
    rect(4, 9, 4, 1, WATER_BLUE.shadow),
    rect(5, 4, 1, 3, WATER_BLUE.light),
  ],
};
const hygieneAlert: IconSprite = {
  shapes: [
    rect(1, 3, 3, 2, WATER_BLUE.shadow),
    rect(4, 5, 3, 2, WATER_BLUE.shadow),
    rect(7, 3, 3, 2, WATER_BLUE.shadow),
    rect(1, 8, 3, 2, WATER_BLUE.shadow),
    rect(4, 6, 3, 2, WATER_BLUE.shadow),
    rect(7, 8, 3, 2, WATER_BLUE.shadow),
  ],
};

/** Practice — a plectrum, gold, because Practice progress is a reward moment (design.md §2). */
const practice: IconSprite = {
  shapes: [
    rect(2, 1, 8, 4, LANTERN_GOLD.base),
    rect(3, 5, 6, 3, LANTERN_GOLD.base),
    rect(4, 8, 4, 2, LANTERN_GOLD.shadow),
    rect(3, 2, 6, 2, LANTERN_GOLD.light),
  ],
};

/** AUTO — a gear. PINNED — a pin. URGENT — a warning triangle, the one red glyph. */
const autoGear: IconSprite = {
  shapes: [
    rect(4, 1, 4, 10, WOOD.base),
    rect(1, 4, 10, 4, WOOD.base),
    rect(3, 3, 6, 6, WOOD.shadow),
    rect(4, 4, 4, 4, WOOD.light),
  ],
};
const pinned: IconSprite = {
  shapes: [
    rect(4, 1, 4, 5, WOOD.shadow),
    rect(2, 6, 8, 2, WOOD.base),
    rect(5, 8, 2, 3, WOOD.shadow),
    rect(5, 2, 2, 3, WOOD.light),
  ],
};
const urgent: IconSprite = {
  shapes: [
    rect(5, 1, 2, 2, IZAKAYA_RED.base),
    rect(4, 3, 4, 2, IZAKAYA_RED.base),
    rect(3, 5, 6, 2, IZAKAYA_RED.base),
    rect(2, 7, 8, 2, IZAKAYA_RED.base),
    rect(1, 9, 10, 2, IZAKAYA_RED.shadow),
    rect(5, 4, 2, 4, INK),
    rect(5, 9, 2, 1, INK),
  ],
};

/** Adjacency — a chevron pair, gold only while granting (design.md §8). */
const adjacency: IconSprite = {
  shapes: [
    rect(2, 3, 2, 2, LANTERN_GOLD.base),
    rect(4, 5, 2, 2, LANTERN_GOLD.base),
    rect(2, 7, 2, 2, LANTERN_GOLD.base),
    rect(6, 3, 2, 2, LANTERN_GOLD.light),
    rect(8, 5, 2, 2, LANTERN_GOLD.light),
    rect(6, 7, 2, 2, LANTERN_GOLD.light),
  ],
};

export const ICON_SPRITES: Record<string, IconSprite> = {
  'energy.normal': energy,
  'energy.alert': energyAlert,
  'nutrition.normal': nutrition,
  'nutrition.alert': nutritionAlert,
  'movement.normal': movement,
  'movement.alert': movementAlert,
  'hygiene.normal': hygiene,
  'hygiene.alert': hygieneAlert,
  practice,
  auto: autoGear,
  pinned,
  urgent,
  adjacency,
};

export function renderIcon(name: string): Bitmap {
  const spec = ICON_SPRITES[name];
  if (!spec) throw new Error(`no authored icon "${name}"`);
  const bmp = createBitmap(ICON, ICON);
  paintShapes(bmp, spec.shapes);
  return bmp;
}
