import { createBitmap, type Bitmap } from '../../../scripts/art/png';
import { paintShapes, SPRITE_H, SPRITE_W, type Shape } from '../sprite-spec';
import type { AppearancePalette } from '../appearance';
import { CREAM_LIGHT, CREAM_SHADOW, GREY, INK, LANTERN_GOLD, WOOD } from '../palette';
import { rect, px, outlined } from './parts';

/**
 * The v1 character bill — 48 frames (design.md §6, P6 T4).
 *
 * P3 shipped nine frames: walk ×4 directions ×2, plus one seated frame that `stand` and
 * `sleep` both borrowed. That borrowing is why a sleeping sim looked like a sitting one
 * for three phases, and it is the failure mode this module exists to end.
 *
 * The construction rules are A0's and are **not re-litigated** — A0 proved them and P3
 * depends on them:
 *  - 32×48 source cell, rendered at 1.5× in-world, with an extra-large caricature head;
 *  - layer order base body → face → hair → outfit, with hair keyed to the head anchor;
 *  - world-track outlines use the fill ramp's shadow, never Ink (design.md §3);
 *  - up and down share a silhouette by design (A0 finding), so **direction is carried by
 *    the face layer** — which is why every frame that has a facing draws one.
 *
 * What is new here is that the palette is a *parameter*. The same shapes render as four
 * different people, which is design.md §6's "zero redrawn frames" claim taken literally
 * and asserted in `appearance.test.ts`.
 */

// HFM look F82, adapted as the off-pitch Auto Life hero. The top knot, angled eyes and
// toothy smile are structural identity cues from HFM's real portrait sheet, not a new
// generic chibi. The head occupies half the cell before the body begins so expression is
// still legible when the whole 24×14 room is visible.
export const HERO_LOOK_SOURCE = 'Hero Football Manager portrait f82' as const;
export const HERO_HEAD_SHARE = 0.5;

const HEAD_TOP = 3;
const HEAD_H = 21;
const HEAD_X = 4;
const HEAD_W = 24;
const TORSO_TOP = 22;
const TORSO_H = 13;
const LEG_TOP = 35;

export type Facing = 'up' | 'down' | 'left' | 'right';

interface Kit {
  skin: AppearancePalette['skin'];
  hair: AppearancePalette['hair'];
  outfit: AppearancePalette['outfit'];
}

// ---------------------------------------------------------------------------
// Body parts
// ---------------------------------------------------------------------------

/** Wide stepped F82 head: cheek width dominates, while the chin stays compact. */
const headFront = (k: Kit, dy = 0): Shape[] => [
  rect(HEAD_X + 2, HEAD_TOP + dy, HEAD_W - 4, 1, k.skin.shadow),
  rect(HEAD_X, HEAD_TOP + 1 + dy, HEAD_W, HEAD_H - 5, k.skin.shadow),
  rect(HEAD_X + 2, HEAD_TOP + HEAD_H - 4 + dy, HEAD_W - 4, 4, k.skin.shadow),
  rect(HEAD_X + 3, HEAD_TOP + 1 + dy, HEAD_W - 6, 1, k.skin.light),
  rect(HEAD_X + 1, HEAD_TOP + 2 + dy, HEAD_W - 2, HEAD_H - 7, k.skin.base),
  rect(HEAD_X + 3, HEAD_TOP + HEAD_H - 5 + dy, HEAD_W - 6, 4, k.skin.base),
];

function headProfile(k: Kit, facing: 'left' | 'right', dy = 0): Shape[] {
  const x = facing === 'left' ? 3 : 10;
  const noseX = facing === 'left' ? x - 2 : x + 20;
  return [
    ...outlined(x, HEAD_TOP + dy, 20, HEAD_H, k.skin.base, k.skin.shadow),
    rect(noseX, HEAD_TOP + 11 + dy, 2, 3, k.skin.shadow),
  ];
}

export type FaceMood = 'rest' | 'joy' | 'effort' | 'focus' | 'awkward' | 'tired';
export const HERO_FACE_MOODS: readonly FaceMood[] = [
  'rest', 'joy', 'effort', 'focus', 'awkward', 'tired',
] as const;

/**
 * HFM expression swaps over one fixed head. F82's one big move is the eye-and-smile
 * band: angled eyes above an oversized tooth display. Other moods change only that band,
 * preserving the character rather than redrawing a different person for every activity.
 */
