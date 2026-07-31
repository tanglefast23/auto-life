import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated } from 'react-native';
import { Hud } from '../Hud';
import { BAR_ORDER, BAR_TIP } from '../bands';
import { GameLoop } from '../../application/loop';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';

/**
 * The bars name themselves (P7 playtest finding).
 *
 * A moon, a fork, an arrow and a ring were the only thing identifying the four bars on
 * screen. Their names lived exclusively in `accessibilityLabel`, so a sighted player could
 * read the value and still not know which bar it belonged to. §11.6 already requires the
 * HUD to work by press rather than hover — the app ships to iOS — so the tip opens on
 * press and merely *also* opens on hover where a pointer exists.
 */

const snapshot = new GameLoop(
  newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize()),
  content,
).snapshot;

const openTips = (tree: ReactTestRenderer, bar: string) =>
  tree.root.findAll(
    (node) => node.props.testID === `hud-bar-tip:${bar}` && typeof node.type === 'string',
    { deep: true },
  );

const mount = (): ReactTestRenderer => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <Hud snapshot={snapshot} speed={1} onSpeed={jest.fn()} reducedMotion />,
    );
  });
  return tree!;
};

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

test('every bar has a tip, and no tip is open until the player asks for one', () => {
  // A tip that just repeated the bar's name would leave the player exactly where the
  // glyph did, so each one has to be a sentence and each one has to be its own.
  const tips = BAR_ORDER.map((bar) => BAR_TIP[bar]);
  for (const tip of tips) {
    expect(tip).toMatch(/^[A-Z].*\.$/);
    expect(tip.split(' ').length).toBeGreaterThan(4);
  }
  expect(new Set(tips).size).toBe(BAR_ORDER.length);
  expect(Object.keys(BAR_TIP).sort()).toEqual([...BAR_ORDER].sort());

  const tree = mount();
  for (const bar of BAR_ORDER) {
    expect(openTips(tree, bar)).toHaveLength(0);
  }
  act(() => tree.unmount());
});

test('pressing a bar opens its tip; pressing again closes it', () => {
  const tree = mount();
  const toggle = tree.root.findByProps({ testID: 'hud-bar-tip-toggle:hygiene' });

  act(() => toggle.props.onPress());
  const [tip] = openTips(tree, 'hygiene');
  expect(
    tip!
      .findAll(
        (node) =>
          typeof node.props.children === 'string' && typeof node.type === 'string',
      )
      .map((node) => node.props.children as string),
  ).toEqual(['HYGIENE', BAR_TIP.hygiene]);

  act(() => toggle.props.onPress());
  expect(openTips(tree, 'hygiene')).toHaveLength(0);
  act(() => tree.unmount());
});

test('only one tip is open at a time, so four panels never cover the sim', () => {
  const tree = mount();
  act(() =>
    tree.root.findByProps({ testID: 'hud-bar-tip-toggle:energy' }).props.onPress(),
  );
  act(() =>
    tree.root.findByProps({ testID: 'hud-bar-tip-toggle:movement' }).props.onPress(),
  );

  expect(openTips(tree, 'energy')).toHaveLength(0);
  expect(openTips(tree, 'movement')).toHaveLength(1);
  act(() => tree.unmount());
});

test('hover opens and closes the tip where a pointer exists, without stealing another bar’s', () => {
  const tree = mount();
  const energy = tree.root.findByProps({ testID: 'hud-bar-tip-toggle:energy' });
  const nutrition = tree.root.findByProps({ testID: 'hud-bar-tip-toggle:nutrition' });

  act(() => energy.props.onHoverIn());
  expect(openTips(tree, 'energy')).toHaveLength(1);

  // Leaving a bar that is not the open one must not close the open one.
  act(() => nutrition.props.onHoverOut());
  expect(openTips(tree, 'energy')).toHaveLength(1);

  act(() => energy.props.onHoverOut());
  expect(openTips(tree, 'energy')).toHaveLength(0);
  act(() => tree.unmount());
});

test('the tip is inert to screen readers, which already hear it as the row’s hint', () => {
  const tree = mount();
  const toggle = tree.root.findByProps({ testID: 'hud-bar-tip-toggle:nutrition' });
  expect(toggle.props.accessibilityHint).toBe(BAR_TIP.nutrition);
  expect(toggle.props.accessibilityRole).toBe('button');

  act(() => toggle.props.onPress());
  const [tip] = openTips(tree, 'nutrition');
  expect(tip!.props.accessibilityElementsHidden).toBe(true);
  expect(tip!.props.importantForAccessibility).toBe('no');
  expect(tip!.props.pointerEvents).toBe('none');
  act(() => tree.unmount());
});
