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
  offerLetterIfDue,
  respondToLetter,
} from '../../game/letter';
import { content } from '../../sim/content';
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

function repairReady() {
  const session = newSession();
  session.recap.forDay = 2;
  session.wrinkles = {
    ...session.wrinkles,
    firedIds: ['repair-visit'],
    pendingId: 'repair-visit',
    choiceReadyId: 'repair-visit',
    recentDealtIds: ['repair-visit'],
    dealt: [
      {
        day: 2,
        wrinkleId: 'repair-visit',
        variantId: 'repair-bathroom',
        resolved: false,
      },
    ],
    announced: {
      day: 2,
      wrinkleId: 'repair-visit',
      variantId: 'repair-bathroom',
      parameters: {},
    },
  };
  return session;
}

test('the active-goal chip opens all authored goals with explicit progress', () => {
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
  expect(
    byTestId(tree, 'first-session-goal:meet-the-routine')
      .props.accessibilityLabel,
  ).toContain('0/3 activities');
  expect(
    byTestId(tree, 'first-session-goal:meet-the-routine')
      .props.accessibilityLabel,
  ).not.toContain('..');
  for (const goalId of [
    'meet-the-routine',
    'change-of-plans',
    'handle-the-wrinkle',
    'first-chord',
    'find-the-rhythm',
    'balanced-week',
    'holidays-over',
  ]) {
    expect(
      byTestId(tree, `first-session-goal:${goalId}`),
    ).toBeDefined();
  }
  expect(byTestId(tree, 'goals-practice-level')).toBeDefined();
  act(() => tree.unmount());
});

test('ordinary goal progress does not close a player-opened Goals panel', () => {
  const first = newSession();
  const tree = renderUI(
    <FirstSessionUI
      session={first}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
    />,
  );
  act(() =>
    byTestId(tree, 'first-session-goal-chip').props.onPress(),
  );
  const progressed = advanceGame(first, [
    {
      type: 'activityCompleted',
      detail: 'shower',
      atMinute: 500,
    },
  ]).session;
  act(() => {
    tree.update(
      <FirstSessionUI
        session={progressed}
        hudHeight={148}
        onChooseDecoration={jest.fn()}
      />,
    );
  });
  expect(byTestId(tree, 'first-session-goals')).toBeDefined();
  act(() => tree.unmount());
});

test('a fresh-window session update does not close a player-opened Goals panel', () => {
  const first = newSession();
  const tree = renderUI(
    <FirstSessionUI
      session={first}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
    />,
  );
  act(() =>
    byTestId(tree, 'first-session-goal-chip').props.onPress(),
  );
  act(() => {
    tree.update(
      <FirstSessionUI
        session={newSession()}
        hudHeight={148}
        onChooseDecoration={jest.fn()}
      />,
    );
  });
  expect(byTestId(tree, 'first-session-goals')).toBeDefined();
  act(() => tree.unmount());
});

test('Full-routine goals stay visible below Full and explain why they cannot progress', () => {
  const tree = renderUI(
    <FirstSessionUI
      autonomy="essentials-only"
      session={newSession()}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
    />,
  );
  act(() =>
    byTestId(tree, 'first-session-goal-chip').props.onPress(),
  );
  expect(
    byTestId(tree, 'first-session-goal:handle-the-wrinkle')
      .props.accessibilityLabel,
  ).toContain('Requires Full routine');
  expect(
    byTestId(tree, 'first-session-goal:balanced-week')
      .props.accessibilityLabel,
  ).toContain('Requires Full routine');
  act(() => tree.unmount());
});