function faceFront(k: Kit, dy = 0, mood: FaceMood = 'rest'): Shape[] {
  if (mood === 'tired') {
    return [
      rect(8, 12 + dy, 5, 1, INK), rect(19, 12 + dy, 5, 1, INK),
      rect(9, 15 + dy, 5, 1, INK), rect(18, 15 + dy, 5, 1, INK),
      rect(14, 20 + dy, 4, 1, k.skin.shadow),
    ];
  }
  if (mood === 'joy') {
    return [
      rect(8, 12 + dy, 2, 1, INK), rect(10, 13 + dy, 4, 1, INK),
      rect(18, 13 + dy, 4, 1, INK), rect(22, 12 + dy, 2, 1, INK),
      rect(11, 17 + dy, 10, 5, INK),
      rect(12, 18 + dy, 8, 2, CREAM_LIGHT),
      rect(13, 20 + dy, 6, 1, k.skin.shadow),
    ];
  }
  if (mood === 'effort') {
    return [
      rect(8, 11 + dy, 6, 2, INK), rect(18, 11 + dy, 6, 2, INK),
      rect(10, 14 + dy, 3, 3, INK), rect(19, 14 + dy, 3, 3, INK),
      rect(10, 19 + dy, 12, 3, INK), rect(11, 19 + dy, 10, 1, CREAM_LIGHT),
    ];
  }
  if (mood === 'focus') {
    return [
      rect(8, 11 + dy, 6, 1, INK), rect(18, 11 + dy, 6, 1, INK),
      rect(10, 13 + dy, 3, 4, INK), rect(19, 13 + dy, 3, 4, INK),
      px(10, 13 + dy, CREAM_LIGHT), px(19, 13 + dy, CREAM_LIGHT),
      rect(12, 20 + dy, 8, 2, k.skin.shadow),
    ];
  }
  if (mood === 'awkward') {
    return [
      rect(8, 12 + dy, 5, 1, INK), rect(19, 11 + dy, 5, 1, INK),
      rect(10, 14 + dy, 3, 4, INK), rect(19, 13 + dy, 3, 4, INK),
      px(10, 14 + dy, CREAM_LIGHT), px(19, 13 + dy, CREAM_LIGHT),
      rect(13, 19 + dy, 7, 2, INK), rect(13, 19 + dy, 5, 1, CREAM_LIGHT),
    ];
  }
  return [
    // F82's angled eyes, enlarged into all-pupil shapes with one HFM-style sparkle.
    rect(8, 11 + dy, 6, 1, INK), rect(18, 11 + dy, 6, 1, INK),
    rect(9, 13 + dy, 4, 5, INK), rect(19, 13 + dy, 4, 5, INK),
    px(9, 13 + dy, CREAM_LIGHT), px(19, 13 + dy, CREAM_LIGHT),
    // F82 tooth smile, the defining move kept visible even at room scale.
    rect(11, 19 + dy, 10, 3, INK), rect(12, 19 + dy, 8, 1, CREAM_LIGHT),
  ];
}

/** Closed eyes — sleep, nap, and the droop frame. A flat lid, never a dot. */
const faceClosed = (k: Kit, dy = 0): Shape[] => [
  rect(8, 14 + dy, 6, 1, INK),
  rect(18, 14 + dy, 6, 1, INK),
  rect(14, 20 + dy, 4, 1, k.skin.shadow),
];

const faceProfile = (k: Kit, facing: 'left' | 'right', dy = 0): Shape[] =>
  facing === 'left'
    ? [rect(7, 13 + dy, 4, 5, INK), px(7, 13 + dy, CREAM_LIGHT), rect(5, 20 + dy, 5, 2, INK)]
    : [rect(21, 13 + dy, 4, 5, INK), px(21, 13 + dy, CREAM_LIGHT), rect(22, 20 + dy, 5, 2, INK)];

/**
 * Torso is 12 wide, not 10.
 *
 * A0 locked the *anchor system* — head/hand anchors, layer order, offset-derived slim —
 * not every dimension. At 10px under a 14px head the figure read as a stick with a
 * balloon on top, which the review sheet showed immediately and no test could. 12 keeps
 * `deriveSlim`'s width floor and stance rules intact and reads as a body.
 */
const torso = (k: Kit, dy = 0): Shape[] =>
  outlined(9, TORSO_TOP + dy, 14, TORSO_H, k.skin.base, k.skin.shadow);

const torsoProfile = (k: Kit, dy = 0): Shape[] =>
  outlined(10, TORSO_TOP + dy, 12, TORSO_H, k.skin.base, k.skin.shadow);

