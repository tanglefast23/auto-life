import { createRef, type ReactElement } from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { newSession } from '../../game/session';
import { advanceGame } from '../../game/tick';
import {
  FirstSessionUI,
  type FirstSessionUIHandle,
} from '../FirstSessionUI';

function byTestId(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  return tree.root.find((node) => node.props.testID === testID);
}

function renderUI(
  element: ReactElement,
): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  return tree;
}

function packageReady() {
  const fired = advanceGame(
    newSession(),
    [],
    [],
    [{
      type: 'insertWrinkle' as const,
      status: 'accepted' as const,
      cardId: 'c1',
      wrinkleId: 'package-delivery',
      disposition: 'queued' as const,
    }],
  ).session;
  return advanceGame(fired, [{
    type: 'activityCompleted',
    detail: 'package',
    atMinute: 620,
  }]).session;
}

test('the active-goal chip opens a compact, readable Goals 1–2 surface', () => {
  const tree = renderUI(
    <FirstSessionUI
      session={newSession()}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
    />,
  );
  const chip = byTestId(tree, 'first-session-goal-chip');
  expect(chip.props.accessibilityLabel).toContain('Meet the routine');

  act(() => chip.props.onPress());

  expect(byTestId(tree, 'first-session-goals')).toBeDefined();
  expect(byTestId(tree, 'first-session-goal:meet-you').props.accessibilityLabel).toContain('0 of 3');
  expect(byTestId(tree, 'first-session-goal:change-of-plans')).toBeDefined();
  act(() => tree.unmount());
});

test('package completion presents exactly two decoration choices through one callback', () => {
  const onChooseDecoration = jest.fn();
  const tree = renderUI(
    <FirstSessionUI
      session={packageReady()}
      hudHeight={148}
      onChooseDecoration={onChooseDecoration}
    />,
  );

  const panel = byTestId(tree, 'first-session-package');
  expect(panel.props.accessibilityLiveRegion).toBe('polite');
  expect(byTestId(tree, 'first-session-package:leafy-plant')).toBeDefined();
  expect(byTestId(tree, 'first-session-package:sunny-vase')).toBeDefined();

  act(() => byTestId(tree, 'first-session-package:sunny-vase').props.onPress());
  expect(onChooseDecoration).toHaveBeenCalledWith('sunny-vase');
  act(() => tree.unmount());
});

test('the first-night recap names missed routines and supports expand and dismiss', () => {
  const accumulated = advanceGame(newSession(), [
    { type: 'activityCompleted', detail: 'meal', atMinute: 500 },
    { type: 'activityCompleted', detail: 'practice', atMinute: 600 },
    { type: 'practiceAwarded', detail: '3000', atMinute: 600 },
    { type: 'anchorMissed', detail: 'wake', atMinute: 700 },
  ]).session;
  const morning = advanceGame(accumulated, [
    { type: 'wakeBoundary', detail: '2', atMinute: 1860 },
  ]).session;
  const tree = renderUI(
    <FirstSessionUI
      session={morning}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
    />,
  );

  expect(byTestId(tree, 'first-session-recap').props.accessibilityLabel).toContain('Missed routine: Morning routine.');
  expect(byTestId(tree, 'first-session-recap-announcement').props.accessibilityLiveRegion).toBe('polite');

  act(() => byTestId(tree, 'first-session-recap:details').props.onPress());
  expect(byTestId(tree, 'first-session-recap:expanded')).toBeDefined();

  act(() => byTestId(tree, 'first-session-recap:done').props.onPress());
  expect(tree.root.findAll((node) => node.props.testID === 'first-session-recap')).toHaveLength(0);
  act(() => tree.unmount());
});

test('the Goals shortcut opens the panel, Escape closes it, and reset clears presentation', () => {
  const ref = createRef<FirstSessionUIHandle | null>();
  const tree = renderUI(
    <FirstSessionUI
      ref={ref}
      session={newSession()}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
    />,
  );
  let opened = false;
  act(() => {
    opened = ref.current?.openGoals() ?? false;
  });
  expect(opened).toBe(true);
  expect(byTestId(tree, 'first-session-goals')).toBeDefined();

  let closed = false;
  act(() => {
    closed = ref.current?.closePanels() ?? false;
  });
  expect(closed).toBe(true);
  expect(tree.root.findAll((node) => node.props.testID === 'first-session-goals')).toHaveLength(0);

  act(() => {
    ref.current?.openGoals();
  });
  expect(byTestId(tree, 'first-session-goals')).toBeDefined();

  act(() => {
    tree.update(
      <FirstSessionUI
        ref={ref}
        session={newSession()}
        hudHeight={148}
        onChooseDecoration={jest.fn()}
      />,
    );
  });
  expect(tree.root.findAll((node) => node.props.testID === 'first-session-goals')).toHaveLength(0);
  expect(tree.root.findAll((node) => node.props.testID === 'first-session-recap')).toHaveLength(0);
  act(() => tree.unmount());
});
