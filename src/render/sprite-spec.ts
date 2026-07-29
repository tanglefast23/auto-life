import { createBitmap, type Bitmap } from '../../scripts/art/png';
import { hexToRgb } from './palette';

/**
 * The design.md §6 character construction, as code.
 *
 * Sprites are authored as flat shapes on the locked palette (design.md §6's primary
 * "SVG-authored" route), composited in the layer order
 * `base body → face → hair → outfit → accessory`, with per-frame **anchor points**
 * every overlay keys to. That anchor rule is the whole v6 bet: hair and accessories
 * are authored ONCE and positioned per frame, so 10 hair styles cost 10 sprites
 * rather than 10 × 48 frames.
 *
 * Pure TypeScript — no RN/Skia/Expo. The validator and the A0 sheet builder run
 * headless in CI, and P3's Skia Atlas consumes the same rasterized output.
 */

export const SPRITE_W = 32;
export const SPRITE_H = 48;

export type Dir = 'down' | 'up' | 'left' | 'right';
export const DIRS: readonly Dir[] = ['down', 'up', 'left', 'right'];

export interface Pt {
  x: number;
  y: number;
}

export type Shape =
  | { k: 'rect'; x: number; y: number; w: number; h: number; c: string }
  | { k: 'px'; x: number; y: number; c: string };

/** Per-frame attachment points. Overlays position themselves against these, never against absolute pixels. */
export interface Anchors {
  /** Top-centre of the skull — hair and hats key here. */
  head: Pt;
  /** Wrist centres — held props (v2's guitar) key here. */
  handL: Pt;
  handR: Pt;
}

export interface BodyFrame {
  id: string;
  dir: Dir;
  /** Base body + face, in paint order. */
  shapes: Shape[];
  anchors: Anchors;
}

/** An overlay authored once, drawn relative to a named anchor. */
export interface AnchoredOverlay {
  id: string;
  anchor: keyof Anchors;
  /** Offset from the anchor to this overlay's top-left. */
  offset: Pt;
  shapes: Shape[];
}

/** Outfits are keyed to body frames (design.md §6), so they are authored per direction. */
export interface OutfitSet {
  id: string;
  perDir: Record<Dir, Shape[]>;
  /** Vertical bob applied per walk-frame index, so one authored set covers a whole loop. */
  frameBob: readonly number[];
}

export type BuildName = 'average' | 'slim';

// ---------------------------------------------------------------------------
// Rasterizer
// ---------------------------------------------------------------------------

function paint(bmp: Bitmap, shapes: readonly Shape[], dx = 0, dy = 0): void {
  for (const s of shapes) {
    const { r, g, b } = hexToRgb(s.c);
    const x0 = (s.k === 'rect' ? s.x : s.x) + dx;
    const y0 = (s.k === 'rect' ? s.y : s.y) + dy;
    const w = s.k === 'rect' ? s.w : 1;
    const h = s.k === 'rect' ? s.h : 1;
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= bmp.height) continue;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= bmp.width) continue;
        const i = (y * bmp.width + x) * 4;
        bmp.data[i] = r;
        bmp.data[i + 1] = g;
        bmp.data[i + 2] = b;
        bmp.data[i + 3] = 255;
      }
    }
  }
}

export interface CompositeRequest {
  frame: BodyFrame;
  /** Walk-loop index, used for the outfit bob. */
  frameIndex?: number;
  hair?: AnchoredOverlay;
  outfit?: OutfitSet;
}

/** Composite one frame in design.md §6's layer order. */
export function rasterize(req: CompositeRequest): Bitmap {
  const bmp = createBitmap(SPRITE_W, SPRITE_H);
  paint(bmp, req.frame.shapes);
  if (req.outfit) {
    const bob = req.outfit.frameBob[req.frameIndex ?? 0] ?? 0;
    paint(bmp, req.outfit.perDir[req.frame.dir], 0, bob);
  }
  if (req.hair) {
    const a = req.frame.anchors[req.hair.anchor];
    paint(bmp, req.hair.shapes, a.x + req.hair.offset.x, a.y + req.hair.offset.y);
  }
  return bmp;
}

