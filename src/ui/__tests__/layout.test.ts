import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  contains,
  EXCLUSIVE_REGIONS,
  GUTTER,
  intersects,
  LAYER,
  LAYER_ORDER,
  local,
  NARROW_MAX,
  regionsFor,
  statusHeight,
  worldReservation,
  type Rect,
} from '../layout';
import { CHROME, theme } from '../theme';
import { DUSK_PLUM, GREY } from '../../render/palette';
import { OBJECT_PRESENTATION } from '../../render/object-presentation';
import { WORLD_H, WORLD_W } from '../../render/scale';

/**
 * The layout gates (docs/07-ui-architecture.md §5).
 *
 * These are the tests that make the region model a contract rather than a document. Each
 * one corresponds to a numbered gate in the spec.
 */

const repoRoot = resolve(__dirname, '../../..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...sourceFiles(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const uiSources = [
  ...sourceFiles(resolve(repoRoot, 'src/ui')),
  ...sourceFiles(resolve(repoRoot, 'src/application')),
].filter((f) => !f.endsWith('layout.ts'));

// ---------------------------------------------------------------------------
// Gate 1 — no screen-scope zIndex literal
// ---------------------------------------------------------------------------

test('gate 1: no UI file writes a bare zIndex number', () => {
  const offenders: string[] = [];
  for (const file of uiSources) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (/zIndex:\s*\d/.test(line)) {
        offenders.push(`${file.replace(`${repoRoot}/`, '')}:${i + 1} ${line.trim()}`);
      }
    });
  }
  // Layering is decided by the ladder, or by `local()` inside one component's subtree.
  // A literal is how 23 of them accumulated across 8 files in the first place.
  expect(offenders).toEqual([]);
});

test('gate 1: the ladder is strictly increasing, and local never reaches it', () => {
  const values = LAYER_ORDER.map((name) => LAYER[name]);
  for (let i = 1; i < values.length; i++) {
    expect(values[i]!).toBeGreaterThan(values[i - 1]!);
  }
  // `local` orders siblings inside a component; it must never rival a screen layer.
  expect(local(9)).toBeLessThan(LAYER.worldOverlay);
  expect(() => local(0)).toThrow();
  expect(() => local(10)).toThrow();
  expect(() => local(1.5)).toThrow();
});

test('gate 1: notice sits below chrome, so a slipped geometry hides a chip not the rail', () => {
  expect(LAYER.notice).toBeLessThan(LAYER.chrome);
  expect(LAYER.chrome).toBeLessThan(LAYER.chromePopover);
  expect(LAYER.chromePopover).toBeLessThan(LAYER.focus);
  expect(LAYER.focus).toBeLessThan(LAYER.modal);
});

// ---------------------------------------------------------------------------
// Gate 3 — no stacking-context wrapper around layered surfaces
// ---------------------------------------------------------------------------