test('a completed Goal 3 offers its authored decoration choices once', () => {
  const session = newSession();
  session.goals['handle-the-wrinkle'] = {
    status: 'complete',
    counters: { resolvedDaysWithoutUrgent: 1 },
  };
  const onChooseGoalReward = jest.fn();
  const tree = renderUI(
    <FirstSessionUI
      session={session}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
      onChooseGoalReward={onChooseGoalReward}
    />,
  );
  act(() =>
    byTestId(tree, 'first-session-goal-chip').props.onPress(),
  );
  act(() =>
    byTestId(
      tree,
      'goal-reward:handle-the-wrinkle:wrinkle-print',
    ).props.onPress(),
  );
  expect(onChooseGoalReward).toHaveBeenCalledWith(
    'handle-the-wrinkle',
    'wrinkle-print',
  );
  act(() => tree.unmount());
});

test('Goals and Journal filters goal states and shows chronological journal truth', () => {
  const session = repairReady();
  session.unlocks.journal = true;
  session.goals['meet-the-routine'] = {
    status: 'rewarded',
    counters: { activitiesCompleted: 3, whyLineOpened: 1 },
  };
  session.journal = {
    nextEntrySeq: 2,
    entries: [
      {
        id: 'journal-0',
        day: 1,
        minuteOfDay: 1439,
        sourceKind: 'idle-moment',
        sourceId: 'quiet-couch',
        stringId: 'storylets:idle.couch',
      },
      {
        id: 'journal-1',
        day: 2,
        minuteOfDay: 1439,
        sourceKind: 'wrinkle-outcome',
        sourceId: 'repair-van-left',
        stringId: 'storylets:wrinkles.repair',
      },
    ],
  };
  const tree = renderUI(
    <FirstSessionUI
      session={session}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
    />,
  );
  act(() =>
    byTestId(tree, 'first-session-goal-chip').props.onPress(),
  );
  expect(
    byTestId(tree, 'journal-entry:journal-1').props.children,
  ).toBe('Day 2 · The repair van left before lunch.');
  expect(byTestId(tree, 'goals-today-wrinkle')).toBeDefined();

  act(() => byTestId(tree, 'goal-filter:current').props.onPress());
  expect(
    tree.root.findAll(
      (node) =>
        node.props.testID ===
        'first-session-goal:meet-the-routine',
    ),
  ).toHaveLength(0);
  expect(
    byTestId(tree, 'first-session-goal:change-of-plans'),
  ).toBeDefined();
  act(() => tree.unmount());
});

test('the morning chip offers all five intentions and locks one choice', () => {
  const onSelectIntention = jest.fn();
  const tree = renderUI(
    <FirstSessionUI
      session={newSession()}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
      onSelectIntention={onSelectIntention}
    />,
  );

  act(() => byTestId(tree, 'daily-intention-chip').props.onPress());
  expect(byTestId(tree, 'daily-intention-picker')).toBeDefined();
  expect(
    new Set(
      tree.root
        .findAll(
          (node) =>
            typeof node.props.testID === 'string' &&
            node.props.testID.startsWith('daily-intention:'),
        )
        .map((node) => node.props.testID as string),
    ).size,
  ).toBe(5);

  act(() =>
    byTestId(tree, 'daily-intention:practice-focus').props.onPress(),
  );
  expect(onSelectIntention).toHaveBeenCalledWith('practice-focus');
  expect(
    tree.root.findAll(
      (node) => node.props.testID === 'daily-intention-picker',
    ),
  ).toHaveLength(0);
  act(() => tree.unmount());
});

test('turning the morning prompt off leaves the manual Goals picker available', () => {
  const tree = renderUI(
    <FirstSessionUI
      session={newSession()}
      hudHeight={148}
      dailyIntentionPrompt={false}
      onChooseDecoration={jest.fn()}
      onSelectIntention={jest.fn()}
    />,
  );
  expect(
    tree.root.findAll(
      (node) => node.props.testID === 'daily-intention-chip',
    ),
  ).toHaveLength(0);

  act(() =>
    byTestId(tree, 'first-session-goal-chip').props.onPress(),
  );
  expect(byTestId(tree, 'goals-choose-intention')).toBeDefined();
  act(() => tree.unmount());
});

