import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { GameText, type GameTextVariant } from '../GameText';
import { FONT, MIN_READABLE, PIXEL_EM, theme } from '../../theme';

/**
 * P7 — `GameText` exists to make the illegal combinations unreachable, so these tests are
 * about the *pairing* of size and face, not about either one alone.
 */

function styleOf(element: React.ReactElement): Record<string, unknown> {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  const node = tree.root.findByType(Text);
  const flat = ([] as unknown[]).concat(node.props.style as unknown[]).flat(4);
  return Object.assign({}, ...flat.filter((s) => s !== null && s !== undefined && s !== false));
}

function render(variant: GameTextVariant, textScale = 1) {
  return styleOf(<GameText variant={variant} textScale={textScale}>42</GameText>);
}

const ALL: GameTextVariant[] = ['caption', 'label', 'prose', 'heading', 'display'];

describe('GameText', () => {
  it('puts no variant below the readable floor, at any supported scale', () => {
    for (let scale = 0.75; scale <= 1.5001; scale += 0.05) {
      for (const variant of ALL) {
        expect({ variant, size: render(variant, scale).fontSize }).toEqual({
          variant,
          size: expect.any(Number),
        });
        expect(render(variant, scale).fontSize as number).toBeGreaterThanOrEqual(MIN_READABLE);
      }
    }
  });

  it('never renders the pixel face below 16px', () => {
    // The single combination that defeats the whole contract while passing a size check.
    for (let scale = 0.75; scale <= 1.5001; scale += 0.05) {
      for (const variant of ALL) {
        const s = render(variant, scale);
        const isPixel = s.fontFamily === FONT.pixel || s.fontFamily === FONT.pixelBold;
        if (isPixel) {
          expect(s.fontSize as number).toBeGreaterThanOrEqual(PIXEL_EM * 2);
          expect((s.fontSize as number) % PIXEL_EM).toBe(0);
        }
      }
    }
  });

  it('gives the small tier the sans face and the headings the pixel face', () => {
    expect(render('caption').fontFamily).toBe(FONT.prose);
    expect(render('prose').fontFamily).toBe(FONT.prose);
    expect(render('label').fontFamily).toBe(FONT.pixel);
    expect(render('heading').fontFamily).toBe(FONT.pixelBold);
    expect(render('display').fontFamily).toBe(FONT.pixelBold);
  });

  it('actually responds to the HUD preference', () => {
    // The defect P7 closes: the preference moved reserved layout and left every glyph alone.
    for (const variant of ALL) {
      expect(render(variant, 1.5).fontSize as number).toBeGreaterThan(
        render(variant, 1).fontSize as number,
      );
    }
  });

  it('defaults numerals to tabular figures and lets prose opt out', () => {
    expect(render('label').fontVariant).toContain('tabular-nums');
    expect(render('caption').fontVariant).toContain('tabular-nums');
    expect(styleOf(<GameText variant="prose">x</GameText>).fontVariant).toBeUndefined();
  });

  it('inks text by default and lets a caller override', () => {
    expect(render('label').color).toBe(theme.color.ink);
    expect(
      styleOf(<GameText color={theme.color.gold}>x</GameText>).color,
    ).toBe(theme.color.gold);
  });

  it('lets an explicit style win, so a caller is never boxed in', () => {
    expect(
      styleOf(<GameText variant="caption" style={{ textAlign: "right" }}>x</GameText>)
        .textAlign,
    ).toBe('right');
  });
});
