import {
  CREAM_SHADOW,
  HAIR_AUBURN,
  INK,
  LEAF_GREEN,
  SKIN_RAMPS,
  WOOD,
} from '../palette';
import type { AnchoredOverlay, BodyFrame, Dir, OutfitSet, Shape } from '../sprite-spec';

/**
 * A0 sprite set — the art-risk spike (SPEC §17, design.md §11).
 *
 * Scope is exactly what the master plan's A0 row asks for: one four-direction walk,
 * one seated action, a hair layer, and an outfit, on the average build plus the
 * offset-derived slim build. Nothing here is final art; it exists to prove the
 * layer/anchor/offset system before P3 depends on it.
 *
 * Proportions per design.md §6: 32×48, big head (~45% of height), dot mouth, mitten
 * hands. Every colour is a §2 palette constant — the validator rejects anything else.
 * World-track outlines use the fill ramp's shadow, never Ink (design.md §3 Track B).
 */

const SKIN = SKIN_RAMPS[1]!; // A0 uses skin ramp 2
const HAIR = HAIR_AUBURN;

// Vertical layout. Head is 19 of 48 rows ≈ 40% with the hair cap on top ≈ 45%.
const HEAD_TOP = 4;
const HEAD_H = 18;
const TORSO_TOP = 22;
const TORSO_H = 13;
const LEG_TOP = 35;

const rect = (x: number, y: number, w: number, h: number, c: string): Shape => ({ k: 'rect', x, y, w, h, c });
const px = (x: number, y: number, c: string): Shape => ({ k: 'px', x, y, c });

/** Soft colored outline around a filled box, using that ramp's shadow (design.md §3). */
function outlined(x: number, y: number, w: number, h: number, fill: string, shadow: string): Shape[] {
  return [
    rect(x, y, w, h, shadow),
    rect(x + 1, y + 1, w - 2, h - 2, fill),
  ];
}

/** Legs + feet. `lift` raises one leg for the walk loop. */
function legs(lift: 0 | 1): Shape[] {
  return [
    ...outlined(12, LEG_TOP - lift, 4, 12, SKIN.base, SKIN.shadow),
    ...outlined(17, LEG_TOP + lift, 4, 12, SKIN.base, SKIN.shadow),
    // Contact shadow: the one sanctioned neutral per shape (design.md §2 per-shape rule).
    rect(12, 46 - lift, 4, 1, CREAM_SHADOW),
    rect(17, 46 + lift, 4, 1, CREAM_SHADOW),
  ];
}

/**
 * Profile legs: one in front of the other, so the stance is 4px wide instead of 9px.
 * This is what makes the side facings distinguishable in flat Ink (design.md §6).
 */
function legsProfile(lift: 0 | 1): Shape[] {
  return [
    ...outlined(14, LEG_TOP + lift, 5, 12, SKIN.shadow, SKIN.shadow), // trailing leg, in shade
    ...outlined(14, LEG_TOP - lift, 5, 12, SKIN.base, SKIN.shadow),
    rect(14, 46 - lift, 5, 1, CREAM_SHADOW),
  ];
}

/** Arms hang either side of the torso; `swing` alternates them across the loop. */
function arms(swing: 0 | 1): Shape[] {
  const lY = 24 + swing;
  const rY = 24 + (1 - swing);
  return [
    ...outlined(8, lY, 3, 9, SKIN.base, SKIN.shadow),
    ...outlined(21, rY, 3, 9, SKIN.base, SKIN.shadow),
    // Mitten hands (design.md §6).
    ...outlined(8, lY + 9, 3, 3, SKIN.light, SKIN.shadow),
    ...outlined(21, rY + 9, 3, 3, SKIN.light, SKIN.shadow),
  ];
}

/** Profile: only the near arm is visible, swinging across the body. */
function armsProfile(facing: 'left' | 'right', swing: 0 | 1): Shape[] {
  const x = facing === 'left' ? 11 : 18;
  const y = 24 + swing;
  return [
    ...outlined(x, y, 3, 9, SKIN.base, SKIN.shadow),
    ...outlined(x, y + 9, 3, 3, SKIN.light, SKIN.shadow),
  ];
}

const headFront = (): Shape[] => outlined(9, HEAD_TOP, 14, HEAD_H, SKIN.base, SKIN.shadow);

/** Profile head: 11px instead of 14px, offset toward the facing side, with a nose bump. */
function headProfile(facing: 'left' | 'right'): Shape[] {
  const x = facing === 'left' ? 8 : 13;
  const noseX = facing === 'left' ? x - 1 : x + 11;
  return [
    ...outlined(x, HEAD_TOP, 11, HEAD_H, SKIN.base, SKIN.shadow),
    rect(noseX, HEAD_TOP + 10, 1, 2, SKIN.shadow),
  ];
}

const torsoProfile = (): Shape[] => outlined(12, TORSO_TOP, 8, TORSO_H, SKIN.base, SKIN.shadow);

/** Front face: two large eyes + dot mouth. Emotion lives in the eyes (design.md §6). */
const faceFront = (): Shape[] => [
  rect(12, 13, 2, 3, INK),
  rect(18, 13, 2, 3, INK),
  px(15, 18, SKIN.shadow),
  px(16, 18, SKIN.shadow),
];

/** Profile face: one eye, shifted toward the facing side. */
const faceProfile = (facing: 'left' | 'right'): Shape[] =>
  facing === 'left' ? [rect(11, 13, 2, 3, INK), px(10, 18, SKIN.shadow)] : [rect(19, 13, 2, 3, INK), px(21, 18, SKIN.shadow)];