/** F82 top knot and asymmetric crown, used on every frame from the shared head anchor. */
function hairCap(k: Kit, dy = 0, profile: 'left' | 'right' | null = null): Shape[] {
  const x = profile === 'left' ? 2 : profile === 'right' ? 9 : 4;
  const w = profile === null ? 24 : 21;
  return [
    // Top knot is F82's silhouette contract.
    rect(x + 9, HEAD_TOP - 3 + dy, 7, 4, k.hair.shadow),
    rect(x + 10, HEAD_TOP - 3 + dy, 5, 2, k.hair.base),
    rect(x + 11, HEAD_TOP - 3 + dy, 2, 1, k.hair.light),
    // Broad crown with one deliberately uneven side.
    rect(x + 4, HEAD_TOP - 1 + dy, w - 7, 3, k.hair.shadow),
    rect(x + 1, HEAD_TOP + 1 + dy, w - 2, 6, k.hair.shadow),
    rect(x + 3, HEAD_TOP + 1 + dy, w - 5, 4, k.hair.base),
    rect(x + 4, HEAD_TOP + 1 + dy, w - 8, 1, k.hair.light),
    rect(x, HEAD_TOP + 4 + dy, 4, 7, k.hair.shadow),
    rect(x + 1, HEAD_TOP + 5 + dy, 3, 5, k.hair.base),
    rect(x + w - 3, HEAD_TOP + 4 + dy, 3, 5, k.hair.shadow),
  ];
}

/** The tunic, keyed to the body. A belt in the wood ramp is a second shape, so legal. */
/**
 * The tunic runs to the hips. Stopping at the waist left 12px of bare leg and read as
 * underwear rather than clothing — again a review-sheet finding, not a test failure.
 */
function tunic(k: Kit, front: boolean, dy = 0): Shape[] {
  return [
    ...outlined(9, TORSO_TOP + 1 + dy, 14, TORSO_H + 2, k.outfit.base, k.outfit.shadow),
    rect(9, TORSO_TOP + TORSO_H - 3 + dy, 14, 2, WOOD.shadow),
    ...(front ? [rect(15, TORSO_TOP + 3 + dy, 2, 5, k.outfit.light)] : []),
  ];
}

function tunicProfile(k: Kit, dy = 0): Shape[] {
  return [
    ...outlined(10, TORSO_TOP + 1 + dy, 12, TORSO_H + 2, k.outfit.base, k.outfit.shadow),
    rect(10, TORSO_TOP + TORSO_H - 3 + dy, 12, 2, WOOD.shadow),
  ];
}

function legs(k: Kit, lift: number, dy = 0): Shape[] {
  return [
    ...outlined(10, LEG_TOP - lift + dy, 5, 12, k.skin.base, k.skin.shadow),
    ...outlined(17, LEG_TOP + lift + dy, 5, 12, k.skin.base, k.skin.shadow),
    rect(9, 45 - lift + dy, 6, 2, CREAM_SHADOW),
    rect(17, 45 + lift + dy, 6, 2, CREAM_SHADOW),
  ];
}

/** Profile legs: one in front of the other, so the stance reads 5px wide, not 9px. */
function legsProfile(k: Kit, lift: number, dy = 0): Shape[] {
  return [
    ...outlined(14, LEG_TOP + lift + dy, 5, 12, k.skin.shadow, k.skin.shadow),
    ...outlined(14, LEG_TOP - lift + dy, 5, 12, k.skin.base, k.skin.shadow),
    rect(14, 46 - lift + dy, 5, 1, CREAM_SHADOW),
  ];
}

function arms(k: Kit, swing: number, dy = 0): Shape[] {
  const lY = 24 + swing + dy;
  const rY = 24 - swing + dy;
  return [
    ...outlined(6, lY, 4, 9, k.skin.base, k.skin.shadow),
    ...outlined(22, rY, 4, 9, k.skin.base, k.skin.shadow),
    ...outlined(6, lY + 8, 4, 4, k.skin.light, k.skin.shadow),
    ...outlined(22, rY + 8, 4, 4, k.skin.light, k.skin.shadow),
  ];
}

/**
 * The near arm in profile, swinging **past** the body's leading edge.
 *
 * The first version placed it at x 11 or 18, both of which sit inside the 11–20 torso, so
 * the arm could never change the outline — and the two contact frames of a profile walk
 * came out with identical silhouettes. Since the legs in profile occupy one column by
 * design (that is what makes side facings readable in flat Ink), the arm is the only part
 * that can carry the stride. It has to be visible to do that.
 */
