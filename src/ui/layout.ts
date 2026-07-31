import { HUD_H, QUEUE_W } from '../render/scale';
import { TYPE_SCALE } from './theme';

/**
 * Screen regions and the layer ladder (docs/07-ui-architecture.md).
 *
 * Before this module every UI surface picked a screen edge, a hand-typed pixel offset and
 * a hand-typed `zIndex` independently. That produced 23 `zIndex` literals across 8 files
 * and four reproducible collisions — the morning recap landing inside the queue rail, the
 * onboarding chips landing under a HUD that spanned the full width, and two constants
 * (`HUD_H`, `QUEUE_W`) that only the world renderer respected.
 *
 * Two primitives replace all of it:
 *
 *  - A **region** is a named rectangle that reserves space. A surface names a region and
 *    never a screen edge. Regions are laid out first; the world gets what is left.
 *  - A **layer** is a named entry on a fixed ladder. A surface names a layer and never a
 *    number.
 *
 * The rule that makes the ladder mean anything is §3.3.1: **layer tokens are legal only on
 * surfaces mounted at screen scope, and no wrapper between the screen root and such a
 * surface may create a CSS stacking context.** A z value only competes with its siblings
 * inside the nearest stacking context, so without that rule the numbers below decide
 * nothing and the paint order falls out of the component tree's shape instead.
 */

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/**
 * Paint order, low to high.
 *
 * `notice` sits **below** `chrome` deliberately. Notices are kept out of chrome's
 * rectangles geometrically (`NOTICE` is defined as space chrome does not occupy), so this
 * ordering is a backstop rather than the mechanism — and a backstop should pick the right
 * loser. If the geometry ever slips, the surface the player is steering with wins and a
 * chip is briefly hidden, rather than an ambient toast covering the queue.
 */
export const LAYER = {
  world: 0,
  worldOverlay: 10,
  notice: 20,
  chrome: 30,
  chromePopover: 40,
  focus: 50,
  modal: 60,
} as const;

export type LayerName = keyof typeof LAYER;

/** Every layer value, ascending — the gate asserts the ladder is strictly increasing. */
export const LAYER_ORDER: readonly LayerName[] = [
  'world',
  'worldOverlay',
  'notice',
  'chrome',
  'chromePopover',
  'focus',
  'modal',
];

/**
 * Ordering *within* one component's own subtree.
 *
 * The rail's card stacks a drag surface under a completion poof under forecast chips, and
 * `WorldInteractions` puts a hotspot under its label. None of that is screen layering, and
 * an unscoped "no zIndex literals" gate would have outlawed five correct usages on the day
 * it landed. `local` is legal only inside a surface that already claimed a screen layer,
 * and it can never lift a child out of its parent.
 */
