/**
 * design.md §2 master palette, transcribed verbatim (core 31 + character-only 26 = 57).
 * This module is the single in-code source for palette membership; the A0 verifier
 * rejects any rasterized pixel outside PALETTE_57 (plus full transparency).
 * No RN/Expo imports — shared by the app, build scripts, and headless verification.
 */

/** Neutrals (4) — the HFM canvas, ink, white and soft structure grey. */
export const INK = '#241f2e';
export const CREAM_LIGHT = '#ffffff';
export const CREAM_BASE = '#f4f1ea';
export const CREAM_SHADOW = '#d9d5cf';

/** World ramps (6 × shadow/base/light = 18). */
export const WOOD = { shadow: '#6a4326', base: '#8a5a30', light: '#a9743d' } as const;
export const GREY = { shadow: '#6b6675', base: '#9a95a4', light: '#c9c5d0' } as const;
export const DUSK_PLUM = { shadow: '#4a3550', base: '#6b4f74', light: '#9678a0' } as const;
export const LEAF_GREEN = { shadow: '#3f8a4a', base: '#5cb85c', light: '#8fd98f' } as const;
export const WATER_BLUE = { shadow: '#3f6fb5', base: '#5a8fd6', light: '#a3c8f0' } as const;
export const TERRACOTTA = { shadow: '#8a4a2e', base: '#bc6b42', light: '#e09a6e' } as const;

/** Meaning ramps (3 × 3 = 9) — reserved semantics; unused by A0 sprites. */
export const LANTERN_GOLD = { shadow: '#c8862a', base: '#edb54a', light: '#f7d894' } as const;
export const IZAKAYA_RED = { shadow: '#a83440', base: '#d94f52', light: '#f2938c' } as const;
export const ROSE = { shadow: '#a34a5e', base: '#d4708a', light: '#f0a8bc' } as const;

/** Character-only: six skin ramps (18). A0 uses SKIN_2. */
export const SKIN_RAMPS = [
  { shadow: '#cf9268', base: '#eab48c', light: '#f7d7ba' },
  { shadow: '#c08058', base: '#e0a276', light: '#f2c79e' },
  { shadow: '#a06844', base: '#c08a5c', light: '#e0b184' },
  { shadow: '#7c4c34', base: '#9c6a48', light: '#c08a62' },
  { shadow: '#6b4030', base: '#8a5a42', light: '#a87858' },
  { shadow: '#4c2e22', base: '#664234', light: '#845844' },
] as const;

/** Character-only: the 8 net-new hair hexes (other hair sets reuse ramps above). */
// F82's near-black HFM hair ramp, with shared Ink as its darkest step to preserve the
// locked 57-colour budget.
export const HAIR_BLACK = { shadow: INK, base: '#3d2a22', light: '#534537' } as const;
export const HAIR_AUBURN = { shadow: '#8a3c28', base: '#b85a38', light: '#d98a5e' } as const;
export const HAIR_BLONDE = { shadow: '#b08a3a', base: '#d9b05c', light: '#f0d494' } as const;

const ramps = [
  WOOD, GREY, DUSK_PLUM, LEAF_GREEN, WATER_BLUE, TERRACOTTA,
  LANTERN_GOLD, IZAKAYA_RED, ROSE,
];
const rampHexes = (r: { shadow: string; base: string; light: string }) => [r.shadow, r.base, r.light];

/** All 57 sanctioned hexes (31 core + 26 character-only), lowercase. */
export const PALETTE_57: readonly string[] = [
  INK, CREAM_LIGHT, CREAM_BASE, CREAM_SHADOW,
  ...ramps.flatMap(rampHexes),
  ...SKIN_RAMPS.flatMap(rampHexes),
  ...rampHexes(HAIR_BLACK).slice(1), // shadow is Ink, already listed
  ...rampHexes(HAIR_AUBURN),
  ...rampHexes(HAIR_BLONDE),
];

export interface Rgb { r: number; g: number; b: number }

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/.exec(hex.toLowerCase());
  if (!m || m[1] === undefined) throw new Error(`bad hex color: ${hex}`);
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Fast membership set keyed by 0xRRGGBB. */
export const PALETTE_SET: ReadonlySet<number> = new Set(
  PALETTE_57.map((h) => {
    const { r, g, b } = hexToRgb(h);
    return (r << 16) | (g << 8) | b;
  }),
);