test('Practice focus offers one-click protected block insertion without auto-enqueue', () => {
  const session = newSession();
  session.intentions.today = {
    day: 1,
    intentionId: 'practice-focus',
    deliberate: true,
    selectedAtMinute: 450,
    biasTargetCompletedAtMinute: null,
  };
  const onAddProtectedPractice = jest.fn();
  const tree = renderUI(
    <FirstSessionUI
      session={session}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
      onSelectIntention={jest.fn()}
      onAddProtectedPractice={onAddProtectedPractice}
    />,
  );

  act(() =>
    byTestId(tree, 'first-session-goal-chip').props.onPress(),
  );
  act(() =>
    byTestId(tree, 'goals-add-practice-block').props.onPress(),
  );
  expect(onAddProtectedPractice).toHaveBeenCalledTimes(1);
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

test('a Day-2 wrinkle is announced, actionable, and remains reviewable from its chip', () => {
  const onTakeWrinkleAction = jest.fn();
  const tree = renderUI(
    <FirstSessionUI
      session={repairReady()}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
      onTakeWrinkleAction={onTakeWrinkleAction}
    />,
  );

  expect(
    byTestId(tree, 'daily-wrinkle-panel').props.accessibilityLabel,
  ).toContain('The repair van is outside');
  act(() =>
    byTestId(tree, 'daily-wrinkle-action').props.onPress(),
  );
  expect(onTakeWrinkleAction).toHaveBeenCalledWith(
    'repair-visit',
    'plan-around-repair',
  );
  expect(
    tree.root.findAll(
      (node) => node.props.testID === 'daily-wrinkle-panel',
    ),
  ).toHaveLength(0);

  act(() => byTestId(tree, 'daily-wrinkle-chip').props.onPress());
  expect(byTestId(tree, 'daily-wrinkle-panel')).toBeDefined();
  act(() => tree.unmount());
});

test('the wake recap is shown before the new daily wrinkle', () => {
  const session = repairReady();
  session.morningRecap = {
    ...session.recap,
    forDay: 1,
  };
  const tree = renderUI(
    <FirstSessionUI
      session={session}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
      onTakeWrinkleAction={jest.fn()}
    />,
  );

  expect(byTestId(tree, 'first-session-recap')).toBeDefined();
  expect(
    tree.root.findAll(
      (node) => node.props.testID === 'daily-wrinkle-panel',
    ),
  ).toHaveLength(0);

  act(() =>
    byTestId(tree, 'first-session-recap:done').props.onPress(),
  );
  expect(byTestId(tree, 'daily-wrinkle-panel')).toBeDefined();
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
  morning.morningRecap = {
    ...morning.morningRecap!,
    endingBars: {
      energy: 420_000,
      nutrition: 360_000,
      movement: 300_000,
      hygiene: 480_000,
    },
    priorEndingBars: {
      energy: 360_000,
      nutrition: 360_000,
      movement: 360_000,
      hygiene: 420_000,
    },
    wrinkleOutcomeId: 'package-delivery',
    goalProgressIds: ['meet-the-routine'],
    rewardIds: ['journal'],
    journalEntryId: 'journal-0',
  };
  morning.journal = {
    nextEntrySeq: 1,
    entries: [
      {
        id: 'journal-0',
        day: 1,
        minuteOfDay: 1439,
        sourceKind: 'wrinkle-outcome',
        sourceId: 'package-on-counter',
        stringId: 'storylets:wrinkles.package',
      },
    ],
  };
  morning.wrinkles.dealt = [
    {
      day: 1,
      wrinkleId: 'package-delivery',
      variantId: 'package-first-home',
      resolved: true,
    },
  ];
  const tree = renderUI(
    <FirstSessionUI
      session={morning}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
    />,
  );

  expect(byTestId(tree, 'first-session-recap').props.accessibilityLabel).toContain('Missed routine: Morning routine.');
  expect(
    byTestId(tree, 'first-session-recap').props.accessibilityLabel,
  ).toContain('Energy 70 (+10)');
  expect(
    byTestId(tree, 'first-session-recap').props.accessibilityLabel,
  ).toContain('The box sat by the kitchen counter.');
  expect(byTestId(tree, 'first-session-recap-announcement').props.accessibilityLiveRegion).toBe('polite');

  act(() => byTestId(tree, 'first-session-recap:details').props.onPress());
  expect(byTestId(tree, 'first-session-recap:expanded')).toBeDefined();
  expect(
    byTestId(tree, 'first-session-recap:expanded').findAll(
      (node) =>
        node.props.children === 'Meet the routine' ||
        node.props.children === 'Journal',
    ).length,
  ).toBeGreaterThan(0);

  act(() => byTestId(tree, 'first-session-recap:done').props.onPress());
  expect(tree.root.findAll((node) => node.props.testID === 'first-session-recap')).toHaveLength(0);
  act(() => tree.unmount());
});

test('the Day-8 letter blocks ordinary panels and shows the terminal accepted promise', () => {
  const ref = createRef<FirstSessionUIHandle | null>();
  const onRespond = jest.fn();
  const due = offerLetterIfDue(newSession(), 10);
  const render = (session = due) => (
    <FirstSessionUI
      ref={ref}
      session={session}
      hudHeight={148}
      onChooseDecoration={jest.fn()}
      onRespondToLetter={onRespond}
      practicePoints100={30_000}
    />
  );
  const tree = renderUI(render());

  expect(byTestId(tree, 'day-eight-letter')).toBeDefined();
  expect(
    byTestId(tree, 'day-eight-letter').props.accessibilityLabel,
  ).toContain('paused for your answer');
  let opened = true;
  let closed = false;
  act(() => {
    opened = ref.current?.openGoals() ?? true;
    closed = ref.current?.closePanels() ?? false;
  });
  expect(opened).toBe(false);
  expect(closed).toBe(true);

  act(() =>
    byTestId(tree, 'day-eight-letter:accept').props.onPress(),
  );
  expect(onRespond).toHaveBeenCalledWith('accept');

  const accepted = respondToLetter(
    due,
    'accept',
    10,
    30_000,
    content.practice.levels,
  );
  act(() => tree.update(render(accepted)));
  expect(byTestId(tree, 'day-eight-letter:accepted')).toBeDefined();
  expect(
    byTestId(tree, 'day-eight-letter:accepted').props
      .accessibilityLabel,
  ).toContain('Your first shift begins in the next one.');

  act(() =>
    byTestId(tree, 'day-eight-letter:done').props.onPress(),
  );
  expect(
    tree.root.findAll(
      (node) => node.props.testID === 'day-eight-letter:accepted',
    ),
  ).toHaveLength(0);

  act(() => {
    ref.current?.openGoals();
  });
  expect(
    byTestId(tree, 'goals-letter-summary').findAll(
      (node) =>
        typeof node.props.children === 'string' &&
        node.props.children.includes('next chapter'),
    ).length,
  ).toBeGreaterThan(0);
  act(() => tree.unmount());
});

test('the Goals shortcut opens the panel, Escape closes it, and reset clears presentation', () => {
  const ref = createRef<FirstSessionUIHandle | null>();
  const tree = renderUI(
    <FirstSessionUI
      ref={ref}
      session={newSession()}
      presentationKey="career-a"
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
        presentationKey="career-b"
        hudHeight={148}
        onChooseDecoration={jest.fn()}
      />,
    );
  });
  expect(tree.root.findAll((node) => node.props.testID === 'first-session-goals')).toHaveLength(0);
  expect(tree.root.findAll((node) => node.props.testID === 'first-session-recap')).toHaveLength(0);
  act(() => tree.unmount());
});
