import { createBitmap, type Bitmap } from '../../../scripts/art/png';
import { paintShapes, SPRITE_H, SPRITE_W, type Shape } from '../sprite-spec';
import type { AppearancePalette } from '../appearance';
import { CREAM_SHADOW, GREY, INK, LANTERN_GOLD, WOOD } from '../palette';
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
 *  - 32×48, big head (~45% of height), dot mouth, mitten hands (design.md §6);
 *  - layer order base body → face → hair → outfit, with hair keyed to the head anchor;
 *  - world-track outlines use the fill ramp's shadow, never Ink (design.md §3);
 *  - up and down share a silhouette by design (A0 finding), so **direction is carried by
 *    the face layer** — which is why every frame that has a facing draws one.
 *
 * What is new here is that the palette is a *parameter*. The same shapes render as four
 * different people, which is design.md §6's "zero redrawn frames" claim taken literally
 * and asserted in `appearance.test.ts`.
 */

// A0's proven vertical layout. Changing these invalidates the anchor rule.
const HEAD_TOP = 4;
const HEAD_H = 18;
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

const headFront = (k: Kit, dy = 0): Shape[] =>
  outlined(9, HEAD_TOP + dy, 14, HEAD_H, k.skin.base, k.skin.shadow);

function headProfile(k: Kit, facing: 'left' | 'right', dy = 0): Shape[] {
  const x = facing === 'left' ? 8 : 13;
  const noseX = facing === 'left' ? x - 1 : x + 11;
  return [
    ...outlined(x, HEAD_TOP + dy, 11, HEAD_H, k.skin.base, k.skin.shadow),
    rect(noseX, HEAD_TOP + 10 + dy, 1, 2, k.skin.shadow),
  ];
}

/** Front face: two large eyes + dot mouth. Emotion lives in the eyes (design.md §6). */
const faceFront = (k: Kit, dy = 0): Shape[] => [
  rect(12, 13 + dy, 2, 3, INK),
  rect(18, 13 + dy, 2, 3, INK),
  px(15, 18 + dy, k.skin.shadow),
  px(16, 18 + dy, k.skin.shadow),
];

/** Closed eyes — sleep, nap, and the droop frame. A flat lid, never a dot. */
const faceClosed = (k: Kit, dy = 0): Shape[] => [
  rect(12, 15 + dy, 3, 1, INK),
  rect(18, 15 + dy, 3, 1, INK),
  px(15, 18 + dy, k.skin.shadow),
  px(16, 18 + dy, k.skin.shadow),
];

const faceProfile = (k: Kit, facing: 'left' | 'right', dy = 0): Shape[] =>
  facing === 'left'
    ? [rect(11, 13 + dy, 2, 3, INK), px(10, 18 + dy, k.skin.shadow)]
    : [rect(19, 13 + dy, 2, 3, INK), px(21, 18 + dy, k.skin.shadow)];

/**
 * Torso is 12 wide, not 10.
 *
 * A0 locked the *anchor system* — head/hand anchors, layer order, offset-derived slim —
 * not every dimension. At 10px under a 14px head the figure read as a stick with a
 * balloon on top, which the review sheet showed immediately and no test could. 12 keeps
 * `deriveSlim`'s width floor and stance rules intact and reads as a body.
 */
const torso = (k: Kit, dy = 0): Shape[] =>
  outlined(10, TORSO_TOP + dy, 12, TORSO_H, k.skin.base, k.skin.shadow);

const torsoProfile = (k: Kit, dy = 0): Shape[] =>
  outlined(11, TORSO_TOP + dy, 10, TORSO_H, k.skin.base, k.skin.shadow);

/** Hair as an authored overlay, positioned from the head anchor — A0's v6 cost claim. */
function hairCap(k: Kit, dy = 0, profile: 'left' | 'right' | null = null): Shape[] {
  const x = profile === 'left' ? 7 : profile === 'right' ? 12 : 8;
  const w = profile === null ? 16 : 13;
  return [
    rect(x + 1, HEAD_TOP - 2 + dy, w - 2, 3, k.hair.shadow),
    rect(x + 1, HEAD_TOP - 1 + dy, w - 2, 3, k.hair.base),
    rect(x, HEAD_TOP + 1 + dy, 2, 7, k.hair.base),
    rect(x + w - 2, HEAD_TOP + 1 + dy, 2, 7, k.hair.base),
    rect(x, HEAD_TOP + 1 + dy, 1, 7, k.hair.shadow),
    rect(x + w - 1, HEAD_TOP + 1 + dy, 1, 7, k.hair.shadow),
    rect(x + 3, HEAD_TOP - 1 + dy, w - 6, 1, k.hair.light),
  ];
}