export function local(step: number): number {
  if (!Number.isInteger(step) || step < 1 || step > 9) {
    throw new RangeError(
      `local layer step must be an integer 1..9, got ${step}. Anything that needs to ` +
        'escape its own component is screen-scope and belongs on the LAYER ladder.',
    );
  }
  return step;
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RegionName =
  | 'status'
  | 'temporal'
  | 'rail'
  | 'notice'
  | 'stage'
  | 'focus';

export interface RegionInput {
  width: number;
  height: number;
  /** The effective HUD text-size preference. Region sizes are functions of it. */
  textScale?: number;
}

export type Regions = Record<RegionName, Rect>;

/** The one breakpoint. Below this the rail becomes a bottom sheet (§3.5). */
export const NARROW_MAX = 900;

/** Gutter between regions and the viewport edge. On the 4px grid, per Joe's rules. */
export const GUTTER = 8;

/** Bottom-sheet height when the rail collapses on a narrow viewport. */
const RAIL_SHEET_H = 96;

/**
 * The measured height of the `STATUS` block's content, as a function of text scale.
 *
 * **Not** `HUD_H`. Measured live at `textScale` 1 the HUD block's box is 200 × 198 against
 * a reserve of 148 — the world solver was told the HUD was 50px shorter than it is, so the
 * room drew underneath it. And because the old reserve scaled linearly (`HUD_H * scale`)
 * while the block's fixed borders and padding do not, the error changed with the slider
 * instead of staying constant.
 *
 * This derives the height the same way the content does: seven rows whose type comes from
 * `TYPE_SCALE`, plus the block's own fixed chrome. One recipe, so the box and the thing
 * inside it cannot disagree.
 */
export function statusHeight(textScale = 1): number {
  const s = Number.isFinite(textScale) && textScale > 0 ? textScale : 1;
  const line = (base: number) => Math.round(base * s);
  // label row + health value row, the health bar, four sub-bars, the practice counter.
  const labelRow = line(TYPE_SCALE.caption.lineHeight);
  const valueRow = line(20);
  const healthBar = 10;
  const subRow = Math.max(line(20), 6) + 4;
  const practiceRow = line(TYPE_SCALE.caption.lineHeight);
  const content = labelRow + valueRow + healthBar + subRow * 4 + practiceRow;
  const blockChrome = 8 * 2 + 2 + 4 + 4 * 6; // padding + top/bottom border + row gaps
  return Math.ceil((content + blockChrome + GUTTER * 2) / 4) * 4;
}

/** The `STATUS` block's width, from the same widths `hudType` gives its rows. */
export function statusWidth(textScale = 1): number {
  const s = Number.isFinite(textScale) && textScale > 0 ? textScale : 1;
  const row = Math.round((168 * s) / 4) * 4;
  return row + 8 * 2 + 2 * 2 + GUTTER * 2; // padding + borders + gutters
}

/**
 * Lay every region out for a viewport.
 *
 * Order matters: chrome reserves first, `NOTICE` takes space chrome does not occupy, and
 * `STAGE` is whatever remains. `FOCUS` deliberately overlaps everything — it is the one
 * region that is allowed to, because at most one focus surface exists at a time and it is
 * the player's whole attention while it does.
 */
export function regionsFor(input: RegionInput): Regions {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const scale = Number.isFinite(input.textScale) && (input.textScale ?? 1) > 0
    ? (input.textScale as number)
    : 1;
  const narrow = width < NARROW_MAX;

  const statusH = Math.min(statusHeight(scale), height);
  const statusW = Math.min(statusWidth(scale), width);

  if (narrow) {
    // `TEMPORAL` collapses to zero and `STATUS` widens to span the top bar, absorbing the
    // clock and speed controls. The region *names* are stable across breakpoints; their
    // rectangles are not, and a collapsed region hands its contents to a named sibling.
    const railH = Math.min(RAIL_SHEET_H, Math.max(0, height - statusH));
    const status: Rect = { x: 0, y: 0, width, height: statusH };
    const temporal: Rect = { x: width, y: 0, width: 0, height: 0 };
    const rail: Rect = { x: 0, y: height - railH, width, height: railH };
    const stage: Rect = {
      x: 0,
      y: statusH,
      width,
      height: Math.max(0, height - statusH - railH),
    };
    const notice: Rect = {
      x: GUTTER,
      y: Math.max(stage.y, rail.y - GUTTER - 40),
      width: Math.max(0, width - GUTTER * 2),
      height: Math.min(40, Math.max(0, stage.height - GUTTER)),
    };
    return { status, temporal, rail, notice, stage, focus: { x: 0, y: 0, width, height } };
  }

  const railW = Math.min(QUEUE_W, width);
  const temporalH = Math.min(statusH, height);

  const status: Rect = { x: 0, y: 0, width: Math.min(statusW, width - railW), height: statusH };
  const temporal: Rect = { x: width - railW, y: 0, width: railW, height: temporalH };
  const rail: Rect = {
    x: width - railW,
    y: temporalH,
    width: railW,
    height: Math.max(0, height - temporalH),
  };
  const stage: Rect = {
    x: 0,
    y: 0,
    width: Math.max(0, width - railW),
    height: Math.max(0, height - 0),
  };
  // `NOTICE` is a column at the bottom-left of the space chrome leaves: left of the rail,
  // below `STATUS`. One stack growing upward, so notices never scatter and never overlap
  // the two surfaces the player steers with.
  const noticeW = Math.min(320, Math.max(0, width - railW - GUTTER * 2));
  const noticeH = Math.max(0, height - statusH - GUTTER * 2);
  const notice: Rect = {
    x: GUTTER,
    y: Math.max(statusH + GUTTER, height - GUTTER - noticeH),
    width: noticeW,
    height: noticeH,
  };

  return { status, temporal, rail, notice, stage, focus: { x: 0, y: 0, width, height } };
}

/**
 * What the world solver may use.
 *
 * `scale.ts` reserves `HUD_H`/`QUEUE_W` by default; this hands it the measured region sizes
 * instead, which is the fix for the 50px overhang described on `statusHeight`.
 */
export function worldReservation(input: RegionInput): {
  hudHeight: number;
  queueWidth: number;
} {
  const r = regionsFor(input);
  const narrow = Math.max(0, input.width) < NARROW_MAX;
  return {
    hudHeight: narrow ? r.status.height + r.rail.height : r.status.height,
    queueWidth: narrow ? 0 : r.rail.width,
  };
}

/** The 1× fallbacks, kept so a caller with no viewport still reserves something sane. */
export const FALLBACK_RESERVATION = { hudHeight: HUD_H, queueWidth: QUEUE_W } as const;

/** Do two rectangles share any area? Zero-width or zero-height regions never intersect. */
export function intersects(a: Rect, b: Rect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** Is `inner` fully inside `outer`? Used by the "every region contains its content" gate. */
export function contains(outer: Rect, inner: Rect): boolean {
  if (inner.width <= 0 || inner.height <= 0) return true;
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** The regions that must never overlap. `focus` is exempt; it covers everything by design. */
export const EXCLUSIVE_REGIONS: readonly RegionName[] = [
  'status',
  'temporal',
  'rail',
  'notice',
];
