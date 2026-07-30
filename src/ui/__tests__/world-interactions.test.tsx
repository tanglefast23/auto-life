import { createRef } from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { content } from '../../sim/content';
import {
  WorldInteractions,
  objectHitTarget,
  type WorldInteractionsHandle,
} from '../WorldInteractions';

function byTestId(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  return tree.root.find((node) => node.props.testID === testID);
}

describe('object hit geometry', () => {
  test('uses the authored footprint, world scale, and a 44 px minimum target', () => {
    const bed = content.objects.objects.find((object) => object.id === 'bed')!;
    const guitar = content.objects.objects.find((object) => object.id === 'guitar')!;

    expect(objectHitTarget(bed, 1)).toEqual({
      left: 64,
      top: 64,
      width: 64,
      height: 64,
    });
    expect(objectHitTarget(guitar, 1)).toEqual({
      left: 186,
      top: 250,
      width: 44,
      height: 44,
    });
    expect(objectHitTarget(guitar, 1.5)).toEqual({
      left: 288,
      top: 384,
      width: 48,
      height: 48,
    });
  });
});

describe('WorldInteractions', () => {
  let tree: ReactTestRenderer;
  let onChooseActivity: jest.Mock;
  const ref = createRef<WorldInteractionsHandle | null>();

  beforeEach(() => {
    onChooseActivity = jest.fn();
    act(() => {
      tree = create(
        <WorldInteractions
          ref={ref}
          scale={1}
          onChooseActivity={onChooseActivity}
        />,
      );
    });
  });

  afterEach(() => {
    act(() => tree.unmount());
  });

  test('a single-activity object uses the same activity insertion path', () => {
    const guitar = byTestId(tree, 'world-object:guitar');

    expect(guitar.props.accessibilityRole).toBe('button');
    expect(guitar.props.accessibilityLabel).toContain('Practice');
    act(() => guitar.props.onPress());

    expect(onChooseActivity).toHaveBeenCalledWith('practice');
    expect(tree.root.findAll((node) => node.props.testID === 'world-object-choice')).toHaveLength(0);
  });

  test('a multi-activity object opens an explicit choice and inserts only the chosen option', () => {
    act(() => byTestId(tree, 'world-object:sink').props.onPress());

    expect(onChooseActivity).not.toHaveBeenCalled();
    expect(byTestId(tree, 'world-object-choice')).toBeDefined();
    expect(byTestId(tree, 'world-object-choice:brush').props.accessibilityLabel).toContain('Brush teeth');
    expect(byTestId(tree, 'world-object-choice:quickwash').props.accessibilityLabel).toContain('Quick wash');

    act(() => byTestId(tree, 'world-object-choice:quickwash').props.onPress());

    expect(onChooseActivity).toHaveBeenCalledTimes(1);
    expect(onChooseActivity).toHaveBeenCalledWith('quickwash');
    expect(tree.root.findAll((node) => node.props.testID === 'world-object-choice')).toHaveLength(0);
  });

  test('objects with no activities have no false click target', () => {
    expect(tree.root.findAll((node) => node.props.testID === 'world-object:counter')).toHaveLength(0);
    expect(tree.root.findAll((node) => node.props.testID === 'world-object:tv')).toHaveLength(0);
    expect(tree.root.findAll((node) => node.props.testID === 'world-object:wardrobe')).toHaveLength(0);
  });

  test('the composition root can close the choice panel for Escape and unmount cleanup', () => {
    act(() => byTestId(tree, 'world-object:couch').props.onPress());
    expect(byTestId(tree, 'world-object-choice')).toBeDefined();

    let closed = false;
    act(() => {
      closed = ref.current?.closeChoice() ?? false;
    });

    expect(closed).toBe(true);
    expect(ref.current?.closeChoice()).toBe(false);
    expect(tree.root.findAll((node) => node.props.testID === 'world-object-choice')).toHaveLength(0);
  });
});
