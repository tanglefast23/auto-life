import { createBitmap, type Bitmap } from '../../../scripts/art/png';
import { paintShapes, type Shape } from '../sprite-spec';
import { DUSK_PLUM, LANTERN_GOLD, LEAF_GREEN, TERRACOTTA, WATER_BLUE, WOOD } from '../palette';
import { notch, outlined, rect } from './parts';

/**
 * The six grantable decorations (design.md §7, §11; P6 T6).
 *
 * P5 shipped six reward placements sharing **two** sprites — `scene-layout.ts` said so in
 * a comment, and `evidence/P5.md` recorded it as a deliberate P6 placeholder. The cost was
 * not only visual: Goal 3 offers the player a *choice* between two rewards, and both
 * choices drew the same vase, so the choice was invisible at the moment it was made.
 *
 * design.md §11's v1 bill says "~10 decorations". Six is deliberate and recorded in the
 * P6 plan §7: the game can grant exactly six, and authoring four unreachable sprites would
 * be placeholder art under a different name. v2's shop and reward decorations own the rest.
 *
 * Each is one tile or less, drawn above the furniture and below the character.
 */

export interface DecorationSprite {
  shapes: Shape[];
  width: number;
  height: number;
}

/** Broad-leaf plant in a tapered pot. Carried over from P3 and re-audited. */
const leafyPlant: DecorationSprite = {
  width: 16,
  height: 24,
  shapes: [
    rect(7, 6, 2, 11, LEAF_GREEN.shadow),
    rect(2, 5, 6, 5, LEAF_GREEN.base),
    rect(4, 2, 5, 6, LEAF_GREEN.light),
    rect(8, 1, 5, 7, LEAF_GREEN.base),
    rect(9, 7, 5, 5, LEAF_GREEN.light),
    rect(3, 15, 10, 3, TERRACOTTA.shadow),
    rect(4, 18, 8, 5, TERRACOTTA.base),
    rect(5, 18, 6, 2, TERRACOTTA.light),
  ],
};

/** Three round blooms on stems in a bellied vase. Carried over from P3 and re-audited. */
const sunnyVase: DecorationSprite = {
  width: 16,
  height: 24,
  shapes: [
    rect(7, 4, 2, 10, LEAF_GREEN.shadow),
    rect(3, 2, 4, 4, LANTERN_GOLD.base),
    rect(9, 1, 4, 4, LANTERN_GOLD.light),
    rect(6, 4, 4, 3, LANTERN_GOLD.shadow),
    rect(5, 12, 6, 3, DUSK_PLUM.shadow),
    rect(3, 15, 10, 7, DUSK_PLUM.base),
    rect(5, 15, 6, 4, DUSK_PLUM.light),
    rect(5, 22, 6, 1, DUSK_PLUM.shadow),
  ],
};

/** Goal 2's reward: a vine spilling sideways off the wardrobe — a horizontal silhouette. */
const trailingVine: DecorationSprite = {
  width: 24,
  height: 16,
  shapes: [
    rect(2, 2, 8, 4, TERRACOTTA.base),
    rect(3, 2, 6, 1, TERRACOTTA.light),
    rect(2, 6, 8, 2, TERRACOTTA.shadow),
    // The trail: stepped leaves running right and down, so the outline is a staircase.
    rect(9, 4, 4, 3, LEAF_GREEN.base),
    rect(12, 6, 4, 3, LEAF_GREEN.light),
    rect(15, 8, 4, 3, LEAF_GREEN.base),
    rect(18, 10, 4, 3, LEAF_GREEN.light),
    rect(20, 12, 3, 3, LEAF_GREEN.shadow),
    rect(11, 8, 3, 2, LEAF_GREEN.shadow),
    rect(16, 11, 3, 2, LEAF_GREEN.shadow),
  ],
};

/** Goal 3, choice A: a lidded box, wider than tall, with a gold clasp (a reward moment). */
const keepsakeBox: DecorationSprite = {
  width: 22,
  height: 16,
  shapes: [
    ...outlined(1, 5, 20, 10, WOOD.base, WOOD.shadow),
    ...outlined(0, 2, 22, 4, WOOD.light, WOOD.shadow), // lid, proud of the box
    rect(9, 5, 4, 4, LANTERN_GOLD.base), // clasp
    rect(10, 6, 2, 2, LANTERN_GOLD.light),
    rect(3, 15, 3, 1, WOOD.shadow), // feet
    rect(16, 15, 3, 1, WOOD.shadow),
    notch(6, 15, 10, 1),
  ],
};

/** Goal 3, choice B: a framed print, taller than wide, with a hook above the frame line. */
const framedPrint: DecorationSprite = {
  width: 16,
  height: 24,
  shapes: [
    rect(7, 0, 2, 3, WOOD.shadow), // hook, above everything
    ...outlined(1, 3, 14, 20, WOOD.base, WOOD.shadow),
    rect(3, 5, 10, 16, WATER_BLUE.light), // mount
    rect(4, 12, 8, 8, WATER_BLUE.base), // the image
    rect(5, 9, 6, 4, WATER_BLUE.shadow),
    notch(0, 0, 7, 3),
    notch(9, 0, 7, 3),
  ],
};

/** Goal 5's reward: a wall poster with a torn corner and a gold plectrum. */
const practicePoster: DecorationSprite = {
  width: 18,
  height: 24,
  shapes: [
    ...outlined(0, 0, 18, 23, TERRACOTTA.base, TERRACOTTA.shadow),
    rect(3, 3, 12, 9, TERRACOTTA.light),
    // Plectrum: gold, and legitimately so — Practice level-ups are a reward moment.
    rect(6, 5, 6, 4, LANTERN_GOLD.base),
    rect(7, 9, 4, 2, LANTERN_GOLD.shadow),
    rect(8, 11, 2, 1, LANTERN_GOLD.shadow),
    rect(3, 15, 12, 2, TERRACOTTA.shadow),
    rect(3, 18, 8, 2, TERRACOTTA.shadow),
    // Torn lower corner — the silhouette cue that separates it from the framed print.
    notch(12, 18, 6, 5),
    notch(14, 15, 4, 3),
  ],
};

export const DECORATION_SPRITES: Record<string, DecorationSprite> = {
  'leafy-plant': leafyPlant,
  'sunny-vase': sunnyVase,
  'trailing-vine': trailingVine,
  'keepsake-box': keepsakeBox,
  'framed-print': framedPrint,
  'practice-poster': practicePoster,
};

export function renderDecoration(name: string): Bitmap {
  const spec = DECORATION_SPRITES[name];
  if (!spec) throw new Error(`no authored decoration "${name}"`);
  const bmp = createBitmap(spec.width, spec.height);
  paintShapes(bmp, spec.shapes);
  return bmp;
}
