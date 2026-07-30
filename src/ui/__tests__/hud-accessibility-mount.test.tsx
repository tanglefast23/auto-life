import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, StyleSheet, Text } from 'react-native';
import { Hud } from '../Hud';
import { GameLoop } from '../../application/loop';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';

const snapshot = new GameLoop(
  newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize()),
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

test('HUD values have complete screen-reader labels and explicitly permit text scaling', () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <Hud snapshot={snapshot} speed={1} onSpeed={jest.fn()} reducedMotion />,
    );
  });

  expect(
    tree!.root.findByProps({ testID: 'hud-health-value' }).props.accessibilityLabel,
  ).toMatch(/^Health \d+ of 100, /);
  for (const bar of ['energy', 'nutrition', 'movement', 'hygiene']) {
    expect(
      tree!.root.findByProps({ testID: `hud-bar:${bar}` }).props.accessibilityLabel,
    ).toMatch(/of 100/);
  }
  expect(
    tree!.root.findByProps({ testID: 'hud-practice' }).props.accessibilityLabel,
  ).toMatch(/Practice \d+ points/);

  const textNodes = tree!.root.findAllByType(Text);
  expect(textNodes.length).toBeGreaterThan(0);
  for (const node of textNodes) {
    expect(node.props.allowFontScaling).toBe(true);
    expect(node.props.maxFontSizeMultiplier).toBe(2);
  }

  expect(Animated.loop).not.toHaveBeenCalled();
  act(() => tree!.unmount());
});

test('speed controls retain a 44 px target after text scaling support lands', () => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <Hud snapshot={snapshot} speed={1} onSpeed={jest.fn()} reducedMotion />,
    );
  });
  for (const speed of [0, 1, 2, 4]) {
    const style = StyleSheet.flatten(
      tree!.root.findByProps({ testID: `speed-${speed}` }).props.style,
    );
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  }
  act(() => tree!.unmount());
});
