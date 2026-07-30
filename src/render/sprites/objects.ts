import { createBitmap, type Bitmap } from '../../../scripts/art/png';
import { paintShapes, type Shape } from '../sprite-spec';
import {
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

// ---------------------------------------------------------------------------
// Bedroom
// ---------------------------------------------------------------------------

/** Headboard, pillow, duvet fold, and two legs with floor showing between them. */
function bedShapes(occupied: boolean): Shape[] {
  return [
    // Headboard stands proud; the notches beside it are what break the rectangle.
    ...outlined(6, 0, 52, 12, WOOD.base, WOOD.shadow),
    notch(0, 0, 6, 12),
    notch(58, 0, 6, 12),
    ...outlined(2, 10, 60, 48, DUSK_PLUM.base, DUSK_PLUM.shadow),
    ...(occupied
      ? [
          // Slept in: the pillow dents and the duvet humps over a body.
          ...outlined(8, 14, 48, 10, DUSK_PLUM.light, DUSK_PLUM.shadow),
          ...outlined(10, 28, 44, 18, DUSK_PLUM.light, DUSK_PLUM.shadow),
        ]
      : [
          ...outlined(8, 13, 48, 13, DUSK_PLUM.light, DUSK_PLUM.shadow),
          lip(4, 32, 56, DUSK_PLUM.light),
          rect(4, 33, 56, 2, DUSK_PLUM.shadow),
        ]),
    // Legs, with the floor visible between them.
    rect(4, 58, 7, 6, WOOD.shadow),
    rect(53, 58, 7, 6, WOOD.shadow),
    notch(11, 58, 42, 6),
    notch(0, 58, 4, 6),
    notch(60, 58, 4, 6),
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
    rect(2, 1, 60, 3, GREY.shadow), // curtain rail overhanging both ends
    ...outlined(44, 4, 10, 6, GREY.base, GREY.shadow), // head
    rect(47, 10, 4, 12, GREY.shadow), // riser
    ...(running
      ? [
          rect(45, 11, 2, 12, WATER_BLUE.light),
          rect(51, 11, 2, 12, WATER_BLUE.light),
          rect(48, 12, 2, 11, WATER_BLUE.base),
        ]
      : []),
    ...outlined(4, 22, 56, 9, WATER_BLUE.light, WATER_BLUE.shadow), // tray
    notch(0, 4, 44, 18),
    notch(54, 4, 10, 18),
    notch(0, 0, 2, 32),
    notch(62, 0, 2, 32),
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
    ...outlined(10, 2, 76, 14, TERRACOTTA.base, TERRACOTTA.shadow), // back
    ...outlined(0, 6, 12, 21, TERRACOTTA.light, TERRACOTTA.shadow), // arms stand taller than the seat
    ...outlined(84, 6, 12, 21, TERRACOTTA.light, TERRACOTTA.shadow),
    ...outlined(12, 15, 72, 12, TERRACOTTA.base, TERRACOTTA.shadow), // seat
    // Three cushion divisions.
    rect(36, 16, 1, 10, TERRACOTTA.shadow),
    rect(60, 16, 1, 10, TERRACOTTA.shadow),
    ...(sat ? [rect(38, 17, 21, 2, TERRACOTTA.shadow)] : [lip(13, 16, 70, TERRACOTTA.light)]),
    rect(4, 27, 6, 4, TERRACOTTA.shadow), // legs
    rect(86, 27, 6, 4, TERRACOTTA.shadow),
    notch(0, 0, 10, 6),
    notch(86, 0, 10, 6),
    notch(10, 27, 76, 5),
    notch(0, 31, 96, 1),
  ];
}

/** Screen on a narrow neck over a wide foot — a clear T in flat Ink. */
function tvShapes(): Shape[] {
  return [
    ...outlined(2, 2, 28, 18, GREY.shadow, GREY.shadow),
    rect(4, 4, 24, 14, GREY.base), // screen face
    rect(13, 20, 6, 6, GREY.shadow), // neck
    ...outlined(7, 26, 18, 5, GREY.base, GREY.shadow), // foot
    notch(0, 20, 13, 12),
    notch(19, 20, 13, 12),
    notch(0, 26, 7, 6),
    notch(25, 26, 7, 6),
    notch(0, 0, 32, 2),
  ];
}

function benchShapes(lifting: boolean): Shape[] {
  return [
    ...outlined(2, 10, 7, 12, GREY.shadow, GREY.shadow), // rack upright at one end
    ...(lifting
      ? [rect(2, 5, 28, 2, GREY.light)] // bar raised off the rack
      : [rect(2, 11, 12, 2, GREY.light)]),
    ...outlined(6, 13, 22, 6, TERRACOTTA.base, TERRACOTTA.shadow), // padded top
    rect(9, 19, 4, 11, GREY.shadow), // legs
    rect(21, 19, 4, 11, GREY.shadow),
    notch(13, 19, 8, 13),
    notch(0, 22, 6, 10),
    notch(25, 19, 7, 13),
    notch(0, 0, 32, 5),
  ];
}

function treadmillShapes(running: boolean): Shape[] {
  return [
    ...outlined(21, 1, 10, 7, GREY.light, GREY.shadow), // console
    rect(24, 8, 4, 12, GREY.shadow), // upright post
    // Sloping deck: three stepped bands, so the ramp reads in flat Ink.
    ...outlined(12, 19, 19, 4, GREY.base, GREY.shadow),
    ...outlined(6, 22, 21, 4, GREY.base, GREY.shadow),
    ...outlined(1, 25, 22, 5, GREY.base, GREY.shadow),
    ...(running
      ? [rect(4, 27, 4, 1, GREY.light), rect(12, 27, 4, 1, GREY.light), rect(9, 23, 4, 1, GREY.light)]
      : [rect(6, 27, 4, 1, GREY.light), rect(14, 27, 4, 1, GREY.light)]),
    notch(0, 0, 21, 19),
    notch(0, 19, 12, 3),
    notch(0, 22, 6, 3),
    notch(27, 22, 5, 10),
    notch(23, 25, 9, 7),
  ];
}

function rugShapes(scuffed: boolean): Shape[] {
  const fringeColumns = [1, 5, 9, 13, 17, 21, 25, 29];
  return [
    ...outlined(1, 6, 30, 20, TERRACOTTA.base, TERRACOTTA.shadow),
    rect(5, 11, 22, 10, TERRACOTTA.light), // woven band
    rect(9, 14, 14, 4, scuffed ? TERRACOTTA.base : TERRACOTTA.shadow),
    // Alternating fringe — the entire silhouette signature lives here.
    ...fringeColumns.flatMap((x) => [
      rect(x, 3, 2, 3, TERRACOTTA.shadow),
      rect(x, 26, 2, 3, TERRACOTTA.shadow),
    ]),
    notch(0, 0, 32, 3),
    notch(0, 29, 32, 3),
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
  bed: { width: 2 * TILE, height: 2 * TILE, idle: bedShapes(false), active: bedShapes(true) },
  wardrobe,
  toilet: { width: TILE, height: TILE, idle: toiletShapes(false), active: toiletShapes(true) },
  sink: { width: TILE, height: TILE, idle: sinkShapes(false), active: sinkShapes(true) },
  shower: { width: 2 * TILE, height: TILE, idle: showerShapes(false), active: showerShapes(true) },
  fridge: { width: TILE, height: TILE, idle: fridgeShapes(false), active: fridgeShapes(true) },
  microwave: { width: TILE, height: TILE, idle: microwaveShapes(false), active: microwaveShapes(true) },
  counter,
  couch: { width: 3 * TILE, height: TILE, idle: couchShapes(false), active: couchShapes(true) },
  tv: { width: TILE, height: TILE, idle: tvShapes() },
  bench: { width: TILE, height: TILE, idle: benchShapes(false), active: benchShapes(true) },
  treadmill: { width: TILE, height: TILE, idle: treadmillShapes(false), active: treadmillShapes(true) },
  rug: { width: TILE, height: TILE, idle: rugShapes(false), active: rugShapes(true) },
  guitar: { width: TILE, height: TILE, idle: guitarShapes(false), active: guitarShapes(true) },
  'front-door': { width: TILE, height: TILE, idle: frontDoorShapes(false), active: frontDoorShapes(true) },
};

export function renderObject(id: string, state: 'idle' | 'active' = 'idle'): Bitmap {
  const spec = OBJECT_SPRITES[id];
  if (!spec) throw new Error(`no authored sprite for object "${id}" — see design.md §11`);
  const shapes = state === 'active' ? (spec.active ?? spec.idle) : spec.idle;
  const bmp = createBitmap(spec.width, spec.height);
  paintShapes(bmp, shapes);
  return bmp;
}
