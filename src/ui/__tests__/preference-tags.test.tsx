import { act, create } from 'react-test-renderer';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  defaultIdentity,
  newCareerState,
} from '../../application/career-state';
import { GameLoop } from '../../application/loop';
import { FirstSessionUI } from '../FirstSessionUI';
import { buildPaletteGroups } from '../QueueStrip';
import {
  careerPreferenceTags,
  preferenceReaction,
} from '../preference-tags';

function career() {
  const seed = 5151;
  const prng = PrngStreams.create(seed).serialize();
  return newCareerState({
    rootSeed: seed,
    identity: defaultIdentity(),
    prng,
    sim: newGameState('early', content.rates, seed, prng),
  });
}

test('only the two active preferences become visible tags', () => {
  const current = career();
  const tags = careerPreferenceTags(current);
  expect(tags).toHaveLength(2);
  expect(tags.map((tag) => tag.categoryId)).toEqual([
    'chronotype',
    'workout',
  ]);
  expect(
    tags.find((tag) => tag.categoryId === 'workout')?.activityIds,
  ).toEqual(['weights']);
});

test('relevant activity cards receive the active preference tag', () => {
  const current = career();
  const tags = careerPreferenceTags(current);
  const snapshot = new GameLoop(current.payload, content).snapshot;
  const activities = buildPaletteGroups(snapshot, tags).flatMap(
    (group) => group.activities,
  );
  expect(
    activities.find((activity) => activity.id === 'weights')
      ?.preferenceLabels,
  ).toContain('Prefers weights');
  expect(
    activities.find((activity) => activity.id === 'treadmill')
      ?.preferenceLabels,
  ).toEqual([]);
});

test('respect is happy, while only repeated overrides produce a grumble', () => {
  const tags = careerPreferenceTags(career());
  expect(preferenceReaction(['weights'], tags)).toEqual({
    kind: 'happy',
    label: 'Prefers weights',
  });
  expect(preferenceReaction(['treadmill'], tags)).toBeNull();
  expect(
    preferenceReaction(['treadmill', 'treadmill'], tags),
  ).toEqual({
    kind: 'grumble',
    label: 'Prefers weights',
  });
});

test('the Goals and Journal surface repeats both visible habits', () => {
  const current = career();
  const labels = careerPreferenceTags(current).map((tag) => tag.label);
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <FirstSessionUI
        hudHeight={148}
        onChooseDecoration={() => undefined}
        preferenceLabels={labels}
        session={current.payload.game}
      />,
    );
  });
  act(() => {
    tree.root
      .findByProps({ testID: 'first-session-goal-chip' })
      .props.onPress();
  });
  expect(
    tree.root.findByProps({ testID: 'goals-preference-tags' })
      .props.accessibilityLabel.split(', '),
  ).toEqual(labels);
  act(() => tree.unmount());
});
