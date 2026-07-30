/**
 * Desktop scaling baseline (SPEC §11.5, P3 T8).
 *
 * §11.5's rule, in order:
 *  1. Reserve UI first — the world gets what is left, not the whole viewport.
 *  2. Pick the largest `S` where `S × devicePixelRatio` is an integer and the scene
 *     fits. On a 2× retina display that legalises half-steps: 1.5× is exactly 3
 *     physical pixels per art pixel, which is what makes a MacBook Air 13 work.
 *  3. A 1×-DPR laptop (1366×768) has no half-steps available, so it runs 1×.
 *
 * Phones and fractional downscaling are explicitly **v1.1** (SPEC §11.5, master §9);
 * this module solves the desktop case and says so when nothing fits.
 *
 * Pure — no RN, no window. The caller supplies the viewport.
 */

/** SPEC §10: 24×14 tiles at 32 px. */
export const WORLD_W = 768;
export const WORLD_H = 448;

/**
 * SPEC §11.5: reserve UI first. **These numbers now match the SPEC** — §11.5 was updated
 * to 148 px [CONFIRMED by Joe, 2026-07-30], so this is no longer a deviation.
 *
 * Why 148 and not the ~48 §11.5 originally sketched: the §11.1 Health block is seven
 * rows (label · Health bar · four sub-bars · Practice counter). Reserving 48 let the
 * renderer believe it had 100 px it did not have, so the room was drawn *underneath*
 * the HUD, hiding the top of the bedroom and the starting character — while `tooSmall`
 * still reported false (P3 adversarial pass 4).
 *
 * If P4's layout work changes the HUD's real height, change it here AND in §11.5. One
 * number, two places, and they must never disagree again.
 */
export const HUD_H = 148;
export const QUEUE_H = 72;

export interface Viewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface ScaleSolution {
  /** Logical CSS scale applied to the 768×448 world. */
  scale: number;
  /** Physical pixels per art pixel — an integer whenever `exact` is true. */
  physicalPerArtPixel: number;
  /** True when `scale × dpr` is a whole number, i.e. no resampling of the pixel grid. */
  exact: boolean;
  /** Rendered world size in CSS pixels. */
  width: number;
  height: number;
  /** Space left for the world after the HUD and queue reservations. */
  available: { width: number; height: number };
  /**
   * Set when even 1× does not fit the reserved area. The world is still drawn at the
   * returned scale (clipped by the caller) rather than throwing — a cramped window
   * should degrade, not crash. Fractional downscaling is v1.1.
   */
  tooSmall: boolean;
}

/**
 * The search runs over **integer physical-pixels-per-art-pixel** (`k`), not over
 * fractional scales. `scale = k / dpr`, so exactness is structural: `k` is an integer
 * by construction and no float comparison decides it.
 *
 * The first version iterated fractional scales by subtracting `1/dpr`, which
 * accumulated error — at DPR 3 it produced 5.666667, whose product with 3 is
 * 17.000000000000004, so a perfectly valid step was reported as inexact. Choosing the
 * integer as the loop variable removes the question rather than tightening an epsilon.
 */
const MAX_PHYSICAL_PER_ART_PIXEL = 18; // 6× at DPR 3 — beyond any plausible desktop

export function solveScale(vp: Viewport): ScaleSolution {
  const dpr = Number.isFinite(vp.devicePixelRatio) && vp.devicePixelRatio > 0 ? vp.devicePixelRatio : 1;
  const available = {
    width: Math.max(0, vp.width),
    height: Math.max(0, vp.height - HUD_H - QUEUE_H),
  };

  // The desktop path never renders BELOW 1:1. Adversarial pass 1 found that a narrow
  // window at DPR 2 chose k=1 → scale 0.5, silently drawing a half-size world and
  // reporting `tooSmall: false`. Sub-native rendering is exactly the sharp-bilinear
  // downscale SPEC §11.5 assigns to the v1.1 phone pass; here it must report that it
  // does not fit and let the caller clip.
  let chosen: number | null = null;
  for (let k = MAX_PHYSICAL_PER_ART_PIXEL; k >= 1; k--) {
    const s = k / dpr;
    if (s < 1) continue;
    if (WORLD_W * s <= available.width && WORLD_H * s <= available.height) {
      chosen = k;
      break;
    }
  }

  const scale = chosen === null ? 1 : chosen / dpr;
  const k = chosen ?? dpr;
  return {
    scale,
    physicalPerArtPixel: k,
    exact: Number.isInteger(k),
    width: WORLD_W * scale,
    height: WORLD_H * scale,
    available,
    tooSmall: chosen === null,
  };
}
