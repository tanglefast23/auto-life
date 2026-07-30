import type { Shape } from '../sprite-spec';

/**
 * Shared shape primitives for every authored sprite (P6 T2).
 *
 * Extracted from `a0.ts` so the A0 spike, the object set, the tile set, decorations, and
 * icons all draw with one vocabulary instead of four copies. `a0.ts` still owns the A0
 * *frames* — this file owns only the grammar they are written in.
 *
 * design.md §12's pipeline step 1 is "author as SVG shapes on the palette". These are
 * those shapes, as code: rectangles and single pixels on the locked 57-colour palette,
 * with no gradients, no alpha blending, and no anti-aliasing anywhere.
 */

export const rect = (x: number, y: number, w: number, h: number, c: string): Shape =>
  ({ k: 'rect', x, y, w, h, c });

export const px = (x: number, y: number, c: string): Shape => ({ k: 'px', x, y, c });

/**
 * A filled box wearing its own ramp's shadow as a one-pixel outline.
 *
 * design.md §3 Track B: world outlines are the fill ramp's shadow, never Ink. The
 * `findOutlineRoleViolations` gate enforces that mechanically, so building it into the
 * primitive means the common case is correct by construction rather than by review.
 */
export function outlined(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  shadow: string,
): Shape[] {
  return [rect(x, y, w, h, shadow), rect(x + 1, y + 1, w - 2, h - 2, fill)];
}

/**
 * Knock a rectangular bite out of a silhouette.
 *
 * This is the workhorse of P6 T2. A flat `box()` scores `boxiness` 1.0 and reads as "a
 * square you cannot identify"; notches are what give an object legs, a gap under a rim, or
 * a neck. Painting transparency rather than a colour is the point — it changes the
 * *outline*, which is what has to survive the flat-Ink silhouette test.
 */
export function notch(x: number, y: number, w: number, h: number): Shape {
  return { k: 'rect', x, y, w, h, c: TRANSPARENT };
}

/** A one-pixel highlight along a shape's top edge — design.md §3's two-tone face. */
export function lip(x: number, y: number, w: number, light: string): Shape {
  return rect(x, y, w, 1, light);
}

/**
 * The sentinel colour meaning "clear these pixels to fully transparent".
 *
 * Handled explicitly in `paintShapes` before any hex parsing, because `hexToRgb` throws on
 * anything that is not `#rrggbb`. Clearing writes all four bytes, never alpha alone: a
 * pixel with residual RGB under zero alpha is invisible on screen but still has to be
 * filed by the indexed-PNG encoder, which makes the round-trip disagree with itself.
 */
export const TRANSPARENT = 'transparent';
