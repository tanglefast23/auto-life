import {
  DUSK_PLUM,
  GREY,
  hexToRgb,
  INK,
  IZAKAYA_RED,
  LANTERN_GOLD,
  LEAF_GREEN,
  PALETTE_SET,
  rgbToHex,
  ROSE,
  TERRACOTTA,
  WATER_BLUE,
  WOOD,
} from '../../src/render/palette';
import type { Bitmap } from './png';

/**
 * design.md §12 step 4, as code: "every pixel ∈ §2".
 *
 * This is the art-side twin of `scripts/validate-content.ts` — the same posture the
 * project already takes for balance data. A palette violation is mechanically
 * detectable, so it is never a review opinion.
 */

export interface PaletteViolation {
  x: number;
  y: number;
  hex: string;
  count: number;
}

/** Every opaque pixel must be a sanctioned palette colour. Alpha is all-or-nothing (§13 forbids AA). */
export function findPaletteViolations(bmp: Bitmap): PaletteViolation[] {
  const byHex = new Map<string, PaletteViolation>();
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      const i = (y * bmp.width + x) * 4;
      const a = bmp.data[i + 3]!;
      if (a === 0) continue;
      const r = bmp.data[i]!;
      const g = bmp.data[i + 1]!;
      const b = bmp.data[i + 2]!;
      const key = (r << 16) | (g << 8) | b;
      const partial = a !== 255;
      if (!partial && PALETTE_SET.has(key)) continue;
      const hex = partial ? `${rgbToHex({ r, g, b })} (alpha ${a})` : rgbToHex({ r, g, b });
      const seen = byHex.get(hex);
      if (seen) seen.count += 1;
      else byHex.set(hex, { x, y, hex, count: 1 });
    }
  }
  return [...byHex.values()];
}

/** design.md §13: pure black and pure white are rejected anywhere, palette member or not. */
export function findForbiddenExtremes(bmp: Bitmap): PaletteViolation[] {
  const out: PaletteViolation[] = [];
  const check = (r: number, g: number, b: number) => (r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255);
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      const i = (y * bmp.width + x) * 4;
      if (bmp.data[i + 3] === 0) continue;
      const r = bmp.data[i]!;
      const g = bmp.data[i + 1]!;
      const b = bmp.data[i + 2]!;
      if (check(r, g, b)) out.push({ x, y, hex: rgbToHex({ r, g, b }), count: 1 });
    }
  }
  return out;
}

/**
 * Every legal outline colour for a **world** sprite: each §2 world/meaning ramp's shadow.
 *
 * Enumerated from the ramp constants, never derived by index arithmetic over `PALETTE_57`.
 * That array is not a clean run of triples — `HAIR_BLACK` contributes only two entries
 * because its shadow *is* Ink and is already listed among the neutrals — so any "every
 * third element" trick misaligns from there on and starts admitting base colours as legal
 * outlines. Enumerate; do not count.
 */
const OUTLINE_RAMPS = [
  WOOD, GREY, DUSK_PLUM, LEAF_GREEN, WATER_BLUE, TERRACOTTA,
  LANTERN_GOLD, IZAKAYA_RED, ROSE,
] as const;

const RAMP_SHADOWS: ReadonlySet<number> = new Set(
  OUTLINE_RAMPS.map((ramp) => {
    const { r, g, b } = hexToRgb(ramp.shadow);
    return (r << 16) | (g << 8) | b;
  }),
);

const INK_KEY = (() => {
  const { r, g, b } = hexToRgb(INK);
  return (r << 16) | (g << 8) | b;
})();

function keyAt(bmp: Bitmap, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= bmp.width || y >= bmp.height) return null;
  const i = (y * bmp.width + x) * 4;
  if (bmp.data[i + 3] === 0) return null;
  return (bmp.data[i]! << 16) | (bmp.data[i + 1]! << 8) | bmp.data[i + 2]!;
}

/** Which design.md §3 track an asset belongs to. World outlines and UI outlines invert. */
export type Track = 'world' | 'character' | 'ui';

/**
 * design.md §3 Track B, as code: a **world** sprite's outline is its fill ramp's shadow,
 * never Ink.
 *
 * An outline pixel is any opaque pixel with a transparent or out-of-bounds 4-neighbour.
 * `build-atlas.ts` has carried a comment since P3 saying an adversarial pass caught
 * wall/tv/bench outlined in Ink *while the colour validator reported green* — because it
 * checks colours, not roles. This is that comment turned into a check.
 *
 * Two exemptions, both from design.md rather than convenience:
 *
 *  - Ink is legal *inside* a world sprite (A0's eyes are Ink). Only the outline is ruled.
 *  - **Character sprites are exempt entirely.** §2 defines `HAIR_BLACK`'s shadow as Ink,
 *    so a black-haired sim is *correctly* Ink-outlined, and no pixel-level rule can tell
 *    that layer from a chair leg. Characters are covered instead by the palette audit and
 *    the silhouette/layer tests. UI chrome is exempt for the opposite reason: Track A
 *    outlines in Ink by rule.
 */
export function findOutlineRoleViolations(bmp: Bitmap): PaletteViolation[] {
  const byHex = new Map<string, PaletteViolation>();
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      const key = keyAt(bmp, x, y);
      if (key === null) continue;
      const exposed =
        keyAt(bmp, x - 1, y) === null ||
        keyAt(bmp, x + 1, y) === null ||
        keyAt(bmp, x, y - 1) === null ||
        keyAt(bmp, x, y + 1) === null;
      if (!exposed) continue;
      if (key !== INK_KEY) continue; // non-shadow, non-Ink outlines are §2's problem, not §3's
      if (RAMP_SHADOWS.has(key)) continue;
      const hex = rgbToHex({ r: (key >> 16) & 0xff, g: (key >> 8) & 0xff, b: key & 0xff });
      const seen = byHex.get(hex);
      if (seen) seen.count += 1;
      else byHex.set(hex, { x, y, hex, count: 1 });
    }
  }
  return [...byHex.values()];
}

