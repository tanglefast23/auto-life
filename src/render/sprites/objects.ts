import { createBitmap, type Bitmap } from '../../../scripts/art/png';
import { paintShapes, type Shape } from '../sprite-spec';
import { OBJECT_PRESENTATION } from '../object-presentation';
import {
  CREAM_BASE,
  CREAM_LIGHT,
  CREAM_SHADOW,
  DUSK_PLUM,
  GREY,
  LANTERN_GOLD,
  TERRACOTTA,
  WATER_BLUE,
  WOOD,
} from '../palette';
import { lip, notch, outlined, rect } from './parts';

/**
 * The v1 object set (design.md §11, P6 T2).
 *
 * P3 drew every object with one `box()` call — fifteen rectangles that differed only in
 * ramp colour. That is the literal cause of "I just see a square and I don't know what
 * that object is", and it is what this file replaces.
 *
 * Every sprite has to clear three mechanical gates in `objects-legibility.test.ts`:
 *
 *   1. `boxiness < 0.92` — it is not a rectangle. A plain filled box scores exactly 1.0.
 *   2. a silhouette no other object shares — you can tell them apart in flat Ink.
 *   3. the palette, forbidden-extreme, and Track-B outline-role audit (design.md §3, §12).
 *
 * Two colour rules the gates cannot fully police, so they are stated here:
 *  - **Gold is only ever a light source or a reward** (design.md §2). The open fridge
 *    interior qualifies. The television screen does not — it uses the grey ramp's light
 *    step, which is why a lit TV reads as "on" without stealing the reward colour.
 *  - **Nothing decorative is red.** No object in this file touches the Izakaya ramp.
 *
 * Shapes are authored in the footprint's own pixel space (top-left = 0,0), so moving an
 * object in `home-map.json` never requires an art change.
 */

export interface ObjectSprite {
  /** Resting state. */
  idle: Shape[];
  /** SPEC §10: "active states 1–2 frames". Present only for objects that host activities. */
  active?: Shape[];
  width: number;
  height: number;
}

const TILE = 32;

/**
 * Scale an authored low-resolution silhouette into its room-sized presentation box.
 * Every edge is rounded independently, keeping hard integer pixels and avoiding the
 * blurred transforms that made the old tiny appliances look unlike HFM art.
 */