function armsProfile(k: Kit, facing: 'left' | 'right', swing: number, dy = 0): Shape[] {
  const x = facing === 'left' ? 7 : 21;
  const y = 24 + swing + dy;
  return [
    ...outlined(x, y, 4, 9, k.skin.base, k.skin.shadow),
    ...outlined(x, y + 8, 4, 4, k.skin.light, k.skin.shadow),
  ];
}

/** Both arms raised to a given height — brush, stretch, shower, lift. */
function armsRaised(k: Kit, top: number, dy = 0): Shape[] {
  return [
    ...outlined(7, top + dy, 3, 24 + (24 - top) - 12, k.skin.base, k.skin.shadow),
    ...outlined(22, top + dy, 3, 24 + (24 - top) - 12, k.skin.base, k.skin.shadow),
    ...outlined(7, top - 3 + dy, 3, 3, k.skin.light, k.skin.shadow),
    ...outlined(22, top - 3 + dy, 3, 3, k.skin.light, k.skin.shadow),
  ];
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

/**
 * Four-frame walk cycle: contact, down, opposite contact, up.
 *
 * The two contact frames must **mirror**, not repeat. The first version used
 * `lift = [0,1,0,1]`, which made frames 0 and 2 byte-identical — a four-frame cycle that
 * was really a two-frame one, caught by the silhouette-distinctness probe rather than by
 * looking, because at 1× a duplicated contact just reads as a slightly stiff walk.
 * `lift` and `swing` therefore run negative on frame 2, putting the other leg forward.
 */
function walk(k: Kit, facing: Facing, i: number): Shape[] {
  const lift = [1, 0, -1, 0][i]!;
  const swing = [1, 0, -1, 0][i]!;
  const bob = [0, 1, 0, -1][i]!;
  if (facing === 'left' || facing === 'right') {
    return [
      ...legsProfile(k, lift),
      ...torsoProfile(k, bob),
      ...tunicProfile(k, bob),
      ...armsProfile(k, facing, swing, bob),
      ...headProfile(k, facing, bob),
      ...faceProfile(k, facing, bob),
      ...hairCap(k, bob, facing),
    ];
  }
  return [
    ...legs(k, lift),
    ...arms(k, swing, bob),
    ...torso(k, bob),
    ...tunic(k, facing === 'down', bob),
    ...headFront(k, bob),
    ...(facing === 'down' ? faceFront(k, bob) : []),
    ...hairCap(k, bob),
  ];
}

/** Running: longer stride, both feet clear of contact on the pass frames. */
function run(k: Kit, i: number): Shape[] {
  const lean = 1;
  // Same rule as the walk cycle: four genuinely different frames, not two repeated.
  const lift = [0, 3, 1, 4][i]!;
  const swing = [1, -1, -1, 1][i]!;
  const toeX = [9, 7, 10, 6][i]!;
  // The trailing leg stays anchored at the hip. An earlier version offset it by lift/2,
  // which at lift 4 opened a 3px gap between hip and thigh — a leg floating in space.
  return [
    ...outlined(10, LEG_TOP - lift, 5, 11 + lift, k.skin.base, k.skin.shadow),
    ...outlined(18, LEG_TOP, 5, 12, k.skin.shadow, k.skin.shadow),
    // A real forward toe, with four positions so the four-frame run reads in silhouette.
    rect(toeX, 45, 7, 2, CREAM_SHADOW),
    ...armsProfile(k, 'right', swing, -lean),
    ...torsoProfile(k, -lean),
    ...tunicProfile(k, -lean),
    ...headProfile(k, 'right', -lean),
    ...faceProfile(k, 'right', -lean),
    ...hairCap(k, -lean, 'right'),
  ];
}

/**
 * Top-down in the bed: one connected body under the duvet, head on the pillow, feet at
 * the foot. The old horizontal scrap used only half the 32x48 cell and looked like a body
 * lying on the floor beside the bed once the hero grew to 1.5x.
 */
function sleep(k: Kit, i: number): Shape[] {
  const breathe = i;
  return [
    // Feet remain connected to the covered body and peek out at the foot of the bed.
    ...outlined(10, 40 + breathe, 5, 7, k.skin.base, k.skin.shadow),
    ...outlined(17, 40 + breathe, 5, 7, k.skin.base, k.skin.shadow),
    rect(9, 46, 6, 1, CREAM_SHADOW),
    rect(17, 46, 6, 1, CREAM_SHADOW),
    // A tapered blanket/body mass, with breathing shown by one lower fold.
    ...outlined(7, 22, 18, 22 + breathe, k.outfit.base, k.outfit.shadow),
    rect(9, 25, 14, 2, k.outfit.light),
    rect(10, 36 + breathe, 12, 2, k.outfit.shadow),
    // Hands resting over the blanket make the anatomy readable at room scale.
    ...outlined(8, 26, 4, 8, k.skin.base, k.skin.shadow),
    ...outlined(20, 26, 4, 8, k.skin.base, k.skin.shadow),
    ...headFront(k),
    ...faceClosed(k),
    ...hairCap(k),
  ];
}

/** Upright on the couch: hips on the cushion, two knees and two feet in front. */
function sit(k: Kit, i: number): Shape[] {
  const shift = i;
  return [
    ...outlined(8, 34, 8, 6, k.skin.base, k.skin.shadow),
    ...outlined(16, 34, 8, 6, k.skin.base, k.skin.shadow),
    ...outlined(9, 39, 6, 8, k.skin.base, k.skin.shadow),
    ...outlined(18, 39, 6, 8, k.skin.base, k.skin.shadow),
    rect(8, 46, 7, 1, CREAM_SHADOW),
    rect(18, 46, 7, 1, CREAM_SHADOW),
    ...outlined(6 - shift, 24, 4, 10, k.skin.base, k.skin.shadow),
    ...outlined(22 + shift, 24, 4, 10, k.skin.base, k.skin.shadow),
    ...torso(k),
    ...tunic(k, true),
    ...headFront(k),
    ...faceFront(k, 0, i === 0 ? 'rest' : 'focus'),
    ...hairCap(k),
  ];
}

/** Curled into the couch rather than lying on the floor in front of it. */
function nap(k: Kit, i: number): Shape[] {
  const sag = 3 + i;
  return [
    ...outlined(8, 35, 16, 6, k.skin.base, k.skin.shadow),
    ...outlined(10, 40, 6, 7, k.skin.base, k.skin.shadow),
    ...outlined(17, 40, 6, 7, k.skin.base, k.skin.shadow),
    rect(9, 46, 7, 1, CREAM_SHADOW),
    rect(17, 46, 7, 1, CREAM_SHADOW),
    ...outlined(8, 25 + sag, 4, 8, k.skin.base, k.skin.shadow),
    ...outlined(20, 25 + sag, 4, 8, k.skin.base, k.skin.shadow),
    ...outlined(10, TORSO_TOP + sag, 12, TORSO_H - 2, k.outfit.base, k.outfit.shadow),
    ...headFront(k, sag),
    ...faceClosed(k, sag),
    ...hairCap(k, sag),
  ];
}

/** Standing at the appliance with a bowl in one hand and food at the mouth. */
function eat(k: Kit, i: number): Shape[] {
  const reach = i === 0 ? 0 : 3;
  return [
    ...legs(k, 0),
    ...outlined(6, 24, 4, 10, k.skin.base, k.skin.shadow),
    ...torso(k),
    ...tunic(k, true),
    // Bowl and supporting hand stay at waist height.
    ...outlined(5, 31, 13, 5, CREAM_LIGHT, CREAM_SHADOW),
    rect(8, 35, 7, 2, WOOD.shadow),
    ...outlined(22, 23 - reach, 4, 8, k.skin.base, k.skin.shadow),
    ...outlined(19, 19 - reach, 5, 5, k.skin.light, k.skin.shadow),
    ...headFront(k),
    ...faceFront(k, 0, 'joy'),
    ...hairCap(k),
  ];
}

/** Standing at the sink, one elbow out, hand at the face. */
function brush(k: Kit, i: number): Shape[] {
  const elbow = i === 0 ? 0 : 2;
  return [
    ...legs(k, 0),
    ...outlined(8, 24, 3, 9, k.skin.base, k.skin.shadow),
    ...outlined(8, 33, 3, 3, k.skin.light, k.skin.shadow),
    ...torso(k),
    ...tunic(k, true),
    ...outlined(23 + elbow, 18, 3, 8, k.skin.base, k.skin.shadow), // upper arm out
    ...outlined(19, 15, 6, 3, k.skin.base, k.skin.shadow), // forearm across to the mouth
    ...outlined(17, 14, 3, 3, k.skin.light, k.skin.shadow),
    ...headFront(k),
    ...faceFront(k, 0, i === 0 ? 'rest' : 'joy'),
    ...hairCap(k),
  ];
}

/** Under the shower: both arms up, plus the steam overlay that separates it from stretch. */
function shower(k: Kit, i: number): Shape[] {
  return [
    ...legs(k, 0),
    ...torso(k),
    ...armsRaised(k, 14 - i),
    ...headFront(k),
    ...faceClosed(k),
    ...hairCap(k),
    // Steam: the one thing that says "shower" and not "quick wash".
    rect(4, 2 + i, 4, 2, GREY.light),
    rect(12, 0 + i, 5, 2, GREY.light),
    rect(22, 3 - i, 4, 2, GREY.light),
    rect(8, 6 - i, 3, 2, GREY.light),
  ];
}

/** Leaning forward over the basin — bent, low, and never armed overhead. */
function quickwash(k: Kit): Shape[] {
  const bend = 4;
  return [
    ...legs(k, 0),
    ...outlined(10, TORSO_TOP + bend, 12, TORSO_H - 3, k.outfit.base, k.outfit.shadow),
    ...outlined(8, 26 + bend, 3, 7, k.skin.base, k.skin.shadow),
    ...outlined(21, 26 + bend, 3, 7, k.skin.base, k.skin.shadow),
    ...headFront(k, bend + 3),
    ...faceFront(k, bend + 3, 'awkward'),
    ...hairCap(k, bend + 4),
  ];
}

/** Compact seated posture that visually overlaps the toilet bowl. */
function toilet(k: Kit): Shape[] {
  return [
    ...outlined(7, 34, 9, 6, k.skin.base, k.skin.shadow),
    ...outlined(16, 34, 9, 6, k.skin.base, k.skin.shadow),
    ...outlined(8, 39, 6, 8, k.skin.base, k.skin.shadow),
    ...outlined(19, 39, 6, 8, k.skin.base, k.skin.shadow),
    rect(7, 46, 7, 1, CREAM_SHADOW),
    rect(19, 46, 7, 1, CREAM_SHADOW),
    ...outlined(7, 25, 4, 9, k.skin.base, k.skin.shadow),
    ...outlined(21, 25, 4, 9, k.skin.base, k.skin.shadow),
    ...outlined(10, TORSO_TOP, 12, TORSO_H, k.outfit.base, k.outfit.shadow),
    ...headFront(k),
    ...faceFront(k, 0, 'awkward'),
    ...hairCap(k),
  ];
}

/** Bar across both hands: down, mid, up. */
function lift(k: Kit, i: number): Shape[] {
  const barY = [30, 22, 12][i]!;
  return [
    ...legs(k, 0),
    ...torso(k),
    ...tunic(k, true),
    ...outlined(7, barY, 3, 26 - barY + 6, k.skin.base, k.skin.shadow),
    ...outlined(22, barY, 3, 26 - barY + 6, k.skin.base, k.skin.shadow),
    rect(4, barY - 2, 24, 2, GREY.shadow), // the bar
    rect(4, barY - 1, 24, 1, GREY.light),
    ...headFront(k),
    ...faceFront(k, 0, 'effort'),
    ...hairCap(k),
  ];
}

/** Reach up, then fold forward. Two frames that share nothing. */
function stretch(k: Kit, i: number): Shape[] {
  if (i === 0) {
    return [
      ...legs(k, 0),
      ...torso(k),
      ...tunic(k, true),
      ...armsRaised(k, 6),
      ...headFront(k),
      ...faceFront(k, 0, 'effort'),
      ...hairCap(k),
    ];
  }
  const fold = 8;
  return [
    ...legs(k, 0),
    ...outlined(10, TORSO_TOP + fold, 12, TORSO_H - 5, k.outfit.base, k.outfit.shadow),
    ...outlined(7, 30 + fold, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(22, 30 + fold, 3, 8, k.skin.base, k.skin.shadow),
    ...headFront(k, fold + 5),
    ...faceFront(k, fold + 5, 'effort'),
    ...hairCap(k, fold + 8),
  ];
}

/** Guitar across the body at three strum positions — the pose Practice is about. */
function practice(k: Kit, i: number): Shape[] {
  const strum = [0, 2, 4][i]!;
  return [
    ...legs(k, 0),
    ...torso(k),
    ...tunic(k, true),
    // Instrument: neck up-left, body across the waist.
    rect(4, 20, 9, 3, WOOD.shadow),
    rect(5, 21, 7, 1, WOOD.light),
    ...outlined(12, 24, 13, 9, WOOD.base, WOOD.shadow),
    rect(17, 27, 4, 3, WOOD.shadow),
    ...(i === 2 ? [rect(15, 26, 1, 5, LANTERN_GOLD.base), rect(22, 26, 1, 5, LANTERN_GOLD.base)] : []),
    // Fretting arm holds the neck; strumming arm moves.
    ...outlined(7, 23, 3, 7, k.skin.base, k.skin.shadow),
    ...outlined(21, 22 + strum, 3, 7, k.skin.base, k.skin.shadow),
    ...outlined(20, 29 + strum, 4, 3, k.skin.light, k.skin.shadow),
    ...headFront(k),
    ...faceFront(k, 0, i === 2 ? 'joy' : 'focus'),
    ...hairCap(k),
  ];
}

/** Shift a shape set sideways — used where a pose leans rather than bobs. */
const shiftX = (shapes: Shape[], dx: number): Shape[] => shapes.map((s) => ({ ...s, x: s.x + dx }));

/**
 * Idle: a one-pixel weight shift, sideways.
 *
 * The first version bobbed vertically, which made `idle-1` byte-identical to `walk-up-1` —
 * both were "standing, one pixel up". Shifting the upper body over a planted leg reads as
 * shifting weight rather than as a step, and it is genuinely a different shape.
 */
function idle(k: Kit, i: number): Shape[] {
  const lean = i;
  return [
    ...legs(k, 0),
    ...shiftX([
      ...arms(k, 0), ...torso(k), ...tunic(k, true),
      ...headFront(k), ...faceFront(k, 0, i === 0 ? 'rest' : 'joy'), ...hairCap(k),
    ], -lean),
  ];
}

/** Standing at the window, turned away, one hand on the sill. */
function idleWindowGazing(k: Kit): Shape[] {
  return [
    ...legsProfile(k, 0),
    ...torsoProfile(k),
    ...tunicProfile(k),
    ...outlined(18, 22, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(19, 20, 4, 3, k.skin.light, k.skin.shadow), // hand raised to the glass
    ...headProfile(k, 'right'),
    ...faceProfile(k, 'right'),
    ...hairCap(k, 0, 'right'),
  ];
}

/** A slow side bend — distinct from `stretch` by the lean, not the arms. */
function idleSlowStretching(k: Kit): Shape[] {
  return [
    ...legs(k, 0),
    ...outlined(13, TORSO_TOP, 10, TORSO_H, k.outfit.base, k.outfit.shadow), // torso leans right
    ...outlined(10, 20, 3, 10, k.skin.base, k.skin.shadow),
    ...outlined(19, 10, 3, 12, k.skin.base, k.skin.shadow), // one arm over the head
    ...outlined(19, 7, 3, 3, k.skin.light, k.skin.shadow),
    ...headFront(k, 2),
    ...faceFront(k, 2, 'effort'),
    ...hairCap(k, 2),
  ];
}

/** Goal 4's reward, and the only frame in the bill that exists purely to be enjoyed. */
function idleAirGuitar(k: Kit): Shape[] {
  return [
    ...outlined(9, LEG_TOP, 5, 12, k.skin.base, k.skin.shadow), // wide stance
    ...outlined(19, LEG_TOP, 5, 12, k.skin.base, k.skin.shadow),
    rect(9, 46, 5, 1, CREAM_SHADOW),
    rect(19, 46, 5, 1, CREAM_SHADOW),
    ...outlined(11, TORSO_TOP - 1, 10, TORSO_H, k.outfit.base, k.outfit.shadow),
    ...outlined(7, 22, 4, 4, k.skin.base, k.skin.shadow), // shoulder, so the arm connects
    ...outlined(4, 17, 4, 7, k.skin.base, k.skin.shadow), // strumming arm flung out
    ...outlined(3, 14, 4, 4, k.skin.light, k.skin.shadow),
    ...outlined(22, 24, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(22, 32, 3, 3, k.skin.light, k.skin.shadow),
    ...headFront(k, -2), // head thrown back
    ...faceFront(k, -2, 'joy'),
    ...hairCap(k, -2),
  ];
}

/**
 * The droop frame (design.md §10: "tiredness is an animation state, not a filter").
 *
 * Shoulders down, head forward, eyes closed. The one frame in the bill selected by state
 * rather than by activity.
 */
function standDroop(k: Kit): Shape[] {
  const sag = 3;
  return [
    ...legs(k, 0),
    ...outlined(8, 26 + sag, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(21, 26 + sag, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(11, TORSO_TOP + sag, 10, TORSO_H - 1, k.outfit.base, k.outfit.shadow),
    ...headFront(k, sag + 2),
    ...faceFront(k, sag + 2, 'tired'),
    ...hairCap(k, sag + 2),
  ];
}

// ---------------------------------------------------------------------------
// The bill
// ---------------------------------------------------------------------------

type FrameBuilder = (k: Kit, i: number) => Shape[];

interface PoseSpec {
  key: string;
  frames: number;
  build: FrameBuilder;
}

const FACINGS: readonly Facing[] = ['down', 'up', 'left', 'right'];

/**
 * design.md §6's recount, verbatim:
 * walk×4dir (16) · sleep (2) · sit (2) · eat (2) · brush (2) · shower (2) · lift (3) ·
 * run (4) · stretch (2) · practice (3) · idle (2) · toilet (1) · quick-wash (1) ·
 * nap (2) · preference idle variants (4) = **48**.
 *
 * `stand` spends none of its own: it aliases walk frame 0, exactly as P3 had it. The
 * fourth "preference idle variant" is the droop frame — content declares three variants
 * (window-gazing, slow-stretching, air-guitar) and design.md §10 requires a tiredness
 * state, which is the same authoring slot.
 */
const POSE_SPECS: readonly PoseSpec[] = [
  ...FACINGS.map((facing) => ({
    key: `walk-${facing}`,
    frames: 4,
    build: (k: Kit, i: number) => walk(k, facing, i),
  })),
  { key: 'sleep', frames: 2, build: sleep },
  { key: 'sit', frames: 2, build: sit },
  { key: 'eat', frames: 2, build: eat },
  { key: 'brush', frames: 2, build: brush },
  { key: 'shower', frames: 2, build: shower },
  { key: 'lift', frames: 3, build: lift },
  { key: 'run', frames: 4, build: run },
  { key: 'stretch', frames: 2, build: stretch },
  { key: 'practice', frames: 3, build: practice },
  { key: 'idle', frames: 2, build: idle },
  { key: 'toilet', frames: 1, build: (k) => toilet(k) },
  { key: 'quickwash', frames: 1, build: (k) => quickwash(k) },
  { key: 'nap', frames: 2, build: nap },
  { key: 'idle-window-gazing', frames: 1, build: (k) => idleWindowGazing(k) },
  { key: 'idle-slow-stretching', frames: 1, build: (k) => idleSlowStretching(k) },
  { key: 'idle-air-guitar', frames: 1, build: (k) => idleAirGuitar(k) },
  { key: 'stand-droop', frames: 1, build: (k) => standDroop(k) },
];

/** Frame count per pose key — emitted into the atlas index so the renderer never guesses. */
export const POSE_FRAMES: Record<string, number> = Object.fromEntries(
  POSE_SPECS.map((p) => [p.key, p.frames]),
);

/** Every authored frame id, in pack order. */
export const CHARACTER_BILL: readonly string[] = POSE_SPECS.flatMap((p) =>
  Array.from({ length: p.frames }, (_, i) => `${p.key}-${i}`),
);

const BUILDER_BY_ID = new Map<string, (k: Kit) => Shape[]>(
  POSE_SPECS.flatMap((p) =>
    Array.from({ length: p.frames }, (_, i) => [`${p.key}-${i}`, (k: Kit) => p.build(k, i)] as const),
  ),
);

/**
 * The shapes for one frame, in one appearance.
 *
 * Exported so `appearance.test.ts` can strip the colour field and prove two presets share
 * geometry — design.md §6's "zero redrawn frames" as an assertion rather than a promise.
 */
export function characterFrameShapes(id: string, palette: AppearancePalette): Shape[] {
  // `stand` is an alias, not a frame: it borrows walk frame 0 for the facing.
  if (id.startsWith('stand-') && id !== 'stand-droop-0') {
    const facing = id.slice('stand-'.length).replace(/-\d+$/, '');
    return walk(palette, facing as Facing, 0);
  }
  const build = BUILDER_BY_ID.get(id);
  if (!build) throw new Error(`no authored character frame "${id}" — see design.md §6's v1 bill`);
  return build(palette);
}

export function renderCharacterFrame(id: string, palette: AppearancePalette): Bitmap {
  const bmp = createBitmap(SPRITE_W, SPRITE_H);
  paintShapes(bmp, characterFrameShapes(id, palette));
  return bmp;
}
