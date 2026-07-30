import { act, create } from 'react-test-renderer';
import {
  defaultIdentity,
  newAppPreferencesEnvelope,
} from '../../application/career-state';
import { PauseSettings } from '../PauseSettings';

function setup(overrides: Partial<
  React.ComponentProps<typeof PauseSettings>
> = {}) {
  const callbacks = {
    onResume: jest.fn(),
    onOpenGoals: jest.fn(),
    onNewGame: jest.fn(),
    onReturnToTitle: jest.fn(),
    onPreferences: jest.fn(),
    onIdentity: jest.fn(),
    onAutonomy: jest.fn(),
  };
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <PauseSettings
        autonomy="full-routine"
        error={null}
        identity={defaultIdentity()}
        lastSavedAt={null}
        preferences={newAppPreferencesEnvelope()}
        {...callbacks}
        {...overrides}
      />,
    );
  });
  return { tree, callbacks };
}

test('pause menu exposes every required route', () => {
  const { tree } = setup();
  for (const testID of [
    'pause-resume',
    'pause-settings',
    'pause-goals',
    'pause-new-game',
    'pause-return-title',
  ]) {
    expect(tree.root.findByProps({ testID })).toBeDefined();
  }
  act(() => tree.unmount());
});

test('settings show all eight groups and keep global and career updates separate', () => {
  const { tree, callbacks } = setup();
  act(() => {
    tree.root.findByProps({ testID: 'pause-settings' }).props.onPress();
  });
  const text = tree.root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children)
    .join(' ');
  for (const heading of [
    'Audio',
    'Gameplay',
    'Display',
    'Accessibility',
    'Controls',
    'Sim',
    'Data',
    'About',
  ]) {
    expect(text).toContain(heading);
  }

  const speedOptions = tree.root
    .findByProps({ testID: 'settings-default-speed' })
    .findAll(
      (node) =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function',
    );
  expect(
    speedOptions.map((option) => option.props['aria-checked']),
  ).toEqual([true, false, false]);
  expect(
    tree.root
      .findAll(
        (node) =>
          node.props.accessibilityRole === 'switch' &&
          typeof node.props.onPress === 'function',
      )
      .every(
        (node) => typeof node.props['aria-checked'] === 'boolean',
      ),
  ).toBe(true);
  act(() => speedOptions[1]!.props.onPress());
  expect(callbacks.onPreferences).toHaveBeenCalledWith(
    expect.objectContaining({
      preferences: expect.objectContaining({
        gameplay: expect.objectContaining({ defaultSpeed: 2 }),
      }),
    }),
  );
  expect(callbacks.onAutonomy).not.toHaveBeenCalled();

  const autonomyOptions = tree.root
    .findByProps({ testID: 'settings-autonomy' })
    .findAll(
      (node) =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function',
    );
  act(() => autonomyOptions[2]!.props.onPress());
  expect(callbacks.onAutonomy).toHaveBeenCalledWith('reactive-only');
  act(() => tree.unmount());
});

test('identity edits save through the identity owner', () => {
  const { tree, callbacks } = setup({ initialPage: 'settings' });
  act(() => {
    tree.root.findByProps({ testID: 'settings-name' }).props.onChangeText(
      '  Ren  ',
    );
  });
  act(() => {
    tree.root
      .findByProps({ testID: 'settings-save-identity' })
      .props.onPress();
  });
  expect(callbacks.onIdentity).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Ren' }),
  );
  act(() => tree.unmount());
});

test('New Game requires a second deliberate confirmation', () => {
  const { tree, callbacks } = setup();
  act(() => {
    tree.root.findByProps({ testID: 'pause-new-game' }).props.onPress();
  });
  expect(callbacks.onNewGame).not.toHaveBeenCalled();
  expect(
    tree.root.findByProps({ testID: 'new-game-confirmation' }),
  ).toBeDefined();
  act(() => {
    tree.root.findByProps({ testID: 'confirm-new-game' }).props.onPress();
  });
  expect(callbacks.onNewGame).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('title settings expose global preferences without career controls', () => {
  const { tree, callbacks } = setup({
    careerAvailable: false,
    initialPage: 'settings',
    showPauseMenu: false,
  });
  expect(
    tree.root.findAllByProps({ testID: 'settings-autonomy' }),
  ).toHaveLength(0);
  expect(
    tree.root.findAllByProps({ testID: 'settings-save-identity' }),
  ).toHaveLength(0);
  expect(
    tree.root.findAllByProps({ testID: 'settings-reset' }),
  ).toHaveLength(0);
  act(() => {
    tree.root.findByProps({ testID: 'settings-back' }).props.onPress();
  });
  expect(callbacks.onResume).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
