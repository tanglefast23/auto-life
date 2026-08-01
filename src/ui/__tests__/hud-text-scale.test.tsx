import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, StyleSheet, Text } from 'react-native';
import { Hud } from '../Hud';
import { GameLoop } from '../../application/loop';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import { FONT, MIN_READABLE, PIXEL_EM } from '../theme';

/**
 * "HUD text size" has to change the size of HUD text.
 *
 * It shipped changing only the reserved HUD height, so the slider shrank the world and
 * left every glyph exactly where it was — an accessibility control that read as working
 * and did nothing. These assertions are on rendered font sizes, not container heights,
 * because container heights were what made the original defect invisible.
 */

const snapshot = new GameLoop(
  newGameState('baseline', content.rates, 1234, content.perks),
  content,
).snapshot;

beforeEach(() => {
  jest.spyOn(Animated, 'loop').mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  } as unknown as ReturnType<typeof Animated.loop>);
});

afterEach(() => {
  jest.restoreAllMocks();
});

interface RenderedType {
  fontSize: number;
  fontFamily: string | undefined;
}

function typeAt(textScale: number): Map<string, RenderedType> {
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <Hud
        snapshot={snapshot}
        speed={1}
        onSpeed={jest.fn()}
        reducedMotion
        textScale={textScale}
      />,
    );
  });
  const sizes = new Map<string, RenderedType>();
  for (const node of tree!.root.findAllByType(Text)) {
    const testID = node.props.testID as string | undefined;
    if (testID === undefined) continue;
    const flat = StyleSheet.flatten(node.props.style) as {
      fontSize?: number;
      fontFamily?: string;
    };
    if (typeof flat.fontSize === 'number') {
      sizes.set(testID, { fontSize: flat.fontSize, fontFamily: flat.fontFamily });
    }
  }
  act(() => tree!.unmount());
  return sizes;
}

function fontSizesAt(textScale: number): Map<string, number> {
  return new Map([...typeAt(textScale)].map(([id, t]) => [id, t.fontSize]));
}

test('a larger HUD text preference renders larger HUD text', () => {
  const base = fontSizesAt(1);
  const large = fontSizesAt(1.5);

  expect(base.size).toBeGreaterThan(0);
  expect([...large.keys()].sort()).toEqual([...base.keys()].sort());
  for (const [testID, size] of large) {
    expect(size).toBeGreaterThan(base.get(testID)!);
  }
});

test('HUD text never shrinks as the preference grows', () => {
  // Documented consequence of `crispSize`: the pixel face is only legal at 8/16/24/32, so
  // the 0.75 stop snaps 12 px back to 16 and reads identical to 1.0. That is deliberate —
  // design.md §13 rejects anti-aliased pixel type — so the contract this pins is
  // monotonic, not strictly increasing at every stop.
  const stops = [0.75, 1, 1.25, 1.5].map((scale) => fontSizesAt(scale));
  for (let i = 1; i < stops.length; i += 1) {
    for (const [testID, size] of stops[i]!) {
      expect(size).toBeGreaterThanOrEqual(stops[i - 1]!.get(testID)!);
    }
  }
});

test('every scaled HUD size stays on the crisp pixel-font grid', () => {
  // design.md §13 rejects anti-aliased pixel type outright, so a scaled size that is not
  // a multiple of Silkscreen's 8 px em is a reject even though it is "bigger".
  //
  // P7 scopes this to the pixel face. It previously asserted the em rule over *every* HUD
  // string, which was equivalent while the whole HUD was Silkscreen — but the 12 px tier
  // is now sans precisely because 12 is not a multiple of the em, and holding sans to a
  // grid it does not have would force the metadata tier back to an unreadable 8 px. The
  // rule being enforced is "pixel type never anti-aliases", not "every number divides by 8".
  for (const scale of [0.75, 1, 1.25, 1.5]) {
    for (const [testID, { fontSize, fontFamily }] of typeAt(scale)) {
      const isPixel = fontFamily === FONT.pixel || fontFamily === FONT.pixelBold;
      if (isPixel) {
        expect(`${testID}@${scale}:${fontSize % PIXEL_EM}`).toBe(`${testID}@${scale}:0`);
        expect(fontSize).toBeGreaterThanOrEqual(PIXEL_EM * 2);
      }
    }
  }
});

test('no HUD string renders below the readable floor at any preference', () => {
  // The floor this replaces was `>= PIXEL_EM`, i.e. 8 px — the exact size the P7 audit
  // failed the HUD for. A test that permits the defect it is meant to prevent is worse
  // than no test, because it reads as coverage.
  for (const scale of [0.75, 1, 1.25, 1.5]) {
    for (const [testID, { fontSize }] of typeAt(scale)) {
      expect(`${testID}@${scale}`).toBe(`${testID}@${scale}`);
      expect(fontSize).toBeGreaterThanOrEqual(MIN_READABLE);
    }
  }
});
