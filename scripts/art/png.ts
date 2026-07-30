import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Minimal deterministic PNG writer (RGBA8, no interlace, filter 0).
 *
 * Deliberately dependency-free: the art pipeline runs in CI (design.md §12 step 4),
 * and a pixel-art validator that pulls an image library is a supply-chain surface
 * for no benefit — we only ever need "write exactly these bytes" and "read them back".
 * zlib is in Node's stdlib, so the whole encoder is ~60 lines and byte-reproducible.
 */

export interface Bitmap {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

export function createBitmap(width: number, height: number): Bitmap {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(v: number): Uint8Array {
  return new Uint8Array([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)));
  const payload = new Uint8Array(typeBytes.length + body.length);
  payload.set(typeBytes, 0);
  payload.set(body, typeBytes.length);
  const out = new Uint8Array(4 + payload.length + 4);
  out.set(u32(body.length), 0);
  out.set(payload, 4);
  out.set(u32(crc32(payload)), 4 + payload.length);
  return out;
}

export function encodePng(bmp: Bitmap): Uint8Array {
  const { width, height, data } = bmp;
  // One filter byte (0 = None) per scanline. Filtering would only shrink the file;
  // pixel art of this size is already tiny and None keeps the bytes inspectable.
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }
  const ihdr = new Uint8Array(13);
  ihdr.set(u32(width), 0);
  ihdr.set(u32(height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * design.md §2: "Author all art as indexed PNG against this palette."
 *
 * P3 shipped RGBA colour-type 6 and recorded the gap as P6's (evidence/P3.md). This writes
 * colour-type 3 with PLTE + tRNS. Palette order is first-seen over a row-major scan, so the
 * output stays byte-reproducible and `art:check`'s `git diff --exit-code` keeps its meaning.
 *
 * Every fully transparent pixel collapses onto one entry. design.md §13 forbids
 * anti-aliasing, so partial alpha cannot legitimately occur — and `findPaletteViolations`
 * rejects it if it ever does.
 */
export function encodeIndexedPng(bmp: Bitmap): Uint8Array {
  const order: number[] = [];
  const indexOf = new Map<number, number>();
  const pixels = new Uint8Array(bmp.width * bmp.height);
  for (let i = 0; i < bmp.width * bmp.height; i++) {
    const a = bmp.data[i * 4 + 3]!;
    const key = a === 0 ? -1 : (bmp.data[i * 4]! << 16) | (bmp.data[i * 4 + 1]! << 8) | bmp.data[i * 4 + 2]!;
    let idx = indexOf.get(key);
    if (idx === undefined) {
      idx = order.length;
      if (idx > 255) throw new Error('indexed PNG needs <= 256 distinct colours, found more');
      indexOf.set(key, idx);
      order.push(key);
    }
    pixels[i] = idx;
  }

  const plte = new Uint8Array(order.length * 3);
  const trns = new Uint8Array(order.length);
  order.forEach((key, i) => {
    if (key === -1) {
      trns[i] = 0;
      return;
    }
    plte[i * 3] = (key >> 16) & 0xff;
    plte[i * 3 + 1] = (key >> 8) & 0xff;
    plte[i * 3 + 2] = key & 0xff;
    trns[i] = 255;
  });

  const stride = bmp.width;
  const raw = new Uint8Array((stride + 1) * bmp.height);
  for (let y = 0; y < bmp.height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None)
    raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const ihdr = new Uint8Array(13);
  ihdr.set(u32(bmp.width), 0);
  ihdr.set(u32(bmp.height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // colour type: indexed
  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('tRNS', trns),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * Reads back colour-type 3 and colour-type 6, so a test can prove a round-trip.
 *
 * Deliberately narrow: bit depth 8, no interlace, filter type 0 — exactly what this
 * module writes. A decoder that silently accepts more than it can prove is worse than one
 * that throws, so anything else is an error rather than a best effort.
 */
export function decodePng(bytes: Uint8Array): Bitmap {
  let pos = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let colourType = 0;
  let palette: Uint8Array | null = null;
  let alpha: Uint8Array | null = null;
  const idat: Uint8Array[] = [];

  while (pos + 8 <= bytes.length) {
    const len = (bytes[pos]! << 24) | (bytes[pos + 1]! << 16) | (bytes[pos + 2]! << 8) | bytes[pos + 3]!;
    const type = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!);
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = (body[0]! << 24) | (body[1]! << 16) | (body[2]! << 8) | body[3]!;
      height = (body[4]! << 24) | (body[5]! << 16) | (body[6]! << 8) | body[7]!;
      if (body[8] !== 8) throw new Error(`decodePng supports bit depth 8, got ${body[8]}`);
      if (body[12] !== 0) throw new Error('decodePng does not support interlacing');
      colourType = body[9]!;
      if (colourType !== 3 && colourType !== 6) {
        throw new Error(`decodePng supports colour types 3 and 6, got ${colourType}`);
      }
    } else if (type === 'PLTE') palette = body.slice();
    else if (type === 'tRNS') alpha = body.slice();
    else if (type === 'IDAT') idat.push(body.slice());
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  const raw = new Uint8Array(inflateSync(concat(idat)));
  const bpp = colourType === 3 ? 1 : 4;
  const stride = width * bpp;
  const out = createBitmap(width, height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    if (filter !== 0) throw new Error(`decodePng supports filter 0, got ${filter} on row ${y}`);
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colourType === 3) {
        const i = row[x]!;
        const opaque = alpha === null ? 255 : (alpha[i] ?? 255);
        if (opaque === 0) continue; // createBitmap already zeroed it
        out.data[o] = palette![i * 3]!;
        out.data[o + 1] = palette![i * 3 + 1]!;
        out.data[o + 2] = palette![i * 3 + 2]!;
        out.data[o + 3] = opaque;
      } else {
        out.data.set(row.subarray(x * 4, x * 4 + 4), o);
      }
    }
  }
  return out;
}

/** Nearest-neighbour integer upscale — the only legal magnification for pixel art (design.md §5). */
export function scaleNearest(bmp: Bitmap, factor: number): Bitmap {
  if (!Number.isInteger(factor) || factor < 1) throw new Error(`scale factor must be a positive integer, got ${factor}`);
  const out = createBitmap(bmp.width * factor, bmp.height * factor);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const src = (Math.floor(y / factor) * bmp.width + Math.floor(x / factor)) * 4;
      const dst = (y * out.width + x) * 4;
      out.data.set(bmp.data.subarray(src, src + 4), dst);
    }
  }
  return out;
}

/** Copy `src` onto `dst` at (dx, dy), respecting alpha as a hard mask (no blending — design.md §13). */
export function blit(dst: Bitmap, src: Bitmap, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      if (src.data[s + 3] === 0) continue;
      dst.data.set(src.data.subarray(s, s + 4), (ty * dst.width + tx) * 4);
    }
  }
}
