import { act, create } from 'react-test-renderer';
import { content } from '../../sim/content';
import { RecordedSeedSource, prepareIdentityDraft } from '../../application/new-career';
import {
  IdentityShell,
  RecoveryShell,
  ResumeNotice,
  TitleShell,
} from '../AppShell';
import type { ReactElement } from 'react';

function render(element: ReactElement): ReturnType<typeof create> {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(element);
  });
  return tree;
}

test('title opens the identity path', () => {
  const onNewGame = jest.fn();
  const tree = render(<TitleShell onNewGame={onNewGame} />);
  act(() => {
    tree.root.findByProps({ testID: 'title-new-game' }).props.onPress();
  });
  expect(onNewGame).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('identity shows exactly two rolled habits and all four appearance presets', () => {
  const onComplete = jest.fn();
  const draft = prepareIdentityDraft(
    new RecordedSeedSource([4242]),
    content,
  );
  const tree = render(
    <IdentityShell
      busy={false}
      content={content}
      draft={draft}
      error={null}
      onComplete={onComplete}
      onSkip={() => undefined}
    />,
  );

  expect(
    content.identity.appearancePresets.every(
      (preset) =>
        tree.root.findByProps({
          testID: `appearance-${preset.id}`,
        }) !== undefined,
    ),
  ).toBe(true);
  expect(
    content.identity.appearancePresets.map(
      (preset) =>
        tree.root.findByProps({
          testID: `appearance-${preset.id}`,
        }).props['aria-checked'],
    ),
  ).toEqual(
    content.identity.appearancePresets.map(
      (preset, index) => index === 0,
    ),
  );
  expect(
    tree.root
      .findAll(
        (node) =>
          node.props.accessibilityRole === 'radio' &&
          typeof node.props.onPress === 'function',
      )
      .every(
        (node) => typeof node.props['aria-checked'] === 'boolean',
      ),
  ).toBe(true);
  expect(
    tree.root
      .findByProps({ testID: 'identity-preference-tags' })
      .props.accessibilityLabel.split(', '),
  ).toHaveLength(2);

  act(() => {
    tree.root.findByProps({ testID: 'identity-name' }).props.onChangeText(
      '  Mika  ',
    );
  });
  act(() => {
    tree.root.findByProps({ testID: 'identity-start' }).props.onPress();
  });
  expect(onComplete).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Mika' }),
  );
  act(() => tree.unmount());
});

test('identity offers a Back to game route only when provided', () => {
  const draft = prepareIdentityDraft(
    new RecordedSeedSource([4242]),
    content,
  );
  const onBack = jest.fn();
  const tree = render(
    <IdentityShell
      busy={false}
      content={content}
      draft={draft}
      error={null}
      onBack={onBack}
      onComplete={jest.fn()}
      onSkip={jest.fn()}
    />,
  );

  act(() => {
    tree.root.findByProps({ testID: 'identity-back' }).props.onPress();
  });
  expect(onBack).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('recovery requires two deliberate presses before starting fresh', () => {
  const onStartFresh = jest.fn();
  const tree = render(
    <RecoveryShell
      blobs={[
        {
          key: 'career/generation-2',
          raw: '{broken',
          error: 'invalid JSON',
        },
      ]}
      copyState="idle"
      onCopy={() => undefined}
      onStartFresh={onStartFresh}
    />,
  );

  act(() => {
    tree.root
      .findByProps({ testID: 'recovery-start-fresh' })
      .props.onPress();
  });
  expect(onStartFresh).not.toHaveBeenCalled();
  act(() => {
    tree.root
      .findByProps({ testID: 'recovery-confirm-fresh' })
      .props.onPress();
  });
  expect(onStartFresh).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('returning notice says no away time moved', () => {
  const tree = render(
    <ResumeNotice fallback={false} onDismiss={() => undefined} />,
  );
  const text = tree.root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children)
    .join(' ');
  expect(text).toContain('Nothing moved while you were away.');
  act(() => tree.unmount());
});
