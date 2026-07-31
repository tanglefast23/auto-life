import type { TextStyle, ViewStyle } from 'react-native';
import {
  GREY,
  ROSE,
  CREAM_BASE,
  CREAM_LIGHT,
  CREAM_SHADOW,
  DUSK_PLUM,
  INK,
  IZAKAYA_RED,
  LANTERN_GOLD,
  LEAF_GREEN,
  TERRACOTTA,
  WATER_BLUE,
  WOOD,
} from '../render/palette';

/**
 * The UI theme (design.md §3 Track A, §4, §8; Joe's global rules; P6 T7).
 *
 * Before P6 the UI carried palette hex literals copy-pasted across fourteen files —
 * `AppShell.tsx` alone had 36 — and **sixteen distinct font sizes** against design.md §4's
 * cap of four, in three weights against its cap of two. This is the single source those
 * files now read from, and `theme.test.ts` enforces every one of those caps mechanically
 * rather than by review.
 *
 * Colours are re-exported from `src/render/palette.ts` rather than restated, so the UI and
 * the world provably cannot drift onto different reds.
 */

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * Silkscreen's em is 8px, so it renders crisp at 8/16/24/32 and anti-aliases at every
 * other size — and design.md §13 lists anti-aliased pixel type as an instant reject. The
 * scale is therefore not a matter of taste: it is the set of sizes the face can occupy.
 */
export const PIXEL_EM = 8;

export const FONT = {
  /**
   * Two real faces, never one face plus synthetic bold. HFM's handover is explicit
   * (docs/lessons-from-hero-football-manager.md §2.5): synthetic bold on a bitmap face
   * smears the pixel grid. `fontWeight` therefore stays `normal` everywhere and weight is
   * carried by the family name.
   */
  pixel: 'Silkscreen_400Regular',
  pixelBold: 'Silkscreen_700Bold',
  /** design.md §4: "Readable sans for anything longer than a sentence." */
  prose: 'System',
} as const;

export const TYPE_SCALE = {
  micro: { fontFamily: FONT.pixel, fontSize: 8, fontWeight: 'normal' },
  body: { fontFamily: FONT.pixel, fontSize: 16, fontWeight: 'normal' },
  heading: { fontFamily: FONT.pixelBold, fontSize: 24, fontWeight: 'normal' },
  display: { fontFamily: FONT.pixelBold, fontSize: 32, fontWeight: 'normal' },
} as const satisfies Record<string, TextStyle>;

export type TypeStep = keyof typeof TYPE_SCALE;

/** Prose is the one place a non-pixel face is legal, and it gets exactly one size. */
export const PROSE: TextStyle = {
  fontFamily: FONT.prose,
  fontSize: 16,
  lineHeight: 24,
  fontWeight: 'normal',
};

/**
 * Numbers always sit on the tabular figures Joe's global rules require, so a clock or a
 * bar value does not jitter as its digits change.
 */