function fitShapes(
  shapes: readonly Shape[],
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Shape[] {
  const sx = width / sourceWidth;
  const sy = height / sourceHeight;
  return shapes.map((shape) => {
    const x = Math.round(shape.x * sx);
    const y = Math.round(shape.y * sy);
    if (shape.k === 'px') {
      return rect(x, y, Math.max(1, Math.round(sx)), Math.max(1, Math.round(sy)), shape.c);
    }
    const right = Math.round((shape.x + shape.w) * sx);
    const bottom = Math.round((shape.y + shape.h) * sy);
    return rect(x, y, Math.max(1, right - x), Math.max(1, bottom - y), shape.c);
  });
}

function fittedSprite(
  id: string,
  sourceWidth: number,
  sourceHeight: number,
  idle: Shape[],
  active?: Shape[],
): ObjectSprite {
  const visual = OBJECT_PRESENTATION[id];
  if (visual === undefined) throw new Error(`object presentation missing for "${id}"`);
  return {
    width: visual.width,
    height: visual.height,
    idle: fitShapes(idle, sourceWidth, sourceHeight, visual.width, visual.height),
    ...(active === undefined
      ? {}
      : { active: fitShapes(active, sourceWidth, sourceHeight, visual.width, visual.height) }),
  };
}

function authoredSprite(id: string, idle: Shape[], active?: Shape[]): ObjectSprite {
  const visual = OBJECT_PRESENTATION[id];
  if (visual === undefined) throw new Error(`object presentation missing for "${id}"`);
  return {
    width: visual.width,
    height: visual.height,
    idle,
    ...(active === undefined ? {} : { active }),
  };
}

// ---------------------------------------------------------------------------
// Bedroom
// ---------------------------------------------------------------------------

/** Full-size top-down bed: tall enough for the enlarged hero to lie inside it. */
function bedShapes(occupied: boolean): Shape[] {
  return [
    // The headboard reads against the wall; inset rails keep the silhouette furniture-like.
    ...outlined(6, 0, 68, 14, WOOD.base, WOOD.shadow),
    ...outlined(8, 11, 64, 100, DUSK_PLUM.base, DUSK_PLUM.shadow),
    ...outlined(10, 17, 60, 27, CREAM_BASE, DUSK_PLUM.shadow),
    ...(occupied
      ? [
          rect(14, 26, 52, 4, CREAM_SHADOW),
          ...outlined(9, 45, 62, 54, DUSK_PLUM.light, DUSK_PLUM.shadow),
          rect(13, 53, 54, 3, DUSK_PLUM.base),
        ]
      : [
          rect(14, 25, 52, 3, CREAM_SHADOW),
          ...outlined(9, 45, 62, 54, DUSK_PLUM.light, DUSK_PLUM.shadow),
          lip(12, 48, 56, DUSK_PLUM.light),
          rect(12, 73, 56, 3, DUSK_PLUM.base),
        ]),
    rect(7, 111, 10, 7, WOOD.shadow),
    rect(63, 111, 10, 7, WOOD.shadow),
    notch(0, 0, 6, 11),
    notch(74, 0, 6, 11),
    notch(0, 111, 7, 9),
    notch(17, 111, 46, 9),
    notch(73, 111, 7, 9),
  ];
}

/**
 * Two tall doors, a centre split, two knobs — plus a cornice and feet.
 *
 * The cornice is not decoration. A wardrobe, a fridge and a door are all genuinely
 * box-shaped, so the first pass scored 0.98 boxiness and the legibility gate rejected all
 * three: three near-identical rectangles is exactly the problem P6 exists to fix. Real
 * furniture solves it the same way — the widest part sits at one height only (cornice,
 * lintel, plinth), so the silhouette stops being its own bounding box.
 */
const wardrobe: ObjectSprite = {
  width: TILE,
  height: TILE,
  idle: [
    ...outlined(2, 0, 28, 5, WOOD.light, WOOD.shadow), // cornice, proud of the carcass
    ...outlined(5, 5, 22, 23, WOOD.base, WOOD.shadow),
    rect(15, 6, 2, 21, WOOD.shadow), // centre split
    rect(12, 15, 2, 3, WOOD.light), // knobs
    rect(18, 15, 2, 3, WOOD.light),
    rect(6, 28, 5, 4, WOOD.shadow), // feet, with floor between them
    rect(21, 28, 5, 4, WOOD.shadow),
    notch(0, 5, 5, 27),
    notch(27, 5, 5, 27),
    notch(11, 28, 10, 4),
  ],
};

// ---------------------------------------------------------------------------
// Bathroom
// ---------------------------------------------------------------------------

function toiletShapes(lidUp: boolean): Shape[] {
  return [
    ...outlined(8, 1, 16, 11, WATER_BLUE.base, WATER_BLUE.shadow), // cistern
    ...(lidUp
      ? [...outlined(6, 12, 20, 3, WATER_BLUE.light, WATER_BLUE.shadow)] // lid raised against the cistern
      : [...outlined(6, 14, 20, 4, WATER_BLUE.light, WATER_BLUE.shadow)]),
    ...outlined(8, 17, 16, 8, WATER_BLUE.base, WATER_BLUE.shadow), // bowl, narrower than the lid
    ...outlined(11, 25, 10, 6, WATER_BLUE.shadow, WATER_BLUE.shadow), // pedestal, narrower again
    notch(0, 0, 8, 32),
    notch(24, 0, 8, 32),
  ];
}

function sinkShapes(running: boolean): Shape[] {
  return [
    ...outlined(13, 2, 6, 9, GREY.base, GREY.shadow), // tap riser
    rect(13, 4, 8, 2, GREY.light), // spout reaching over the basin
    ...outlined(4, 11, 24, 9, WATER_BLUE.light, WATER_BLUE.shadow), // basin, much wider than the riser
    ...(running ? [rect(16, 13, 2, 6, WATER_BLUE.base)] : []),
    ...outlined(11, 20, 10, 11, WATER_BLUE.base, WATER_BLUE.shadow), // pedestal
    notch(0, 0, 4, 32),
    notch(28, 0, 4, 32),
  ];
}

function showerShapes(running: boolean): Shape[] {
  return [
    rect(2, 0, 76, 5, GREY.shadow),
    rect(6, 5, 5, 108, GREY.shadow),
    rect(69, 5, 5, 108, GREY.shadow),
    ...outlined(53, 12, 14, 9, GREY.base, GREY.shadow),
    rect(58, 21, 4, 17, GREY.shadow),
    // Translucent-looking curtain bands, still fully opaque palette pixels.
    rect(12, 7, 12, 97, WATER_BLUE.light),
    rect(27, 7, 12, 97, WATER_BLUE.base),
    rect(42, 7, 12, 97, WATER_BLUE.light),
    rect(57, 38, 11, 66, WATER_BLUE.base),
    rect(23, 7, 3, 97, WATER_BLUE.shadow),
    rect(39, 7, 3, 97, WATER_BLUE.shadow),
    rect(54, 7, 3, 97, WATER_BLUE.shadow),
    ...(running
      ? [
          rect(55, 23, 2, 20, CREAM_LIGHT),
          rect(62, 23, 2, 20, CREAM_LIGHT),
          rect(58, 25, 2, 20, WATER_BLUE.light),
        ]
      : []),
    ...outlined(3, 104, 74, 17, WATER_BLUE.light, WATER_BLUE.shadow),
    rect(12, 109, 56, 3, CREAM_LIGHT),
    notch(0, 0, 2, 128),
    notch(78, 0, 2, 128),
    notch(0, 121, 80, 7),
  ];
}

// ---------------------------------------------------------------------------
// Kitchen
// ---------------------------------------------------------------------------

function fridgeShapes(open: boolean): Shape[] {
  if (open) {
    return [
      // Door swung left; warm light spills out. Gold is sanctioned here as a light source.
      ...outlined(13, 0, 15, 29, GREY.light, GREY.shadow),
      ...outlined(2, 3, 11, 23, LANTERN_GOLD.light, LANTERN_GOLD.shadow),
      rect(24, 4, 2, 7, GREY.shadow),
      rect(15, 29, 11, 3, GREY.shadow),
      notch(0, 0, 2, 32),
      notch(28, 0, 4, 32),
      notch(2, 26, 11, 6),
      notch(13, 29, 2, 3),
    ];
  }
  return [
    ...outlined(5, 0, 22, 29, GREY.light, GREY.shadow),
    rect(6, 12, 20, 1, GREY.shadow), // the door split that says "fridge", not "grey box"
    // Handles protrude past the carcass, so the widest point is not the body — same
    // silhouette trick as the wardrobe cornice, and the same reason.
    rect(27, 4, 2, 7, GREY.shadow),
    rect(27, 15, 2, 9, GREY.shadow),
    rect(7, 29, 5, 3, GREY.shadow), // feet, with floor visible between and beside them
    rect(20, 29, 5, 3, GREY.shadow),
    notch(5, 0, 3, 3), // eased top corners
    notch(24, 0, 3, 3),
    notch(0, 0, 5, 32),
    notch(5, 29, 2, 3),
    notch(12, 29, 8, 3),
    notch(25, 29, 7, 3),
  ];
}

function microwaveShapes(running: boolean): Shape[] {
  return [
    ...outlined(1, 7, 30, 19, GREY.base, GREY.shadow),
    // Wide glass door with a control column pinned to the right.
    ...outlined(3, 9, 19, 15, running ? LANTERN_GOLD.shadow : GREY.shadow, GREY.shadow),
    ...(running ? [rect(5, 11, 15, 11, LANTERN_GOLD.base)] : []),
    rect(24, 10, 5, 2, GREY.light),
    rect(24, 14, 5, 2, GREY.light),
    rect(24, 18, 5, 4, GREY.light),
    rect(4, 26, 5, 3, GREY.shadow), // feet
    rect(23, 26, 5, 3, GREY.shadow),
    notch(0, 0, 32, 7),
    notch(0, 26, 4, 6),
    notch(9, 26, 14, 6),
    notch(28, 26, 4, 6),
  ];
}

/** Worktop overhanging the cabinet, one drawer line, and a recessed toe-kick. */
const counter: ObjectSprite = {
  width: 2 * TILE,
  height: TILE,
  idle: [
    ...outlined(0, 6, 64, 6, WOOD.light, WOOD.shadow), // worktop, proud of the cabinet
    ...outlined(4, 12, 56, 15, WOOD.base, WOOD.shadow),
    rect(6, 18, 52, 1, WOOD.shadow), // drawer line
    rect(28, 21, 8, 2, WOOD.light), // drawer pull
    ...outlined(8, 27, 48, 4, WOOD.shadow, WOOD.shadow), // toe-kick, inset both sides
    notch(0, 0, 64, 6),
    notch(0, 12, 4, 20),
    notch(60, 12, 4, 20),
    notch(4, 27, 4, 5),
    notch(56, 27, 4, 5),
  ],
};

// ---------------------------------------------------------------------------
// Living room
// ---------------------------------------------------------------------------

function couchShapes(sat: boolean): Shape[] {
  return [
    ...outlined(12, 2, 104, 29, TERRACOTTA.base, TERRACOTTA.shadow),
    rect(16, 6, 96, 3, TERRACOTTA.light),
    ...outlined(0, 12, 16, 42, TERRACOTTA.light, TERRACOTTA.shadow),
    ...outlined(112, 12, 16, 42, TERRACOTTA.light, TERRACOTTA.shadow),
    ...outlined(16, 29, 96, 27, TERRACOTTA.base, TERRACOTTA.shadow),
    // Three cushion divisions.
    rect(47, 31, 2, 23, TERRACOTTA.shadow),
    rect(79, 31, 2, 23, TERRACOTTA.shadow),
    ...(sat ? [rect(51, 35, 26, 4, TERRACOTTA.shadow)] : [lip(18, 31, 92, TERRACOTTA.light)]),
    rect(6, 54, 9, 7, TERRACOTTA.shadow),
    rect(113, 54, 9, 7, TERRACOTTA.shadow),
    notch(0, 0, 12, 12),
    notch(116, 0, 12, 12),
    notch(16, 56, 96, 8),
    notch(0, 61, 128, 3),
  ];
}

/**
 * Rear of the television, because its screen faces up toward the couch instead of down
 * toward the player. Vents, ports, cable and stand make the direction unambiguous.
 */
function tvShapes(): Shape[] {
  return [
    ...outlined(4, 2, 80, 34, GREY.base, GREY.shadow),
    rect(10, 7, 68, 3, GREY.light),
    rect(14, 15, 28, 3, GREY.shadow),
    rect(14, 21, 28, 3, GREY.shadow),
    rect(56, 15, 14, 12, GREY.shadow),
    rect(59, 18, 8, 6, GREY.light),
    rect(42, 30, 4, 15, GREY.shadow), // cable points toward the couch side
    ...outlined(38, 36, 12, 10, GREY.shadow, GREY.shadow),
    ...outlined(20, 45, 48, 8, GREY.base, GREY.shadow),
    rect(8, 53, 14, 2, CREAM_SHADOW),
    rect(66, 53, 14, 2, CREAM_SHADOW),
    notch(0, 0, 4, 56),
    notch(84, 0, 4, 56),
    notch(0, 36, 38, 20),
    notch(50, 36, 38, 9),
    notch(0, 45, 20, 11),
    notch(68, 45, 20, 11),
  ];
}

function benchShapes(lifting: boolean): Shape[] {
  return [
    ...outlined(3, 10, 8, 27, GREY.shadow, GREY.shadow),
    ...outlined(85, 10, 8, 27, GREY.shadow, GREY.shadow),
    ...(lifting
      ? [rect(5, 3, 86, 4, GREY.light)]
      : [rect(5, 13, 86, 4, GREY.light)]),
    rect(1, lifting ? 1 : 11, 7, 8, GREY.shadow),
    rect(88, lifting ? 1 : 11, 7, 8, GREY.shadow),
    ...outlined(17, 25, 62, 15, TERRACOTTA.base, TERRACOTTA.shadow),
    rect(24, 40, 8, 13, GREY.shadow),
    rect(64, 40, 8, 13, GREY.shadow),
    notch(0, 0, 96, 3),
    notch(0, 17, 3, 39),
    notch(93, 17, 3, 39),
    notch(11, 17, 74, 8),
    notch(32, 40, 32, 16),
  ];
}

function treadmillShapes(running: boolean): Shape[] {
  return [
    ...outlined(77, 1, 17, 11, GREY.light, GREY.shadow),
    rect(83, 12, 6, 20, GREY.shadow),
    rect(74, 13, 4, 17, GREY.shadow),
    rect(76, 13, 10, 3, GREY.light),
    // Long deck runs left-to-right, matching the activity's right-facing run pose.
    ...outlined(20, 27, 69, 7, GREY.base, GREY.shadow),
    ...outlined(9, 32, 77, 7, GREY.base, GREY.shadow),
    ...outlined(1, 37, 82, 8, GREY.base, GREY.shadow),
    ...(running
      ? [rect(13, 40, 11, 2, GREY.light), rect(38, 37, 11, 2, GREY.light), rect(62, 34, 11, 2, GREY.light)]
      : [rect(22, 40, 13, 2, GREY.light), rect(52, 36, 13, 2, GREY.light)]),
    notch(0, 0, 74, 27),
    notch(0, 27, 20, 5),
    notch(0, 32, 9, 5),
    notch(89, 12, 7, 36),
    notch(83, 39, 13, 9),
  ];
}

function rugShapes(scuffed: boolean): Shape[] {
  const fringeColumns = [4, 12, 20, 28, 36, 44, 52, 60, 68];
  return [
    ...outlined(2, 8, 68, 88, TERRACOTTA.base, TERRACOTTA.shadow),
    rect(8, 16, 56, 72, TERRACOTTA.light),
    rect(14, 26, 44, 52, TERRACOTTA.base),
    rect(20, 34, 32, 36, scuffed ? TERRACOTTA.shadow : TERRACOTTA.light),
    rect(26, 42, 20, 20, TERRACOTTA.shadow),
    ...fringeColumns.flatMap((x) => [
      rect(x, 2, 3, 6, TERRACOTTA.shadow),
      rect(x, 96, 3, 6, TERRACOTTA.shadow),
    ]),
    notch(0, 0, 72, 2),
    notch(0, 102, 72, 2),
  ];
}

/** Waisted body, neck, headstock — the most distinctive outline in the room. */
function guitarShapes(played: boolean): Shape[] {
  return [
    ...outlined(12, 0, 8, 5, WOOD.shadow, WOOD.shadow), // headstock, wider than the neck
    rect(14, 5, 4, 10, WOOD.base), // neck
    rect(15, 5, 1, 10, WOOD.light),
    // Waisted body: upper bout, waist, lower bout.
    ...outlined(8, 14, 16, 6, WOOD.base, WOOD.shadow),
    ...outlined(10, 19, 12, 4, WOOD.base, WOOD.shadow),
    ...outlined(6, 22, 20, 9, WOOD.base, WOOD.shadow),
    rect(13, 23, 6, 5, WOOD.shadow), // sound hole
    ...(played ? [rect(11, 24, 1, 4, LANTERN_GOLD.base), rect(21, 24, 1, 4, LANTERN_GOLD.base)] : []),
    notch(0, 0, 12, 14),
    notch(20, 0, 12, 14),
    notch(0, 14, 8, 8),
    notch(24, 14, 8, 8),
    notch(0, 22, 6, 10),
    notch(26, 22, 6, 10),
    notch(0, 31, 32, 1),
  ];
}

/**
 * A doorway, not a door slab: a lintel overhanging the jambs and a threshold overhanging
 * the frame, so the widest points sit at the top and bottom rather than everywhere.
 */
function frontDoorShapes(ajar: boolean): Shape[] {
  return [
    ...outlined(1, 0, 30, 5, WOOD.light, WOOD.shadow), // lintel
    ...outlined(4, 5, 24, 24, WOOD.shadow, WOOD.shadow), // jambs
    ...(ajar
      ? [
          ...outlined(6, 7, 13, 20, WOOD.light, WOOD.shadow), // leaf swung inward
          rect(19, 7, 7, 20, DUSK_PLUM.shadow), // the dark gap beyond
        ]
      : [
          ...outlined(6, 7, 20, 20, WOOD.base, WOOD.shadow),
          rect(9, 9, 14, 6, WOOD.light), // inset panels
          rect(9, 18, 14, 7, WOOD.light),
        ]),
    rect(ajar ? 16 : 23, 15, 2, 4, GREY.light), // handle on the leading edge
    ...outlined(2, 29, 28, 3, WOOD.shadow, WOOD.shadow), // threshold
    notch(0, 5, 4, 24),
    notch(28, 5, 4, 24),
    notch(0, 29, 2, 3),
    notch(30, 29, 2, 3),
  ];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const OBJECT_SPRITES: Record<string, ObjectSprite> = {
  bed: authoredSprite('bed', bedShapes(false), bedShapes(true)),
  wardrobe: fittedSprite('wardrobe', TILE, TILE, wardrobe.idle),
  toilet: fittedSprite('toilet', TILE, TILE, toiletShapes(false), toiletShapes(true)),
  sink: fittedSprite('sink', TILE, TILE, sinkShapes(false), sinkShapes(true)),
  shower: authoredSprite('shower', showerShapes(false), showerShapes(true)),
  fridge: fittedSprite('fridge', TILE, TILE, fridgeShapes(false), fridgeShapes(true)),
  microwave: fittedSprite('microwave', TILE, TILE, microwaveShapes(false), microwaveShapes(true)),
  counter: fittedSprite('counter', 2 * TILE, TILE, counter.idle),
  couch: authoredSprite('couch', couchShapes(false), couchShapes(true)),
  tv: authoredSprite('tv', tvShapes()),
  bench: authoredSprite('bench', benchShapes(false), benchShapes(true)),
  treadmill: authoredSprite('treadmill', treadmillShapes(false), treadmillShapes(true)),
  rug: authoredSprite('rug', rugShapes(false), rugShapes(true)),
  guitar: fittedSprite('guitar', TILE, TILE, guitarShapes(false), guitarShapes(true)),
  'front-door': fittedSprite('front-door', TILE, TILE, frontDoorShapes(false), frontDoorShapes(true)),
};

export function renderObject(id: string, state: 'idle' | 'active' = 'idle'): Bitmap {
  const spec = OBJECT_SPRITES[id];
  if (!spec) throw new Error(`no authored sprite for object "${id}" — see design.md §11`);
  const shapes = state === 'active' ? (spec.active ?? spec.idle) : spec.idle;
  const bmp = createBitmap(spec.width, spec.height);
  // HFM Track B gives every prop one squashed ground-contact shadow. Two hard pixel bands
  // imply the ellipse without alpha or blur; the object then paints over it. A rug is the
  // ground surface itself, so its authored fringe is its contact edge.
  if (id !== 'rug') {
    paintShapes(bmp, [
      rect(6, spec.height - 2, Math.max(4, spec.width - 12), 1, CREAM_SHADOW),
      rect(3, spec.height - 1, Math.max(4, spec.width - 6), 1, CREAM_SHADOW),
    ]);
  }
  paintShapes(bmp, shapes);
  return bmp;
}
