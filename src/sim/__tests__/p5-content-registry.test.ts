import {
  content,
  validateContentRegistry,
  type ContentRegistry,
} from '../content';

function cloneContent(): ContentRegistry {
  return JSON.parse(JSON.stringify(content)) as ContentRegistry;
}

test('the eight canonical wrinkles own six shapes and two day modifiers', () => {
  expect(
    content.wrinkles.entries.map((entry) => [
      entry.id,
      entry.effect.kind,
    ]),
  ).toEqual([
    ['package-delivery', 'visitor'],
    ['repair-visit', 'blocked-object'],
    ['favorite-show', 'timed-window'],
    ['headache-day', 'slowed-activity'],
    ['slept-great', 'free-time'],
    ['burned-breakfast', 'forced-substitution'],
    ['empty-fridge', 'availability-gate'],
    ['rough-night', 'wake-modifier'],
  ]);

  expect(
    new Set(content.wrinkles.entries.map((entry) => entry.effect.kind)),
  ).toHaveProperty('size', 8);
});

test('P5 content IDs and cross-file references are valid', () => {
  expect(content.goals.goals).toHaveLength(7);
  expect(content.intentions.intentions).toHaveLength(5);
  expect(content.identity.appearancePresets).toHaveLength(4);
  expect(() => validateContentRegistry(cloneContent())).not.toThrow();
});

test('duplicate stable IDs fail at the content boundary', () => {
  const registry = cloneContent();
  registry.goals.goals.push({
    ...registry.goals.goals[0]!,
    order: 99,
  });

  expect(() => validateContentRegistry(registry)).toThrow(
    /duplicate goal id "meet-the-routine"/,
  );
});

test('dangling reward and string references fail at the content boundary', () => {
  const missingReward = cloneContent();
  missingReward.goals.goals[0]!.rewardId = 'missing-reward';
  expect(() => validateContentRegistry(missingReward)).toThrow(
    /goal "meet-the-routine" references unknown reward "missing-reward"/,
  );

  const missingString = cloneContent();
  missingString.goals.goals[0]!.titleStringId = 'goals:missing.title';
  expect(() => validateContentRegistry(missingString)).toThrow(
    /goal "meet-the-routine" references unknown string "goals:missing.title"/,
  );
});

test('invalid wrinkle windows and impossible success conditions fail', () => {
  const invalidWindow = cloneContent();
  const visitor = invalidWindow.wrinkles.entries[0]!;
  if (visitor.effect.kind !== 'visitor') {
    throw new Error('visitor fixture missing');
  }
  visitor.effect.window = [300, 300];
  expect(() => validateContentRegistry(invalidWindow)).toThrow(
    /package-delivery.*invalid window/,
  );

  const impossible = cloneContent();
  impossible.wrinkles.entries[0]!.success = {
    kind: 'activity-completed',
    activityId: 'package',
  };
  expect(() => validateContentRegistry(impossible)).toThrow(
    /package-delivery.*impossible success condition/,
  );
});

test('unowned mechanics and variants without an action fail', () => {
  const unowned = cloneContent();
  (
    unowned.wrinkles.entries[0] as unknown as {
      effect: { kind: string };
    }
  ).effect.kind = 'mystery-mechanic';
  expect(() => validateContentRegistry(unowned)).toThrow(
    /package-delivery.*unowned mechanic "mystery-mechanic"/,
  );

  const noAction = cloneContent();
  delete (
    noAction.wrinkles.entries[0]!.variants[0] as unknown as {
      playerAction?: unknown;
    }
  ).playerAction;
  expect(() => validateContentRegistry(noAction)).toThrow(
    /package-first-home.*no explicit player action/,
  );
});