test('gate 3: no layered surface is wrapped in an absoluteFill View', () => {
  // react-native-web gives every View `position: relative; z-index: 0`, so every View is a
  // stacking context. A wrapper around layered surfaces therefore traps them: their tokens
  // compete only with each other while the wrapper competes at z 0 with everything else.
  // This is the confirmed mechanism behind the recap-under-the-rail collision.
  // Scoped to *screen*-scope layers. `worldOverlay` surfaces (hotspots, their labels, the
  // object choice panel) belong inside STAGE by definition, so a wrapper around them is
  // correct — it is the stage. Only surfaces that must compete across the whole screen
  // are trapped by one.
  const SCREEN_SCOPE = /LAYER\.(notice|chrome|chromePopover|focus|modal)\b/;
  const offenders: string[] = [];
  for (const file of uiSources) {
    const text = readFileSync(file, 'utf8');
    if (!SCREEN_SCOPE.test(text)) continue;
    if (/<View[^>]*style=\{StyleSheet\.absoluteFill\}/.test(text)) {
      offenders.push(file.replace(`${repoRoot}/`, ''));
    }
  }
  expect(offenders).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 4 — regions do not intersect, at every breakpoint and text scale
// ---------------------------------------------------------------------------

const VIEWPORTS = [
  { width: 390, height: 844, label: 'iPhone portrait' },
  { width: 768, height: 1024, label: 'tablet portrait' },
  { width: 1366, height: 768, label: '1× laptop' },
  { width: 1470, height: 956, label: 'MBA 13 default' },
  { width: 2560, height: 1440, label: 'large desktop' },
];
const SCALES = [0.75, 1, 1.25, 1.5];

test('gate 4: the exclusive regions never intersect, at any viewport or text scale', () => {
  const clashes: string[] = [];
  for (const vp of VIEWPORTS) {
    for (const textScale of SCALES) {
      const r = regionsFor({ ...vp, textScale });
      for (let i = 0; i < EXCLUSIVE_REGIONS.length; i++) {
        for (let j = i + 1; j < EXCLUSIVE_REGIONS.length; j++) {
          const a = EXCLUSIVE_REGIONS[i]!;
          const b = EXCLUSIVE_REGIONS[j]!;
          if (intersects(r[a], r[b])) {
            clashes.push(`${vp.label} @${textScale}: ${a} × ${b}`);
          }
        }
      }
    }
  }
  expect(clashes).toEqual([]);
});

test('gate 4: STAGE never overlaps the rail, which is the collision this model exists for', () => {
  for (const vp of VIEWPORTS) {
    for (const textScale of SCALES) {
      const r = regionsFor({ ...vp, textScale });
      expect(intersects(r.stage, r.rail)).toBe(false);
    }
  }
});

test('gate 4: every region stays inside the viewport', () => {
  const escapes: string[] = [];
  for (const vp of VIEWPORTS) {
    for (const textScale of SCALES) {
      const r = regionsFor({ ...vp, textScale });
      const screen: Rect = { x: 0, y: 0, width: vp.width, height: vp.height };
      for (const [name, rect] of Object.entries(r)) {
        if (!contains(screen, rect)) escapes.push(`${vp.label} @${textScale}: ${name}`);
      }
    }
  }
  expect(escapes).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 5 — regions are sized by measurement, not by the stale constants
// ---------------------------------------------------------------------------

test('gate 5: STATUS reserves at least the height its own content needs', () => {
  // The defect this replaces: HUD_H was 148 while the block measured 198, so the world
  // solver was told the HUD was 50px shorter than it is and drew the room underneath it.
  // Measured at textScale 1 the block is 198 tall; the reserve must cover it.
  expect(statusHeight(1)).toBeGreaterThanOrEqual(198);
});

test('gate 5: the reserve grows with the text-size preference', () => {
  const scales = [0.75, 1, 1.25, 1.5];
  for (let i = 1; i < scales.length; i++) {
    expect(statusHeight(scales[i]!)).toBeGreaterThan(statusHeight(scales[i - 1]!));
  }
});

test('gate 5: the world reservation reports the measured region, not HUD_H', () => {
  const wide = worldReservation({ width: 1470, height: 956, textScale: 1 });
  expect(wide.hudHeight).toBe(statusHeight(1));
  expect(wide.queueWidth).toBeGreaterThan(0);

  // Narrow: the rail is a bottom sheet, so it costs height rather than width.
  const narrow = worldReservation({ width: 390, height: 844, textScale: 1 });
  expect(narrow.queueWidth).toBe(0);
  expect(narrow.hudHeight).toBeGreaterThan(statusHeight(1));
});

// ---------------------------------------------------------------------------
// §3.5 — the breakpoint changes rectangles, never the region set
// ---------------------------------------------------------------------------

test('the region set is identical either side of the breakpoint', () => {
  const wide = Object.keys(regionsFor({ width: NARROW_MAX, height: 800 })).sort();
  const narrow = Object.keys(regionsFor({ width: NARROW_MAX - 1, height: 800 })).sort();
  expect(narrow).toEqual(wide);
});

test('narrow collapses TEMPORAL to zero and hands the top bar to STATUS', () => {
  const r = regionsFor({ width: 390, height: 844 });
  expect(r.temporal.width).toBe(0);
  expect(r.status.width).toBe(390);
  // The rail becomes a bottom sheet spanning the width.
  expect(r.rail.width).toBe(390);
  expect(r.rail.y + r.rail.height).toBe(844);
});

test('wide keeps the rail as a right column under TEMPORAL', () => {
  const r = regionsFor({ width: 1470, height: 956 });
  expect(r.temporal.width).toBeGreaterThan(0);
  expect(r.rail.x).toBe(r.temporal.x);
  expect(r.rail.y).toBe(r.temporal.height);
  expect(r.stage.width).toBe(1470 - r.rail.width);
});

// ---------------------------------------------------------------------------
// Gate 6 — notices never overlap chrome
// ---------------------------------------------------------------------------

test('gate 6: NOTICE never intersects STATUS, TEMPORAL or RAIL', () => {
  for (const vp of VIEWPORTS) {
    for (const textScale of SCALES) {
      const r = regionsFor({ ...vp, textScale });
      expect(intersects(r.notice, r.status)).toBe(false);
      expect(intersects(r.notice, r.temporal)).toBe(false);
      expect(intersects(r.notice, r.rail)).toBe(false);
    }
  }
});

test('GUTTER stays on the spacing grid', () => {
  expect(GUTTER % 4).toBe(0);
});

// ---------------------------------------------------------------------------
// Gate 10 — chrome separates from the stage
// ---------------------------------------------------------------------------

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const channel = (pair: string): number => {
    const c = parseInt(pair, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(h.slice(0, 2)) +
    0.7152 * channel(h.slice(2, 4)) +
    0.0722 * channel(h.slice(4, 6))
  );
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test('gate 10: every chrome fill either separates from the stage or carries an ink border', () => {
  // The P7 art pass moved the world to near-white walls while chrome moved to white and
  // near-white. Measured, `creamBase` against `GREY.light` is 1.50:1 — a rail held apart
  // from the room by its 2px ink border alone. Regions solve overlap; they do not solve
  // indistinctness, and a region that reserves space correctly can still read as scenery.
  const chromeFills = {
    creamLight: theme.color.creamLight,
    creamBase: theme.color.creamBase,
    creamShadow: theme.color.creamShadow,
  };
  const stageSurfaces = { wall: GREY.light, floor: DUSK_PLUM.base };

  const weak: string[] = [];
  for (const [fillName, fill] of Object.entries(chromeFills)) {
    for (const [surfaceName, surface] of Object.entries(stageSurfaces)) {
      if (contrast(fill, surface) < 1.5) weak.push(`${fillName} vs ${surfaceName}`);
    }
  }
  // Anything on this list is legal only because CHROME draws a full-opacity ink border.
  // If that border is ever softened, this gate is the thing that notices.
  expect(CHROME.panel.borderColor).toBe(theme.color.ink);
  expect(CHROME.panel.borderWidth).toBeGreaterThanOrEqual(2);
  expect(CHROME.card.borderColor).toBe(theme.color.ink);
  expect(CHROME.card.borderWidth).toBeGreaterThanOrEqual(2);
  // Text contrast is the part that must never rely on a border.
  expect(contrast(theme.color.ink, theme.color.creamLight)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(theme.color.ink, theme.color.creamBase)).toBeGreaterThanOrEqual(4.5);
  expect(weak.length).toBeLessThanOrEqual(6);
});

// ---------------------------------------------------------------------------
// Gate 11 — presentation bounds stay inside STAGE
// ---------------------------------------------------------------------------

test('gate 11: no object is drawn outside the world box STAGE reserves', () => {
  // `object-presentation.ts` draws furniture larger than its 32px collision tile, so a
  // sprite's visual box is no longer its logical one. Without this, a wide wardrobe would
  // reach under the rail.
  const escapes: string[] = [];
  for (const [id, box] of Object.entries(OBJECT_PRESENTATION)) {
    if (box.x < 0 || box.y < 0) escapes.push(`${id} starts off-world`);
    if (box.x + box.width > WORLD_W) escapes.push(`${id} overflows world width`);
    if (box.y + box.height > WORLD_H) escapes.push(`${id} overflows world height`);
  }
  expect(escapes).toEqual([]);
});
