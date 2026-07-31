import { Text, type TextProps, type TextStyle } from 'react-native';
import { PROSE, scaledType, TABULAR, theme, type TypeStep } from '../theme';

/**
 * The one way to put player-facing words on screen (design.md §4, P7).
 *
 * P6 centralised *sizes* in `theme.ts` and a static test kept them there, which is why the
 * repo had four sizes rather than sixteen. What it could not express is which size a given
 * string deserves — so `TYPE_SCALE.micro` (8px) spread to 51 call sites and every one of
 * them passed review. `GameText` moves the decision from "pick a size" to "say what this
 * text *is*", and the variant answers the size, the face and the line height together.
 *
 * The pairing matters more than the size: 12px is legible only on the sans face, and the
 * pixel face is crisp only at multiples of 8. A caller that picks those independently can
 * silently produce anti-aliased pixel type, which design.md §13 rejects on sight.
 */

export type GameTextVariant =
  /** 12px sans. Times, effects, metadata, secondary explanation. */
  | 'caption'
  /** 16px pixel. Card names, HUD values, field labels, button text. */
  | 'label'
  /** 16px sans, 24px line height. Anything longer than a sentence. */
  | 'prose'
  /** 24px pixel bold. Panel and section titles. */
  | 'heading'
  /** 32px pixel bold. Logo and major event headings. */
  | 'display';

const STEP: Record<Exclude<GameTextVariant, 'prose'>, TypeStep> = {
  caption: 'caption',
  label: 'body',
  heading: 'heading',
  display: 'display',
};

export interface GameTextProps extends TextProps {
  variant?: GameTextVariant;
  /**
   * The HUD text-size preference. Defaults to 1 so surfaces outside the HUD — which the
   * preference deliberately does not govern — need not thread it through.
   */
  textScale?: number;
  /**
   * Tabular figures, per Joe's global rules, so a clock or a bar value does not jitter as
   * its digits change. On by default for numerals; pass `false` for prose containing digits.
   */
  tabular?: boolean;
  color?: string;
}

export function GameText({
  variant = 'label',
  textScale = 1,
  tabular,
  color = theme.color.ink,
  style,
  ...rest
}: GameTextProps) {
  const base: TextStyle =
    variant === 'prose'
      ? { ...PROSE, fontSize: Math.round(PROSE.fontSize as number * textScale) }
      : scaledType(STEP[variant], textScale);
  const wantsTabular = tabular ?? (variant === 'label' || variant === 'caption');
  return (
    <Text
      // Platform text scaling composes with the in-game preference rather than replacing
      // it; the cap stops a 200% OS setting from pushing the HUD over the world.
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[base, wantsTabular ? TABULAR : null, { color }, style]}
      {...rest}
    />
  );
}
