import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { JournalPanel } from '../JournalPanel';
import { JournalIcon } from '../JournalIcon';
import { GameLoop } from '../../application/loop';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import type { SessionState } from '../../game/session';

/**
 * The journal (P8 UI pass).
 *
 * Two records already existed in the session and neither was readable anywhere in the
 * game: the storylet moments were generated, stored, and never shown, and the calendar
 * ledger was only ever glimpsed one day at a time through a recap that dismisses.
 */

const baseSession = new GameLoop(
  newGameState('baseline', content.rates, 1234, content.perks),
  content,
).snapshot.session;

const REGION = { x: 1230, y: 300, width: 240, height: 400 };

const withJournal = (over: Partial<SessionState>): SessionState => ({
  ...baseSession,
  ...over,
});

const mount = (session: SessionState) => {
  const onClose = jest.fn();
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <JournalPanel session={session} region={REGION} onClose={onClose} />,
    );
  });
  return { tree: tree!, onClose };
};

test('the icon is authored pixels, not a platform glyph', () => {
  // Every other icon in this game is authored. A font emoji would render at a different
  // weight on every OS and off-palette on all of them.
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(<JournalIcon size={48} />);
  });
  const icon = tree!.root.findByProps({ testID: 'journal-icon' });
  const pixels = icon.findAll(
    (node) => typeof node.type === 'string' && node.props.style?.backgroundColor,
  );
  expect(pixels.length).toBeGreaterThan(8);
  act(() => tree!.unmount());
});

test('it fills the information column exactly, so opening it never reshapes the screen', () => {
  const { tree } = mount(baseSession);
  const panel = tree.root.findByProps({ testID: 'journal-panel' });
  const style = Object.assign({}, ...[panel.props.style].flat().filter(Boolean));
  expect(style.top).toBe(REGION.y);
  expect(style.height).toBe(REGION.height);
  // Inset by the column's gutter on both sides, like every other surface in it.
  expect(style.left).toBeGreaterThan(REGION.x);
  expect(style.width).toBeLessThan(REGION.width);
  act(() => tree.unmount());
});

test('it opens on Moments and switches to Days', () => {
  const { tree } = mount(baseSession);
  const moments = tree.root.findByProps({ testID: 'journal-tab:entries' });
  const days = tree.root.findByProps({ testID: 'journal-tab:days' });
  expect(moments.props.accessibilityState.selected).toBe(true);
  expect(days.props.accessibilityState.selected).toBe(false);

  act(() => days.props.onPress());
  expect(
    tree.root.findByProps({ testID: 'journal-tab:days' }).props.accessibilityState
      .selected,
  ).toBe(true);
  act(() => tree.unmount());
});

test('an empty journal says so on both tabs rather than showing a blank column', () => {
  const { tree } = mount(baseSession);
  expect(tree.root.findAllByProps({ testID: 'journal-empty:entries' }).length)
    .toBeGreaterThan(0);
  act(() => tree.root.findByProps({ testID: 'journal-tab:days' }).props.onPress());
  expect(tree.root.findAllByProps({ testID: 'journal-empty:days' }).length)
    .toBeGreaterThan(0);
  act(() => tree.unmount());
});

test('moments are listed newest first, with the day and time they happened', () => {
  const session = withJournal({
    journal: {
      nextEntrySeq: 2,
      entries: [
        {
          id: 'journal-0',
          day: 1,
          minuteOfDay: 8 * 60,
          sourceKind: 'idle-moment',
          sourceId: 'idle-couch',
          stringId: 'storylets:idle.couch',
        },
        {
          id: 'journal-1',
          day: 3,
          minuteOfDay: 21 * 60,
          sourceKind: 'milestone',
          sourceId: 'practice-l1',
          stringId: 'storylets:wrinkles.package',
        },
      ],
    },
  });
  const { tree } = mount(session);
  const entries = tree.root.findAll(
    (node) =>
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('journal-entry:') &&
      typeof node.type !== 'string',
  );
  // Newest first: the most recent moment is the one a player is looking for.
  expect(entries.map((n) => n.props.testID)).toEqual([
    'journal-entry:journal-1',
    'journal-entry:journal-0',
  ]);
  act(() => tree.unmount());
});

test('an entry whose storylet no longer exists degrades instead of crashing', () => {
  // A save outlives the copy that wrote it. `storyletString` throws on an unknown id,
  // which would otherwise take the whole panel down when reading old history.
  const session = withJournal({
    journal: {
      nextEntrySeq: 1,
      entries: [
        {
          id: 'journal-0',
          day: 2,
          minuteOfDay: 600,
          sourceKind: 'milestone',
          sourceId: 'gone',
          stringId: 'storylets:removed.since',
        },
      ],
    },
  });
  const { tree } = mount(session);
  expect(
    tree.root.findAllByProps({ testID: 'journal-entry:journal-0' }).length,
  ).toBeGreaterThan(0);
  act(() => tree.unmount());
});

test('closing is one press and reports it once', () => {
  const { tree, onClose } = mount(baseSession);
  act(() => tree.root.findByProps({ testID: 'journal-close' }).props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
