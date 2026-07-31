import { StyleSheet, View } from 'react-native';
import { theme } from './theme';

/**
 * The journal, drawn as pixel art rather than shipped as a glyph.
 *
 * Every other icon in this game is authored — the four need glyphs, the queue's owner
 * marks, the atlas sprites. A font emoji here would be the one element rendering at the
 * platform's whim, at a different weight on every OS, and off-palette on all of them.
 *
 * Built from flat `View` rectangles on a 16×16 grid for the same reason `NeedRing` is:
 * this is a pixel game with a locked palette and no SVG in the stack. Colours come from
 * the Wood ramp so the book reads as an object in the room's material vocabulary, with the
 * Lantern gold clasp as its only accent — gold is sanctioned for reward and light, and a
 * closed book's catch is the closest this gets.
 */

const GRID = 16;

/** `[x, y, w, h, colour]`, on the 16×16 grid. */
type Px = readonly [number, number, number, number, string];

const INK = theme.color.ink;
const { wood, woodShadow, woodLight, gold, creamLight } = theme.color;

const PIXELS: readonly Px[] = [
  // Back cover, offset down-right so the book has depth without a gradient.
  [3, 2, 11, 13, woodShadow],
  // Front cover.
  [2, 1, 11, 13, wood],
  // Spine, along the left edge.
  [2, 1, 2, 13, woodShadow],
  // Page block peeking out of the fore-edge.
  [12, 3, 2, 9, creamLight],
  // Cover grain: two flicks in the light step, never touching the spine.
  [6, 4, 5, 1, woodLight],
  [6, 10, 4, 1, woodLight],
  // Clasp.
  [10, 6, 4, 3, gold],
  [11, 7, 2, 1, INK],
  // Outline: the same 1px Ink keyline every sprite in this game carries.
  [2, 0, 12, 1, INK],
  [1, 1, 1, 13, INK],
  [2, 14, 12, 1, INK],
  [14, 2, 1, 13, INK],
];

export interface JournalIconProps {
  /** Rendered size in px. The grid scales; the art stays crisp at integer multiples. */
  size?: number;
}

export function JournalIcon({ size = 48 }: JournalIconProps) {
  const unit = size / GRID;
  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      testID="journal-icon"
      pointerEvents="none"
    >
      {PIXELS.map(([x, y, w, h, color], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x * unit,
            top: y * unit,
            width: w * unit,
            height: h * unit,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
});
