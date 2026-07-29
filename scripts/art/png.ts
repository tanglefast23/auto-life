import { deflateSync } from 'node:zlib';

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
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
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
