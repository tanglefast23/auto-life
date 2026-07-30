import {
  morningCheckMinute,
  targetsFor,
} from '../../sim/clock';
import { content } from '../../sim/content';
import { toFixed } from '../../sim/fixed';
import { evaluateReactive } from '../../sim/planner/reactive';
import { PrngStreams } from '../../sim/prng';
import { step } from '../../sim/step';
import { deriveSimRules } from '../career-state';
import {
  FixedSeedSource,
  RecordedSeedSource,
  finishIdentityCareer,
  playtestSeedFromSearch,
  prepareIdentityDraft,
  skipIdentityCareer,
  type SeedSource,
  type IdentityDraft,
} from '../new-career';

test('the explicit playtest URL repeats one strict uint32 seed', () => {
  expect(playtestSeedFromSearch('?playtestSeed=1234')).toBe(1234);
  expect(playtestSeedFromSearch('?other=1&playtestSeed=0')).toBe(0);
  expect(playtestSeedFromSearch('?playtestSeed=4294967295')).toBe(
    0xffff_ffff,
  );
  expect(playtestSeedFromSearch('?playtestSeed=-1')).toBeNull();
  expect(playtestSeedFromSearch('?playtestSeed=01')).toBeNull();
  expect(playtestSeedFromSearch('?playtestSeed=4294967296')).toBeNull();
  expect(
    playtestSeedFromSearch(
      '?playtestSeed=1234&playtestSeed=5678',
    ),
  ).toBeNull();

  const source = new FixedSeedSource(1234);
  expect([source.nextSeed(), source.nextSeed()]).toEqual([1234, 1234]);
});

test('one recorded root seed deterministically rolls chronotype plus one preference', () => {
  const first = prepareIdentityDraft(
    new RecordedSeedSource([4242]),
    content,
  );
  const second = prepareIdentityDraft(
    new RecordedSeedSource([4242]),
    content,
  );
  expect(second).toEqual(first);
  expect(first.chronotype).not.toBe('baseline');
  expect(['workout', 'food', 'idle']).toContain(first.secondCategoryId);
});

test('the first SimState is created only after preferences and starts at its wake target', () => {
  const draft = prepareIdentityDraft(
    new RecordedSeedSource([77]),
    content,
  );
  const career = finishIdentityCareer(
    draft,
    {
      name: 'Mika',
      pronouns: {
        subject: 'they',
        object: 'them',
        possessive: 'their',
      },
      appearancePresetId: 'moss-green',
    },
    content,
  );

  expect(career.payload.sim.chronotype).toBe(draft.chronotype);
  expect(career.payload.sim.clock.absoluteMinute).toBe(
    targetsFor(draft.chronotype, content.rates).wake,
  );
  expect(career.payload.identity.activePreferenceCategoryIds).toEqual([
    'chronotype',
    draft.secondCategoryId,
  ]);
  expect(career.payload.identity).not.toHaveProperty('chronotype');
  expect(career.payload.identity).not.toHaveProperty('preferredWorkout');
});

test('inactive preference categories carry no hidden mechanical value', () => {
  const drafts = Array.from({ length: 100 }, (_, seed) =>
    prepareIdentityDraft(new RecordedSeedSource([seed]), content),
  );
  expect(new Set(drafts.map((draft) => draft.secondCategoryId))).toEqual(
    new Set(['workout', 'food', 'idle']),
  );

  for (const draft of drafts) {
    const career = skipIdentityCareer(draft, content);
    const active =
      career.payload.identity.activePreferenceCategoryIds;
    expect(active).toHaveLength(2);
    expect(active).toContain('chronotype');
    expect(career.payload.identity.foodMoodId !== null).toBe(
      active.includes('food'),
    );
    expect(career.payload.identity.idlePreferenceId !== null).toBe(
      active.includes('idle'),
    );
    if (!active.includes('workout')) {
      expect(career.payload.sim.preferredWorkout).toBe('weights');
    }
  }
});

test('skip randomizes identity reproducibly without consuming another root seed', () => {
  class CountingSource implements SeedSource {
    calls = 0;
    nextSeed(): number {
      this.calls += 1;
      return 991;
    }
  }
  const source = new CountingSource();
  const draft = prepareIdentityDraft(source, content);
  const skipped = skipIdentityCareer(draft, content);
  const repeated = skipIdentityCareer(
    prepareIdentityDraft(new RecordedSeedSource([991]), content),
    content,
  );

  expect(source.calls).toBe(1);
  expect(repeated.payload.identity).toEqual(skipped.payload.identity);
  expect(repeated.payload.prng).toEqual(skipped.payload.prng);
  expect(skipped.payload.rootSeed).toBe(991);
});

test('early and owl careers shift every owned clock seam together', () => {
  const traces = (['early', 'owl'] as const).map((chronotype, index) => {
    const rootSeed = 800 + index;
    const draft: IdentityDraft = {
      rootSeed,
      prng: PrngStreams.create(rootSeed).serialize(),
      chronotype,
      secondCategoryId: 'workout',
      secondOptionId: 'weights-person',
    };
    const career = finishIdentityCareer(
      draft,
      {
        name: 'Clock',
        pronouns: {
          subject: 'they',
          object: 'them',
          possessive: 'their',
        },
        appearancePresetId: 'morning-blue',
      },
      content,
    );
    const target = targetsFor(chronotype, content.rates);
    const first = step(career.payload.sim, [], content);
    const reactive = evaluateReactive(
      content.reactive,
      {
        absoluteMinute: target.wake + 60,
        wakeTarget: target.wake,
        bars: {
          energy: toFixed(20),
          nutrition: toFixed(70),
          movement: toFixed(70),
          hygiene: toFixed(70),
        },
      },
      [],
      {},
    );
    career.payload.game.wrinkles.announced = {
      day: 1,
      wrinkleId: 'repair-visit',
      variantId: 'repair-bathroom',
      parameters: {},
    };
    const rules = deriveSimRules(career.payload, content);
    return {
      wake: target.wake,
      bed: target.bed,
      initial: career.payload.sim.clock.absoluteMinute,
      morningCheck: morningCheckMinute(chronotype, content.rates),
      wakeBlock: first.next.queue
        .filter((card) => card.blockId === 'wake#1')
        .map((card) => card.activityId),
      napSuggested: reactive.add.some(
        (item) => item.activityId === 'nap',
      ),
      repairStarts: rules.objectBlocks[0]!.startsAtMinute,
      repairEnds: rules.objectBlocks[0]!.endsAtMinute,
    };
  });

  expect(traces[1]!.wake - traces[0]!.wake).toBe(60);
  expect(traces[1]!.bed - traces[0]!.bed).toBe(60);
  expect(traces[1]!.morningCheck - traces[0]!.morningCheck).toBe(60);
  expect(traces[1]!.repairStarts - traces[0]!.repairStarts).toBe(60);
  expect(traces[1]!.repairEnds - traces[0]!.repairEnds).toBe(60);
  for (const trace of traces) {
    expect(trace.initial).toBe(trace.wake);
    expect(trace.wakeBlock).toEqual([
      'toilet',
      'brush',
      'shower',
      'meal',
    ]);
    expect(trace.napSuggested).toBe(true);
  }
});
