import { Animated, StyleSheet, Text, View } from 'react-native';
import { BAR_COLOR, BAR_ICON, type BandName } from './bands';
import type { BarId } from '../sim/types';
import { MOTION } from '../render/motion';
import { local } from './layout';
import { FONT, scaledType, theme } from './theme';
import { squashInterpolation, useMotionRun } from './use-motion';

/**
 * A need as a ring that empties, not a bar that shrinks (P8 UI pass).
 *
 * Four stacked bars cost four rows of height. The vitals box is one row of the bottom bar,
 * so the four needs become rings sitting under the single Health bar: same information,
 * roughly a quarter of the vertical space.
 *
 * **The ring empties rather than fills.** A full need is a complete ring and a drained one
 * is bare, so "less ink" always means "worse" — the same direction the bars read, and the
 * opposite of a progress meter. Emptying runs anticlockwise from the top, which leaves the
 * remaining arc starting at 12 o'clock at every value instead of sliding around the face.
 *
 * Drawn from square wedges rather than SVG arcs, deliberately: this is a pixel game with a
 * locked palette, and `react-native-svg` is not in the stack. Twelve wedges give 12 steps —
 * about 8 points of need each, finer than the bands the colour already encodes.
 */

/** Wedges in a full ring. Twelve reads as a clock, which is the mental model. */
export const WEDGES = 12;

export const RING_SIZE = 34;

export interface NeedRingProps {
  bar: BarId;
  /** Display-scale value, 0..100. */
  value: number;
  band: BandName;
  /** design.md §8 / SPEC §11.6: the alert state needs a non-colour signal too. */
  alertGlyph: boolean;
  size?: number;
  /** The effective HUD text scale. The glyph is HUD text and must answer to it. */
  textScale?: number;
  /**
   * The third beat of docs/08 §11.1: the ring this grade fed, popping as the delta lands.
   *
   * A key rather than a boolean, so two grades in a row on the same bar each get their own
   * pop instead of the second one being read as "already popping". Null means no pop.
   */
  popKey?: string | null;
  reducedMotion?: boolean;
}

/** How many wedges remain lit at this value. Rounds up, so 1% is never an empty ring. */
export function litWedges(value: number, wedges = WEDGES): number {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  if (clamped <= 0) return 0;
  return Math.max(1, Math.ceil((clamped / 100) * wedges));
}

/**
 * Wedge `i`'s rotation, anticlockwise from the top.
 *
 * Index 0 is 12 o'clock. Because wedges are removed from the tail, the lit run always
 * starts at the top and the ring reads at a glance without hunting for where it began.
 */
export function wedgeAngle(index: number, wedges = WEDGES): number {
  return -(360 / wedges) * index;
}

export function NeedRing({
  bar,
  value,
  band,
  alertGlyph,
  size = RING_SIZE,
  textScale = 1,
  popKey = null,
  reducedMotion = false,
}: NeedRingProps) {
  // The pop is decoration: under reduced motion the ring simply arrives at its new value,
  // which is the state change SPEC §11.6 promises to keep.
  const popDriver = useMotionRun(MOTION.barPop, reducedMotion, popKey);
  const popScale = popKey === null ? 1 : squashInterpolation(MOTION.barPop, popDriver, reducedMotion);
  const lit = litWedges(value);
  const color = BAR_COLOR[bar];
  const wedgeH = size / 2;
  const wedgeW = Math.max(3, Math.round(size / 7));

  return (
    <Animated.View
      style={[styles.root, { width: size, height: size }, { transform: [{ scale: popScale }] }]}
      testID={`need-ring:${bar}`}
    >
      {Array.from({ length: WEDGES }, (_, i) => (
        <View
          key={i}
          testID={`need-wedge:${bar}:${i}`}
          pointerEvents="none"
          style={[
            styles.wedgeAnchor,
            {
              width: wedgeW,
              height: wedgeH,
              marginLeft: -wedgeW / 2,
              transform: [
                { translateY: -wedgeH / 2 },
                { rotate: `${wedgeAngle(i)}deg` },
                { translateY: wedgeH / 2 },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.wedge,
              { width: wedgeW },
              i < lit
                ? { backgroundColor: color }
                : styles.wedgeSpent,
            ]}
          />
        </View>
      ))}
      <View style={[styles.hub, { width: size - wedgeW * 2 - 4, height: size - wedgeW * 2 - 4 }]}>
        <Text
          testID={`need-glyph:${bar}`}
          // Scales with the OS and the HUD preference like every other HUD string; the
          // ring is sized from the same scale by its caller, so the hub grows with it
          // rather than clipping the glyph.
          allowFontScaling
          maxFontSizeMultiplier={2}
          style={[
            styles.glyph,
            scaledType('body', textScale),
            band === 'alert' && styles.glyphAlert,
          ]}
        >
          {alertGlyph ? BAR_ICON[bar].alert : BAR_ICON[bar].normal}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wedgeAnchor: {
    position: 'absolute',
    left: '50%',
    top: 0,
    alignItems: 'center',
  },
  wedge: {
    height: '38%',
    borderRadius: 1,
  },
  /** A spent wedge stays visible as an empty socket, so the ring keeps its shape. */
  wedgeSpent: {
    height: '38%',
    backgroundColor: theme.color.creamShadow,
    opacity: 0.55,
  },
  hub: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.color.creamLight,
    borderWidth: 2,
    borderColor: theme.color.ink,
    zIndex: local(2),
  },
  /**
   * The hub glyph is an icon, so it keeps the pixel face — which means it must be the
   * 16px body step, not the 12px caption one. P7 retired the sub-16px pixel step precisely
   * because it was unreadable, and `theme.test.ts` enforces the pairing.
   */
  glyph: {
    color: theme.color.ink,
    fontFamily: FONT.pixel,
    textAlign: 'center',
  },
  glyphAlert: { color: theme.color.red },
});
