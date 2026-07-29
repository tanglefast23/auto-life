import { PALETTE_SET, rgbToHex } from '../../src/render/palette';
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

export interface AssetReport {
  name: string;
  paletteViolations: PaletteViolation[];
  forbiddenExtremes: PaletteViolation[];
  opaquePixels: number;
  distinctColours: number;
}

export function auditBitmap(name: string, bmp: Bitmap): AssetReport {
  const colours = new Set<number>();
  let opaque = 0;
  for (let i = 0; i < bmp.width * bmp.height; i++) {
    if (bmp.data[i * 4 + 3] === 0) continue;
    opaque++;
    colours.add((bmp.data[i * 4]! << 16) | (bmp.data[i * 4 + 1]! << 8) | bmp.data[i * 4 + 2]!);
  }
  return {
    name,
    paletteViolations: findPaletteViolations(bmp),
    forbiddenExtremes: findForbiddenExtremes(bmp),
    opaquePixels: opaque,
    distinctColours: colours.size,
  };
}

export function reportIsClean(r: AssetReport): boolean {
  return r.paletteViolations.length === 0 && r.forbiddenExtremes.length === 0 && r.opaquePixels > 0;
}

export function formatReport(r: AssetReport): string {
  const bits = [`${r.name}: ${r.opaquePixels}px, ${r.distinctColours} colours`];
  for (const v of r.paletteViolations) bits.push(`  OFF-PALETTE ${v.hex} ×${v.count} (first at ${v.x},${v.y})`);
  for (const v of r.forbiddenExtremes) bits.push(`  FORBIDDEN ${v.hex} at ${v.x},${v.y}`);
  if (r.opaquePixels === 0) bits.push('  EMPTY sprite');
  return bits.join('\n');
}