/** The tunic, keyed to the body. A belt in the wood ramp is a second shape, so legal. */
/**
 * The tunic runs to the hips. Stopping at the waist left 12px of bare leg and read as
 * underwear rather than clothing — again a review-sheet finding, not a test failure.
 */
function tunic(k: Kit, front: boolean, dy = 0): Shape[] {
  return [
    ...outlined(10, TORSO_TOP + 1 + dy, 12, TORSO_H + 2, k.outfit.base, k.outfit.shadow),
    rect(10, TORSO_TOP + TORSO_H - 3 + dy, 12, 2, WOOD.shadow),
    ...(front ? [rect(15, TORSO_TOP + 3 + dy, 2, 5, k.outfit.light)] : []),
  ];
}

function tunicProfile(k: Kit, dy = 0): Shape[] {
  return [
    ...outlined(11, TORSO_TOP + 1 + dy, 10, TORSO_H + 2, k.outfit.base, k.outfit.shadow),
    rect(11, TORSO_TOP + TORSO_H - 3 + dy, 10, 2, WOOD.shadow),
  ];
}

function legs(k: Kit, lift: number, dy = 0): Shape[] {
  return [
    ...outlined(12, LEG_TOP - lift + dy, 4, 12, k.skin.base, k.skin.shadow),
    ...outlined(17, LEG_TOP + lift + dy, 4, 12, k.skin.base, k.skin.shadow),
    rect(12, 46 - lift + dy, 4, 1, CREAM_SHADOW),
    rect(17, 46 + lift + dy, 4, 1, CREAM_SHADOW),
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
    ...outlined(8, lY, 3, 9, k.skin.base, k.skin.shadow),
    ...outlined(21, rY, 3, 9, k.skin.base, k.skin.shadow),
    ...outlined(8, lY + 9, 3, 3, k.skin.light, k.skin.shadow),
    ...outlined(21, rY + 9, 3, 3, k.skin.light, k.skin.shadow),
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
  const x = facing === 'left' ? 9 : 20;
  const y = 24 + swing + dy;
  return [
    ...outlined(x, y, 3, 9, k.skin.base, k.skin.shadow),
    ...outlined(x, y + 9, 3, 3, k.skin.light, k.skin.shadow),
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
  // The trailing leg stays anchored at the hip. An earlier version offset it by lift/2,
  // which at lift 4 opened a 3px gap between hip and thigh — a leg floating in space.
  return [
    ...outlined(10, LEG_TOP - lift, 5, 11 + lift, k.skin.base, k.skin.shadow),
    ...outlined(18, LEG_TOP, 5, 12, k.skin.shadow, k.skin.shadow),
    rect(10, 45, 5, 1, CREAM_SHADOW),
    ...armsProfile(k, 'right', swing, -lean),
    ...torsoProfile(k, -lean),
    ...tunicProfile(k, -lean),
    ...headProfile(k, 'right', -lean),
    ...faceProfile(k, 'right', -lean),
    ...hairCap(k, -lean, 'right'),
  ];
}

/** Horizontal on the bed — nothing else in the bill is wider than it is tall. */
function sleep(k: Kit, i: number): Shape[] {
  const breathe = i;
  return [
    ...outlined(2, 26 + breathe, 26, 9, k.outfit.base, k.outfit.shadow), // body under the duvet
    ...outlined(21, 20, 10, 10, k.skin.base, k.skin.shadow), // head on the pillow
    rect(24, 25, 3, 1, INK), // closed eye
    ...hairCapLying(k),
    ...outlined(2, 30 + breathe, 8, 5, k.skin.base, k.skin.shadow), // feet poking out
  ];
}

function hairCapLying(k: Kit): Shape[] {
  return [
    rect(22, 18, 9, 3, k.hair.base),
    rect(22, 18, 9, 1, k.hair.shadow),
    rect(29, 21, 2, 6, k.hair.base),
  ];
}

/** Seated: the A0 deferral. Thigh runs forward, shin drops — an L, not a squat block. */
function sit(k: Kit, i: number): Shape[] {
  const drop = 6 + i;
  return [
    ...outlined(11, LEG_TOP + drop - 4, 13, 5, k.skin.base, k.skin.shadow), // thigh forward
    ...outlined(19, LEG_TOP + drop, 5, 8, k.skin.base, k.skin.shadow), // shin down
    rect(19, LEG_TOP + drop + 8, 5, 1, CREAM_SHADOW),
    ...outlined(8, 24 + drop, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(8, 32 + drop, 3, 3, k.skin.light, k.skin.shadow),
    ...torso(k, drop),
    ...tunic(k, true, drop),
    ...headFront(k, drop),
    ...faceFront(k, drop),
    ...hairCap(k, drop),
  ];
}

/** Slumped on the couch — lower and more folded than `sit`, with closed eyes. */
function nap(k: Kit, i: number): Shape[] {
  const drop = 9 + i;
  return [
    ...outlined(10, LEG_TOP + drop - 5, 15, 5, k.skin.base, k.skin.shadow),
    ...outlined(8, 24 + drop, 3, 7, k.skin.base, k.skin.shadow),
    ...outlined(21, 24 + drop, 3, 7, k.skin.base, k.skin.shadow),
    ...outlined(11, TORSO_TOP + drop, 10, TORSO_H - 3, k.outfit.base, k.outfit.shadow),
    ...outlined(9, HEAD_TOP + drop + 2, 14, HEAD_H - 2, k.skin.base, k.skin.shadow),
    ...faceClosed(k, drop + 1),
    ...hairCap(k, drop + 2),
  ];
}

/** One hand up at the mouth. The raised forearm is the whole silhouette cue. */
function eat(k: Kit, i: number): Shape[] {
  const drop = 6;
  const reach = i === 0 ? 0 : 5;
  return [
    ...outlined(11, LEG_TOP + drop - 4, 13, 5, k.skin.base, k.skin.shadow),
    ...outlined(19, LEG_TOP + drop, 5, 8, k.skin.base, k.skin.shadow),
    ...outlined(8, 24 + drop, 3, 8, k.skin.base, k.skin.shadow),
    ...torso(k, drop),
    ...tunic(k, true, drop),
    ...outlined(21, 24 + drop - reach, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(20, 21 + drop - reach, 4, 4, k.skin.light, k.skin.shadow),
    ...headFront(k, drop),
    ...faceFront(k, drop),
    ...hairCap(k, drop),
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
    ...faceFront(k),
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
    ...outlined(9, HEAD_TOP + bend + 4, 14, HEAD_H - 3, k.skin.base, k.skin.shadow),
    ...faceClosed(k, bend + 3),
    ...hairCap(k, bend + 4),
  ];
}

/** Seated low with knees up — reads shorter than every other seated pose. */
function toilet(k: Kit): Shape[] {
  const drop = 10;
  return [
    ...outlined(11, LEG_TOP + drop - 6, 12, 5, k.skin.base, k.skin.shadow),
    ...outlined(19, LEG_TOP + drop - 1, 4, 6, k.skin.base, k.skin.shadow),
    ...outlined(9, 24 + drop, 3, 6, k.skin.base, k.skin.shadow),
    ...outlined(20, 24 + drop, 3, 6, k.skin.base, k.skin.shadow),
    ...outlined(11, TORSO_TOP + drop, 10, TORSO_H - 4, k.outfit.base, k.outfit.shadow),
    ...outlined(9, HEAD_TOP + drop, 14, HEAD_H - 2, k.skin.base, k.skin.shadow),
    ...faceFront(k, drop - 1),
    ...hairCap(k, drop),
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
    ...faceFront(k),
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
      ...faceFront(k),
      ...hairCap(k),
    ];
  }
  const fold = 8;
  return [
    ...legs(k, 0),
    ...outlined(10, TORSO_TOP + fold, 12, TORSO_H - 5, k.outfit.base, k.outfit.shadow),
    ...outlined(7, 30 + fold, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(22, 30 + fold, 3, 8, k.skin.base, k.skin.shadow),
    ...outlined(9, HEAD_TOP + fold + 8, 13, HEAD_H - 5, k.skin.base, k.skin.shadow),
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
    ...faceFront(k),
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
    ...shiftX([...arms(k, 0), ...torso(k), ...tunic(k, true), ...headFront(k), ...faceFront(k), ...hairCap(k)], -lean),
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
    ...outlined(11, HEAD_TOP + 2, 14, HEAD_H, k.skin.base, k.skin.shadow),
    rect(14, 15, 2, 3, INK),
    rect(20, 15, 2, 3, INK),
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
    ...outlined(9, HEAD_TOP - 2, 14, HEAD_H, k.skin.base, k.skin.shadow), // head thrown back
    rect(12, 12, 2, 2, INK),
    rect(18, 12, 2, 2, INK),
    rect(14, 17, 4, 2, INK), // open mouth
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
    ...outlined(9, HEAD_TOP + sag + 2, 14, HEAD_H - 1, k.skin.base, k.skin.shadow),
    ...faceClosed(k, sag + 2),
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
