import { createBitmap, decodePng, encodeIndexedPng, encodePng, type Bitmap } from '../art/png';
import {
  boxiness,
  findOutlineRoleViolations,
  meanLuminance,
  opaqueIslands,
  silhouetteSignature,
} from '../art/validate-palette';
import { hexToRgb, INK, WOOD } from '../../src/render/palette';

/**
 * P6 T1 — the gates every later asset task depends on.
 *
 * Before P6 the validator checked colour *membership* only, which is why
 * `build-atlas.ts` carries a comment recording that an adversarial pass caught
 * Ink-outlined world art while the validator still reported green. These are the
 * mechanical rules that close that hole and the "it's still a square" hole beside it.
 */

function fill(bmp: Bitmap, x: number, y: number, w: number, h: number, hex: string): void {
  const { r, g, b } = hexToRgb(hex);
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const i = (py * bmp.width + px) * 4;
      bmp.data[i] = r;
      bmp.data[i + 1] = g;
      bmp.data[i + 2] = b;
      bmp.data[i + 3] = 255;
    }
  }
}

/**
 * Clears to fully transparent — all four bytes, not just alpha.
 *
 * This mirrors what the rasterizer's `TRANSPARENT` sentinel must do. Zeroing only alpha
 * leaves a colour nobody can see but the indexed encoder still has to file somewhere, and
 * the round-trip then compares that residue against the decoder's honest 0,0,0,0. The
 * first version of this helper did exactly that and the round-trip test caught it.
 */
function clear(bmp: Bitmap, x: number, y: number, w: number, h: number): void {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) bmp.data.fill(0, (py * bmp.width + px) * 4, (py * bmp.width + px) * 4 + 4);
  }
}

/** A world sprite outlined in Ink — legal by colour, illegal by design.md §3 Track B. */
function inkOutlinedBox(): Bitmap {
  const bmp = createBitmap(8, 8);
  fill(bmp, 0, 0, 8, 8, INK);
  fill(bmp, 1, 1, 6, 6, WOOD.base);
  return bmp;
}

function rampOutlinedBox(): Bitmap {
  const bmp = createBitmap(8, 8);
  fill(bmp, 0, 0, 8, 8, WOOD.shadow);
  fill(bmp, 1, 1, 6, 6, WOOD.base);
  return bmp;
}

describe('design.md §3 Track B — outline roles', () => {
  it('rejects a world sprite whose outline is Ink', () => {
    const violations = findOutlineRoleViolations(inkOutlinedBox());
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.hex).toBe(INK);
  });

  it('accepts a world sprite outlined in its own ramp shadow', () => {
    expect(findOutlineRoleViolations(rampOutlinedBox())).toEqual([]);
  });

  it('allows Ink inside a sprite — only the outline is ruled', () => {
    // A0's eyes are Ink and must stay legal.
    const bmp = rampOutlinedBox();
    fill(bmp, 3, 3, 2, 2, INK);
    expect(findOutlineRoleViolations(bmp)).toEqual([]);
  });

  it('treats a pixel exposed to transparency as an outline, not just the bitmap border', () => {
    const bmp = rampOutlinedBox();
    clear(bmp, 0, 0, 8, 3);
    fill(bmp, 2, 3, 4, 1, INK); // now the top edge of the remaining shape
    expect(findOutlineRoleViolations(bmp).length).toBeGreaterThan(0);
  });
});

describe('legibility gates', () => {
  it('scores a plain filled rectangle at exactly 1', () => {
    expect(boxiness(rampOutlinedBox())).toBeCloseTo(1, 5);
  });

  it('scores a notched shape below the 0.92 ceiling', () => {
    const bmp = rampOutlinedBox();
    clear(bmp, 5, 0, 3, 3);
    expect(boxiness(bmp)).toBeLessThan(0.92);
  });

  it('returns 0 for an empty bitmap rather than dividing by zero', () => {
    expect(boxiness(createBitmap(8, 8))).toBe(0);
  });

  it('gives two differently-shaped sprites different signatures', () => {
    const a = rampOutlinedBox();
    const b = rampOutlinedBox();
    b.data[3] = 0;
    expect(silhouetteSignature(a)).not.toBe(silhouetteSignature(b));
  });

  it('ignores colour when computing a signature — the silhouette test is colour-blind', () => {
    expect(silhouetteSignature(rampOutlinedBox())).toBe(silhouetteSignature(inkOutlinedBox()));
  });
});