/**
 * design.md §6: "Slim is generated from average via documented per-frame offsets,
 * never redrawn." This is that documented rule, and it is deliberately mechanical
 * so the claim is verifiable rather than aspirational:
 *
 *  1. A shape crossing the torso band (y ≥ TORSO_TOP) **and at least
 *     `SLIM_MIN_WIDTH` wide** loses one column on each side. Head and face are
 *     untouched — a slim build is a narrower body, not a narrower skull.
 *  2. Hand anchors move one column inward, so held props follow the narrower frame.
 *
 * **Both clauses are A0 findings, not niceties.**
 *
 * The first version narrowed every torso-band shape, which destroyed the 3px-wide
 * arms: an `outlined()` arm is a 3px shadow box around a 1px fill, so narrowing it
 * produced two disconnected 1px columns and the review sheet showed dotted, broken
 * limbs. Hence the width floor.
 *
 * With the floor alone, slim then became indistinguishable from average (590 vs
 * 592 opaque px) — because on a 32px chibi the *outer* silhouette is set by the
 * arms, and the arms are exactly the shapes the floor exempts. So thin shapes are
 * **translated inward** rather than narrowed: still an offset, still no redraw, and
 * now the build difference is visible where it actually reads.
 *
 * That in turn merged the legs. A front-facing stance puts each leg one pixel from
 * the centre line, so pulling both inward collided them into a single 7px block and
 * the silhouette row lost the stance entirely. Hence the third clause: translation
 * applies only **above** `SLIM_LEG_TOP`. A slim build has narrower shoulders and
 * tucked arms; its stance is unchanged. Shapes straddling the centre are left alone,
 * since "inward" is undefined for them.
 *
 * Three iterations, each caught by looking at the rendered silhouette rather than the
 * code. That is what the spike was for.
 */
export const TORSO_TOP = 22;
/** Shapes narrower than this are structural (limbs, outlines): translate, never narrow. */
export const SLIM_MIN_WIDTH = 6;
/** At or below this row, geometry is stance — exempt from inward translation. */
export const SLIM_LEG_TOP = 35;

export function deriveSlim(frame: BodyFrame): BodyFrame {
  const mid = SPRITE_W / 2;
  const slimShape = (s: Shape): Shape => {
    const top = s.y;
    const bottom = s.k === 'rect' ? s.y + s.h : s.y + 1;
    if (bottom <= TORSO_TOP) return s; // head and face untouched
    if (top >= SLIM_LEG_TOP) return s; // stance untouched
    if (s.k !== 'rect') {
      if (s.x + 1 <= mid) return { ...s, x: s.x + 1 };
      if (s.x >= mid) return { ...s, x: s.x - 1 };
      return s;
    }
    if (s.w >= SLIM_MIN_WIDTH) return { ...s, x: s.x + 1, w: s.w - 2 };
    if (s.x + s.w <= mid) return { ...s, x: s.x + 1 };
    if (s.x >= mid) return { ...s, x: s.x - 1 };
    return s;
  };
  const pull = (p: Pt): Pt => ({ x: p.x + (p.x < mid ? 1 : -1), y: p.y });
  return {
    ...frame,
    id: frame.id.replace('average', 'slim'),
    shapes: frame.shapes.map(slimShape),
    anchors: { head: frame.anchors.head, handL: pull(frame.anchors.handL), handR: pull(frame.anchors.handR) },
  };
}

/** Flatten to a silhouette in flat Ink — design.md §6's readability test. */
export function silhouette(bmp: Bitmap, ink = '#2e2119'): Bitmap {
  const { r, g, b } = hexToRgb(ink);
  const out = createBitmap(bmp.width, bmp.height);
  for (let i = 0; i < bmp.width * bmp.height; i++) {
    if (bmp.data[i * 4 + 3] === 0) continue;
    out.data[i * 4] = r;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = b;
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

/** Opaque-pixel count — used to compare builds and to reject empty frames. */
export function opaqueCount(bmp: Bitmap): number {
  let n = 0;
  for (let i = 0; i < bmp.width * bmp.height; i++) if (bmp.data[i * 4 + 3] !== 0) n++;
  return n;
}

/** Widest opaque row below the torso line — the measurable difference between builds. */
export function torsoWidth(bmp: Bitmap): number {
  let widest = 0;
  for (let y = TORSO_TOP; y < bmp.height; y++) {
    let min = -1;
    let max = -1;
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.data[(y * bmp.width + x) * 4 + 3] === 0) continue;
      if (min === -1) min = x;
      max = x;
    }
    if (min !== -1) widest = Math.max(widest, max - min + 1);
  }
  return widest;
}
