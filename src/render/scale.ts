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

/** SPEC §11.5: reserve UI first. */
export const HUD_H = 48;
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

  let chosen: number | null = null;
  for (let k = MAX_PHYSICAL_PER_ART_PIXEL; k >= 1; k--) {
    const s = k / dpr;
    if (WORLD_W * s <= available.width && WORLD_H * s <= available.height) {
      chosen = k;
      break;
    }
  }

  const k = chosen ?? 1;
  const scale = k / dpr;
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