describe('opaque islands (A0 detached-hand deferral)', () => {
  it('reports one island for a connected shape', () => {
    expect(opaqueIslands(rampOutlinedBox())).toEqual([64]);
  });

  it('reports a detached fragment separately, smallest last', () => {
    const bmp = createBitmap(8, 8);
    fill(bmp, 0, 0, 3, 3, WOOD.base);
    fill(bmp, 6, 6, 1, 1, WOOD.base);
    expect(opaqueIslands(bmp)).toEqual([9, 1]);
  });

  it('counts diagonal-only contact as detached — 4-connected, like the eye reads it', () => {
    const bmp = createBitmap(8, 8);
    fill(bmp, 1, 1, 2, 2, WOOD.base);
    fill(bmp, 3, 3, 2, 2, WOOD.base);
    expect(opaqueIslands(bmp)).toEqual([4, 4]);
  });
});

describe('mean luminance', () => {
  it('ranks a darker fill below a lighter one', () => {
    const dark = createBitmap(4, 4);
    fill(dark, 0, 0, 4, 4, WOOD.shadow);
    const light = createBitmap(4, 4);
    fill(light, 0, 0, 4, 4, WOOD.light);
    expect(meanLuminance(dark)).toBeLessThan(meanLuminance(light));
  });

  it('ignores transparent pixels instead of counting them as black', () => {
    const bmp = createBitmap(4, 4);
    fill(bmp, 0, 0, 2, 2, WOOD.light);
    const solid = createBitmap(2, 2);
    fill(solid, 0, 0, 2, 2, WOOD.light);
    expect(meanLuminance(bmp)).toBeCloseTo(meanLuminance(solid), 5);
  });
});

describe('indexed PNG (design.md §2)', () => {
  it('round-trips every pixel through colour-type 3', () => {
    const src = rampOutlinedBox();
    const decoded = decodePng(encodeIndexedPng(src));
    expect(decoded.width).toBe(src.width);
    expect(decoded.height).toBe(src.height);
    expect(Array.from(decoded.data)).toEqual(Array.from(src.data));
  });

  it('round-trips transparency without inventing a colour under it', () => {
    const src = rampOutlinedBox();
    clear(src, 0, 0, 4, 4);
    const decoded = decodePng(encodeIndexedPng(src));
    expect(Array.from(decoded.data)).toEqual(Array.from(src.data));
  });

  it('still round-trips the RGBA encoder, so both paths stay provable', () => {
    const src = rampOutlinedBox();
    expect(Array.from(decodePng(encodePng(src)).data)).toEqual(Array.from(src.data));
  });

  it('is byte-reproducible for identical input', () => {
    expect(Array.from(encodeIndexedPng(rampOutlinedBox())))
      .toEqual(Array.from(encodeIndexedPng(rampOutlinedBox())));
  });

  it('refuses a bitmap with more than 256 distinct colours', () => {
    const bmp = createBitmap(32, 32);
    for (let i = 0; i < 32 * 32; i++) {
      bmp.data[i * 4] = i & 0xff;
      bmp.data[i * 4 + 1] = (i >> 3) & 0xff;
      bmp.data[i * 4 + 2] = (i >> 6) & 0xff;
      bmp.data[i * 4 + 3] = 255;
    }
    expect(() => encodeIndexedPng(bmp)).toThrow(/256/);
  });

  it('writes a genuinely smaller file than RGBA for palette art', () => {
    const bmp = createBitmap(64, 64);
    fill(bmp, 0, 0, 64, 64, WOOD.base);
    fill(bmp, 8, 8, 48, 48, WOOD.light);
    expect(encodeIndexedPng(bmp).length).toBeLessThan(encodePng(bmp).length);
  });
});
