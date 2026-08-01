import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { content } from '../../sim/content';
import type { CharacterView, GradeView } from '../../sim/step';
import { CharacterPanel } from '../CharacterPanel';
import { RollBanner } from '../RollBanner';
import { gradeLabel, statLabel } from '../character-copy';
import { ROLL_BEATS, ROLL_SEQUENCE_MS } from '../../render/motion';

/**
 * docs/08 §11 mounted. The assertion that matters most here is number 8 — the reveal
 * cannot lie: the letter on screen is the grade the engine applied, never a fresh draw.
 */

const grade = (over: Partial<GradeView> = {}): GradeView => ({
  activityId: 'meal',
  cardId: 'card-1',
  gradeId: 'b-plus',
  band: 'high',
  natural: 17,
  shape: 'plain',
  modifier: 2,
  statId: 'dexterity',
  deltas: { nutrition: 7 },
  practicePoints: null,
  ...over,
});

const render = (view: GradeView, reducedMotion = false): ReactTestRenderer => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <RollBanner
        grade={view}
        gradeLabel={gradeLabel(view.gradeId)}
        statLabel={view.statId === null ? null : statLabel(view.statId)}
        activityLabel="Meal"
        reducedMotion={reducedMotion}
      />,
    );
  });
  return tree;
};

const textOf = (tree: ReactTestRenderer, testID: string): string => {
  const host = tree.root.findAllByProps({ testID })[0]!;
  const nodes = host.type === Text ? [host] : host.findAllByType(Text);
  return nodes
    .flatMap((node) => node.props.children as unknown)
    .flat()
    .filter((child: unknown) => typeof child === 'string' || typeof child === 'number')
    .join('');
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

test('the die settles on the number the engine rolled, and the grade is the engine’s grade', () => {
  const view = grade();
  const tree = render(view);
  act(() => {
    jest.advanceTimersByTime(ROLL_SEQUENCE_MS);
  });
  // Assertion 8: what is stamped is exactly what the engine applied — no second draw here.
  expect(textOf(tree, 'roll-die')).toBe(String(view.natural));
  expect(textOf(tree, 'roll-grade')).toBe(gradeLabel(view.gradeId));
  tree.unmount();
});

test('the beats arrive in order: die, then grade, then the delivered delta', () => {
  const tree = render(grade());
  expect(tree.root.findAllByProps({ testID: 'roll-die' }).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({ testID: 'roll-grade' })).toHaveLength(0);

  act(() => {
    jest.advanceTimersByTime(ROLL_BEATS.grade + 32);
  });
  expect(tree.root.findAllByProps({ testID: 'roll-grade' }).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({ testID: 'roll-deltas' })).toHaveLength(0);

  act(() => {
    jest.advanceTimersByTime(ROLL_BEATS.bar - ROLL_BEATS.grade + 32);
  });
  expect(tree.root.findAllByProps({ testID: 'roll-deltas' }).length).toBeGreaterThan(0);
  tree.unmount();
});

test('reduced motion keeps every state change and drops only the tweens', () => {
  // No ticker at all: the die is already on its face, the grade is already stamped, and the
  // delta is already shown. SPEC §11.6 removes the travelling, never the information.
  const tree = render(grade(), true);
  expect(textOf(tree, 'roll-die')).toBe('17');
  expect(tree.root.findAllByProps({ testID: 'roll-grade' }).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({ testID: 'roll-deltas' }).length).toBeGreaterThan(0);
  tree.unmount();
});

test('the whole beat is announced as one sentence, not three fragments', () => {
  const tree = render(grade({ shape: 'advantage', deltas: { nutrition: 7 } }));
  const label = tree.root.findAllByProps({ testID: 'roll-banner' })[0]!.props
    .accessibilityLabel as string;
  expect(label).toContain('Meal complete.');
  expect(label).toContain('Rolled 17 with advantage.');
  expect(label).toContain('B plus.');
  expect(label).toContain('nutrition plus 7.');
  tree.unmount();
});

test('a practice grade reports points rather than a bar', () => {
  const tree = render(
    grade({ activityId: 'practice', statId: 'intellect', deltas: {}, practicePoints: 4.2 }),
  );
  act(() => {
    jest.advanceTimersByTime(ROLL_SEQUENCE_MS);
  });
  expect(textOf(tree, 'roll-deltas')).toContain('+4.2 pts');
  tree.unmount();
});

test('the character panel shows every stat, marks the inert one, and lists the rolled traits', () => {
  const character: CharacterView = {
    stats: [
      { id: 'strength', level: 5, xp: 250, progress: 0.5, live: true },
      { id: 'dexterity', level: 6, xp: 0, progress: 0, live: true },
      { id: 'vitality', level: 4, xp: 100, progress: 0.25, live: true },
      { id: 'intellect', level: 7, xp: 350, progress: 0.5, live: true },
      // Rolled, shown, and honestly labelled as not yet in use — docs/08 §4.
      { id: 'charisma', level: 6, xp: 0, progress: 0, live: false },
    ],
    perkIds: content.perks.families
      .filter((family) => family.since <= 1)
      .map((family) => family.options[0]!.id),
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<CharacterPanel character={character} />);
  });
  for (const stat of character.stats) {
    expect(tree.root.findAllByProps({ testID: `character-stat:${stat.id}` }).length).toBeGreaterThan(0);
    // A stat with nothing to do yet shows its level but no progress bar — there is no
    // progress to make, and a permanently empty track would read as neglect.
    expect(
      tree.root.findAllByProps({ testID: `character-xp:${stat.id}` }).length > 0,
    ).toBe(stat.live);
  }
  for (const perkId of character.perkIds) {
    expect(tree.root.findAllByProps({ testID: `character-perk:${perkId}` }).length).toBeGreaterThan(0);
  }
  act(() => {
    tree.unmount();
  });
});