const torso = (): Shape[] => outlined(11, TORSO_TOP, 10, TORSO_H, SKIN.base, SKIN.shadow);

// ---------------------------------------------------------------------------
// Body frames — average build
// ---------------------------------------------------------------------------

function walkFrame(dir: Dir, i: 0 | 1): BodyFrame {
  const swing: 0 | 1 = i === 0 ? 0 : 1;
  const lift: 0 | 1 = i === 0 ? 0 : 1;
  const profile = dir === 'left' || dir === 'right';

  if (profile) {
    const facing = dir === 'left' ? 'left' : 'right';
    const armX = facing === 'left' ? 12 : 19;
    return {
      id: `average-walk-${dir}-${i}`,
      dir,
      shapes: [
        ...legsProfile(lift),
        ...torsoProfile(),
        ...armsProfile(facing, swing),
        ...headProfile(facing),
        ...faceProfile(facing),
      ],
      anchors: {
        // Profile head sits 1px off-centre toward the facing side, so hair follows it.
        head: { x: facing === 'left' ? 14 : 19, y: HEAD_TOP },
        handL: { x: armX, y: 24 + swing + 10 },
        handR: { x: armX, y: 24 + swing + 10 },
      },
    };
  }

  const face = dir === 'down' ? faceFront() : [];
  return {
    id: `average-walk-${dir}-${i}`,
    dir,
    shapes: [...legs(lift), ...arms(swing), ...torso(), ...headFront(), ...face],
    anchors: {
      head: { x: 16, y: HEAD_TOP },
      handL: { x: 9, y: 24 + swing + 10 },
      handR: { x: 22, y: 24 + (1 - swing) + 10 },
    },
  };
}

/** The seated action (couch/idle). Legs fold forward, whole body drops 6px. */
function sitFrame(): BodyFrame {
  const drop = 6;
  return {
    id: 'average-sit-down',
    dir: 'down',
    shapes: [
      // Folded legs read as a horizontal block rather than two verticals.
      ...outlined(11, LEG_TOP + drop - 2, 10, 5, SKIN.base, SKIN.shadow),
      rect(11, LEG_TOP + drop + 3, 10, 1, CREAM_SHADOW),
      ...outlined(8, 24 + drop, 3, 8, SKIN.base, SKIN.shadow),
      ...outlined(21, 24 + drop, 3, 8, SKIN.base, SKIN.shadow),
      ...outlined(8, 32 + drop, 3, 3, SKIN.light, SKIN.shadow),
      ...outlined(21, 32 + drop, 3, 3, SKIN.light, SKIN.shadow),
      ...outlined(11, TORSO_TOP + drop, 10, TORSO_H - 2, SKIN.base, SKIN.shadow),
      ...outlined(9, HEAD_TOP + drop, 14, HEAD_H, SKIN.base, SKIN.shadow),
      rect(12, 13 + drop, 2, 3, INK),
      rect(18, 13 + drop, 2, 3, INK),
      px(15, 18 + drop, SKIN.shadow),
      px(16, 18 + drop, SKIN.shadow),
    ],
    anchors: {
      head: { x: 16, y: HEAD_TOP + drop },
      handL: { x: 9, y: 32 + drop },
      handR: { x: 22, y: 32 + drop },
    },
  };
}

export const A0_BODY_FRAMES: readonly BodyFrame[] = [
  walkFrame('down', 0),
  walkFrame('down', 1),
  walkFrame('up', 0),
  walkFrame('up', 1),
  walkFrame('left', 0),
  walkFrame('left', 1),
  walkFrame('right', 0),
  walkFrame('right', 1),
  sitFrame(),
];

// ---------------------------------------------------------------------------
// Hair — ONE authored overlay, positioned by every frame's head anchor
// ---------------------------------------------------------------------------

/**
 * Authored once. `offset` is relative to `anchors.head` (top-centre of the skull),
 * so the same 12 shapes ride the walk bob and the 6px seated drop with no per-frame
 * authoring. This is the anchor claim A0 exists to test.
 */
export const A0_HAIR: AnchoredOverlay = {
  id: 'hair-auburn-short',
  anchor: 'head',
  offset: { x: -8, y: -2 },
  shapes: [
    rect(1, 0, 14, 3, HAIR.shadow),
    rect(1, 1, 14, 3, HAIR.base),
    rect(0, 3, 2, 7, HAIR.base),
    rect(14, 3, 2, 7, HAIR.base),
    rect(0, 3, 1, 7, HAIR.shadow),
    rect(15, 3, 1, 7, HAIR.shadow),
    rect(3, 1, 10, 1, HAIR.light),
  ],
};

// ---------------------------------------------------------------------------
// Outfit — keyed to the body frames (design.md §6), authored per direction
// ---------------------------------------------------------------------------

function tunic(front: boolean): Shape[] {
  return [
    ...outlined(11, TORSO_TOP + 1, 10, TORSO_H - 1, LEAF_GREEN.base, LEAF_GREEN.shadow),
    // Belt in the wood ramp — a second shape, so a second ramp is legal (design.md §2 is per-shape).
    rect(11, TORSO_TOP + TORSO_H - 3, 10, 2, WOOD.shadow),
    ...(front ? [rect(15, TORSO_TOP + 3, 2, 5, LEAF_GREEN.light)] : []),
  ];
}

export const A0_OUTFIT: OutfitSet = {
  id: 'outfit-green-tunic',
  perDir: { down: tunic(true), up: tunic(false), left: tunic(false), right: tunic(false) },
  // One authored set covers the loop: frame 1 rides 1px lower with the walk bob.
  frameBob: [0, 1],
};