export const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Round a scaled pixel-font size back onto the crisp grid.
 *
 * P5 ships a continuous `hudTextScale` of 0.75–1.5 (`career-state.ts:102`; an audit
 * corrected this plan's earlier "200%"). Multiplying a Silkscreen size by 1.25 gives 20px,
 * which is *not* a multiple of the 8px em and therefore anti-aliases — so accessibility
 * scaling and design.md §13 would be in direct conflict at most settings. Snapping to the
 * nearest legal step keeps both: the text still grows, and it stays crisp at every stop.
 */
export function crispSize(base: number, scale: number): number {
  const wanted = base * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  return Math.max(PIXEL_EM, Math.round(wanted / PIXEL_EM) * PIXEL_EM);
}

/** A scaled type step, ready to spread into a `Text` style. */
export function scaledType(step: TypeStep, scale = 1): TextStyle {
  const spec = TYPE_SCALE[step];
  return { ...spec, fontSize: crispSize(spec.fontSize, scale) };
}

// ---------------------------------------------------------------------------
// Colour and space
// ---------------------------------------------------------------------------

export const theme = {
  color: {
    ink: INK,
    creamLight: CREAM_LIGHT,
    creamBase: CREAM_BASE,
    creamShadow: CREAM_SHADOW,
    gold: LANTERN_GOLD.base,
    goldShadow: LANTERN_GOLD.shadow,
    goldLight: LANTERN_GOLD.light,
    red: IZAKAYA_RED.base,
    redShadow: IZAKAYA_RED.shadow,
    plum: DUSK_PLUM.base,
    plumShadow: DUSK_PLUM.shadow,
    leaf: LEAF_GREEN.base,
    water: WATER_BLUE.base,
    wood: WOOD.base,
    woodShadow: WOOD.shadow,
    terracotta: TERRACOTTA.base,
    redLight: IZAKAYA_RED.light,
    plumLight: DUSK_PLUM.light,
    leafShadow: LEAF_GREEN.shadow,
    leafLight: LEAF_GREEN.light,
    waterShadow: WATER_BLUE.shadow,
    waterLight: WATER_BLUE.light,
    woodLight: WOOD.light,
    grey: GREY.base,
    greyShadow: GREY.shadow,
    greyLight: GREY.light,
    terracottaShadow: TERRACOTTA.shadow,
    terracottaLight: TERRACOTTA.light,
    rose: ROSE.base,
    roseShadow: ROSE.shadow,
    roseLight: ROSE.light,
  },
  /** Joe's global rules: every spacing value divisible by 4. */
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { card: 4, chip: 8 },
  /** SPEC §11.2: hit targets ≥44px. */
  minTarget: 44,
} as const;

// ---------------------------------------------------------------------------
// design.md §8 component recipes
// ---------------------------------------------------------------------------

/**
 * The HFM chunky recipe: thick Ink outline, rounded chunky corners, a bold two-tone face
 * (Cream light top, Cream shadow lip). Track A outlines in **Ink**, which is the exact
 * inverse of the world's Track B rule — a face is never outlined like a button, and a
 * button is never shaded like a sprite.
 */
function chunky(face: string, lip: string): ViewStyle {
  return {
    backgroundColor: face,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderBottomWidth: 4,
    borderBottomColor: lip,
    borderRadius: theme.radius.card,
  };
}

export const CHROME = {
  panel: { ...chunky(theme.color.creamBase, theme.color.creamShadow), padding: theme.space.lg },
  card: { ...chunky(theme.color.creamLight, theme.color.creamShadow), padding: theme.space.sm },
  chip: {
    ...chunky(theme.color.creamBase, theme.color.creamShadow),
    borderRadius: theme.radius.chip,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
  },
  neutralButton: {
    ...chunky(theme.color.creamLight, theme.color.creamShadow),
    minHeight: theme.minTarget,
    paddingHorizontal: theme.space.lg,
    justifyContent: 'center',
  },
  /** design.md §2: red is URGENT and destructive confirms. Nothing decorative is red. */
  destructiveButton: {
    ...chunky(theme.color.red, theme.color.redShadow),
    minHeight: theme.minTarget,
    paddingHorizontal: theme.space.lg,
    justifyContent: 'center',
  },
  /** design.md §2: gold is light sources and **reward moments only**. Never generic emphasis. */
  rewardButton: {
    ...chunky(theme.color.gold, theme.color.goldShadow),
    minHeight: theme.minTarget,
    paddingHorizontal: theme.space.lg,
    justifyContent: 'center',
  },
  /** Bar troughs (design.md §8). The fill colour is the bar's own ramp base, from `bands.ts`. */
  trough: {
    backgroundColor: theme.color.creamShadow,
    borderWidth: 1,
    borderColor: theme.color.ink,
    borderRadius: 2,
    overflow: 'hidden',
  },
  /** design.md §8 bubbles: cream rounds, Ink tail; grumpy plum, happy leaf, **never red**. */
  bubble: {
    ...chunky(theme.color.creamLight, theme.color.creamShadow),
    borderRadius: theme.radius.chip,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
  },
} as const satisfies Record<string, ViewStyle>;

/** Tints the bubble layer may use. Red is deliberately absent (design.md §8). */
export const BUBBLE_TINT = {
  plum: theme.color.plum,
  leaf: theme.color.leaf,
  gold: theme.color.gold,
} as const;
