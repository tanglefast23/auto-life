import { createHash } from 'node:crypto';
import { content } from '../../sim/content';
import { forecast } from '../../sim/forecast';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  canonicalCareerPayload,
  deriveSimRules,
  newAppPreferencesEnvelope,
  newCareerState,
  restoreCareerState,
  validateCareerContentRefs,
} from '../career-state';

const ROOT_SEED = 1234;

function freshCareer() {
  const prng = PrngStreams.create(ROOT_SEED).serialize();
  const sim = newGameState(
    'early',
    content.rates,
    ROOT_SEED,
    prng,
  );
  return newCareerState({
    rootSeed: ROOT_SEED,
    sim,
    prng,
    careerId: 'career-test',
  });
}

test('the complete P5 career envelope round-trips without session-only state', () => {
  const career = freshCareer();
  career.payload.pendingCommands.push({
    type: 'insertPlayer',
    activityId: 'practice',
  });
  career.payload.pendingGameActions.push({
    type: 'forecastChangeObserved',
  });
  expect(
    restoreCareerState(JSON.parse(JSON.stringify(career))),
  ).toEqual(career);
  expect(() => validateCareerContentRefs(career, content)).not.toThrow();

  expect(career.payload).toEqual(
    expect.objectContaining({
      autonomy: 'full-routine',
      pendingCommands: [
        { type: 'insertPlayer', activityId: 'practice' },
      ],
      pendingGameActions: [{ type: 'forecastChangeObserved' }],
      rulesRevision: 0,
    }),
  );
  expect(career.payload).not.toHaveProperty('speed');
  expect(career.payload).not.toHaveProperty('openPanel');
  expect(career.payload).not.toHaveProperty('interpolationAlpha');
  expect(career.payload.sim).not.toHaveProperty('prng');
});

test('app preferences use a separate strict versioned envelope', () => {
  const envelope = newAppPreferencesEnvelope();
  expect(envelope).toMatchObject({
    schemaVersion: 1,
    preferences: {
      gameplay: { defaultSpeed: 1 },
      audio: { muted: false },
    },
  });
  expect(careerKeys(freshCareer())).not.toContain('preferences');
});

test('announced mechanics derive one immutable SimRules value', () => {
  const career = freshCareer();
  career.payload.game.wrinkles.announced = {
    day: 2,
    wrinkleId: 'repair-visit',
    variantId: 'repair-bathroom',
    parameters: {},
  };
  career.payload.rulesRevision = 4;
  const rules = deriveSimRules(career.payload, content);

  expect(rules).toMatchObject({
    revision: 4,
    autonomy: 'full-routine',
    objectBlocks: [
      {
        objectId: 'shower',
        fallbackActivityId: 'quickwash',
      },
    ],
  });
  expect(rules.key).toMatch(/^rules-v1-[a-f0-9]{8}$/);
  expect(Object.isFrozen(rules)).toBe(true);
});

test('forecasting consumes no live career stream', () => {
  const career = freshCareer();
  const before = JSON.stringify(career.payload.prng);
  const rules = deriveSimRules(career.payload, content);

  forecast(career.payload.sim, content, rules);

  expect(JSON.stringify(career.payload.prng)).toBe(before);
});

test('the canonical CareerState payload has a reviewed engine-v10 digest', () => {
  const digest = createHash('sha256')
    .update(canonicalCareerPayload(freshCareer().payload))
    .digest('hex');
  expect(digest).toBe(
    'e838e9fbeafaeb8d901d2eb936193361fa127d74d682a07df7ad111346b990de',
  );
});

test('career content references are checked before a loop can use them', () => {
  const career = freshCareer();
  career.payload.game.intentions.today = {
    day: 1,
    intentionId: 'missing-intention',
    deliberate: true,
    selectedAtMinute: 390,
    biasTargetCompletedAtMinute: null,
  };
  expect(() => validateCareerContentRefs(career, content)).toThrow(
    /unknown intention "missing-intention"/,
  );
});

test('a pending wrinkle action must belong to its wrinkle', () => {
  const career = freshCareer();
  career.payload.pendingGameActions.push({
    type: 'wrinkleAction',
    wrinkleId: 'repair-visit',
    actionId: 'clear-headache',
  });

  expect(() => validateCareerContentRefs(career, content)).toThrow(
    /unknown wrinkle action "repair-visit\/clear-headache"/,
  );
});

function careerKeys(value: unknown): string[] {
  if (value === null || typeof value !== 'object') return [];
  return Object.keys(value);
}