/**
 * Fraction of the sprite's bounding box that is opaque.
 *
 * A plain filled rectangle scores exactly 1.0. This is the mechanical form of the report
 * that opened P6 — "I just see a square and I don't know what that object is" — and of
 * design.md §6's silhouette-first rule. An object must carry shape, not only colour.
 */
export function boxiness(bmp: Bitmap): number {
  let minX = bmp.width;
  let minY = bmp.height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.data[(y * bmp.width + x) * 4 + 3] === 0) continue;
      opaque++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return 0;
  return opaque / ((maxX - minX + 1) * (maxY - minY + 1));
}

/**
 * A colour-independent silhouette fingerprint: per row, the alternating run lengths.
 *
 * Two sprites sharing a signature are the same shape in flat Ink, which design.md §6 says
 * must never happen between distinct things. Colour is ignored deliberately — that is the
 * entire point of the silhouette test.
 */
export function silhouetteSignature(bmp: Bitmap): string {
  const rows: string[] = [];
  for (let y = 0; y < bmp.height; y++) {
    const runs: number[] = [];
    let run = 0;
    let opaque = false;
    for (let x = 0; x < bmp.width; x++) {
      const here = bmp.data[(y * bmp.width + x) * 4 + 3] !== 0;
      if (here === opaque) run++;
      else {
        runs.push(run);
        opaque = here;
        run = 1;
      }
    }
    runs.push(run);
    rows.push(runs.join('.'));
  }
  return rows.join('|');
}

/**
 * Sizes of every 4-connected opaque region, largest first.
 *
 * A0 handed forward "slim mitten hands read slightly detached at 1×". Detached means a
 * small island with no route back to the body, so the check is structural rather than a
 * screenshot opinion — and unlike a screenshot it cannot quietly stop being looked at.
 */
export function opaqueIslands(bmp: Bitmap): number[] {
  const total = bmp.width * bmp.height;
  const seen = new Uint8Array(total);
  const opaque = (i: number) => bmp.data[i * 4 + 3] !== 0;
  const sizes: number[] = [];
  for (let start = 0; start < total; start++) {
    if (seen[start] === 1 || !opaque(start)) continue;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const x = i % bmp.width;
      const y = (i - x) / bmp.width;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < bmp.width - 1 ? i + 1 : -1,
        y > 0 ? i - bmp.width : -1,
        y < bmp.height - 1 ? i + bmp.width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || seen[n] === 1 || !opaque(n)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

/** Mean luminance over opaque pixels — used to prove evening is genuinely dimmer than day. */
export function meanLuminance(bmp: Bitmap): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < bmp.width * bmp.height; i++) {
    if (bmp.data[i * 4 + 3] === 0) continue;
    sum += 0.2126 * bmp.data[i * 4]! + 0.7152 * bmp.data[i * 4 + 1]! + 0.0722 * bmp.data[i * 4 + 2]!;
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

export interface AssetReport {
  name: string;
  track: Track;
  paletteViolations: PaletteViolation[];
  forbiddenExtremes: PaletteViolation[];
  outlineRoleViolations: PaletteViolation[];
  opaquePixels: number;
  distinctColours: number;
}

export function auditBitmap(name: string, bmp: Bitmap, track: Track = 'world'): AssetReport {
  const colours = new Set<number>();
  let opaque = 0;
  for (let i = 0; i < bmp.width * bmp.height; i++) {
    if (bmp.data[i * 4 + 3] === 0) continue;
    opaque++;
    colours.add((bmp.data[i * 4]! << 16) | (bmp.data[i * 4 + 1]! << 8) | bmp.data[i * 4 + 2]!);
  }
  return {
    name,
    track,
    paletteViolations: findPaletteViolations(bmp),
    forbiddenExtremes: findForbiddenExtremes(bmp),
    // Only Track B world art is ruled; see `findOutlineRoleViolations` for why.
    outlineRoleViolations: track === 'world' ? findOutlineRoleViolations(bmp) : [],
    opaquePixels: opaque,
    distinctColours: colours.size,
  };
}

export function reportIsClean(r: AssetReport): boolean {
  return (
    r.paletteViolations.length === 0 &&
    r.forbiddenExtremes.length === 0 &&
    r.outlineRoleViolations.length === 0 &&
    r.opaquePixels > 0
  );
}

export function formatReport(r: AssetReport): string {
  const bits = [`${r.name} [${r.track}]: ${r.opaquePixels}px, ${r.distinctColours} colours`];
  for (const v of r.paletteViolations) bits.push(`  OFF-PALETTE ${v.hex} ×${v.count} (first at ${v.x},${v.y})`);
  for (const v of r.forbiddenExtremes) bits.push(`  FORBIDDEN ${v.hex} at ${v.x},${v.y}`);
  for (const v of r.outlineRoleViolations) {
    bits.push(`  INK OUTLINE on world art ${v.hex} ×${v.count} (first at ${v.x},${v.y}) — design.md §3 Track B`);
  }
  if (r.opaquePixels === 0) bits.push('  EMPTY sprite');
  return bits.join('\n');
}
