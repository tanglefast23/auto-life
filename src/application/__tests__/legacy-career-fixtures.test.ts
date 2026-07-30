import engineV6 from '../__fixtures__/engine-v6-career.json';
import engineV7 from '../__fixtures__/engine-v7-career.json';
import { content } from '../../sim/content';
import { ENGINE_VERSION } from '../../sim/version';
import {
  migrateLegacyCareerFixture,
  restoreCareerState,
} from '../career-state';

describe('P5 synthetic compatibility fixtures', () => {
  test.each([
    ['v6', engineV6, 6],
    ['v7', engineV7, 7],
  ] as const)('%s migrates to the current career envelope', (_label, fixture, version) => {
    expect(fixture).toMatchObject({
      fixtureVersion: 1,
      sourceEngineVersion: version,
      synthetic: true,
      rootSeed: 1234,
    });
    const migrated = migrateLegacyCareerFixture(fixture, content);
    expect(migrated.engineVersion).toBe(ENGINE_VERSION);
    expect(migrated.payload.sim.engineVersion).toBe(ENGINE_VERSION);
    expect(migrated.payload).not.toHaveProperty('speed');
    expect(migrated.payload.sim).not.toHaveProperty('prng');
    expect(migrated.payload.prng).toEqual(fixture.sim.prng);
    expect(restoreCareerState(JSON.parse(JSON.stringify(migrated)))).toEqual(
      migrated,
    );
  });

  test('v6 captures the P4 mid-run/save-relevant seams', () => {
    expect(engineV6.sim.current).not.toBeNull();
    expect(engineV6.sim.removalReceipt).not.toBeNull();
    expect(engineV6.game.wrinkles.resolvedIds).toContain('package-delivery');
    expect(engineV6.game.decorations.grantedIds).toContain('sunny-vase');
    expect(
      migrateLegacyCareerFixture(engineV6, content).payload.prng.streams,
    ).toEqual(
      expect.objectContaining({
        wrinkles: expect.any(Object),
        storylets: expect.any(Object),
        relationships: expect.any(Object),
        careerEvents: expect.any(Object),
        cosmetic: expect.any(Object),
      }),
    );
  });

  test('v7 captures the post-audit travel and pinned-reactive seams', () => {
    expect(engineV7.sim.current).toMatchObject({
      type: 'travel',
      cardId: 'c0',
    });
    expect(
      engineV7.sim.queue.find((card) => card.id === 'c0'),
    ).toMatchObject({
      source: 'anchor',
      blockId: 'lunch#1',
    });
    expect(
      engineV7.sim.queue.find((card) => card.id === 'audit-pinned-shower'),
    ).toMatchObject({
      owner: 'PINNED',
      source: 'reactive',
    });
    const migrated = migrateLegacyCareerFixture(engineV7, content);
    expect(migrated.payload.sim.current).toMatchObject({
      type: 'travel',
      cardId: 'c0',
    });
    expect(migrated.payload.game.goals).toHaveProperty(
      'meet-the-routine',
    );
  });
});
