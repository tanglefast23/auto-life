import type { KvStore } from '../../persistence/kv';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import { CAREER_GENERATION_KEYS, CareerRepository } from '../career-repository';
import {
  newCareerState,
  validateCareerContentRefs,
  type StoredCareer,
} from '../career-state';
import { GameLoop } from '../loop';

/**
 * A save may not name content the registry does not have.
 *
 * The game ring was validated at this boundary from the start; the sim ring was not. A
 * save whose queue named `"missing-activity"` therefore passed recovery, built a
 * `GameLoop`, and threw `unknown activity id` out of a frame callback — past the one
 * screen that exists to hand the player their raw blob (SPEC §15).
 */

class MemoryStore implements KvStore {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function baseCareer(): StoredCareer {
  return newCareerState({
    rootSeed: 7,
    sim: newGameState('baseline', content.rates, 7, PrngStreams.create(7).serialize()),
    careerId: 'refs-career',
  });
}

function withSim(mutate: (sim: StoredCareer['payload']['sim']) => void): StoredCareer {
  const career = baseCareer();
  const sim = JSON.parse(JSON.stringify(career.payload.sim)) as StoredCareer['payload']['sim'];
  mutate(sim);
  return { ...career, payload: { ...career.payload, sim } };
}

const poisoned: Record<string, () => StoredCareer> = {
  'queued card': () =>
    withSim((sim) => {
      sim.queue = [
        {
          id: 'poison',
          activityId: 'missing-activity',
          owner: 'PINNED',
          urgent: false,
          source: 'player',
          enqueuedTick: 0,
        },
      ];
    }),
  'queued card block anchor': () =>
    withSim((sim) => {
      sim.queue = [
        {
          id: 'poison',
          activityId: 'read',
          owner: 'AUTO',
          urgent: false,
          source: 'anchor',
          blockId: 'missing-anchor#1',
          reason: { kind: 'anchorWindow', anchorId: 'missing-anchor', targetMinute: 0 },
          enqueuedTick: 0,
        },
      ];
    }),
  'current activity': () =>
    withSim((sim) => {
      sim.current = {
        type: 'activity',
        cardId: 'poison',
        dto: {
          activityId: 'missing-activity',
          durationTicks: 10,
          elapsedTicks: 0,
          fillStartTick: 0,
          effectTotalsFixed: {},
          suppressPassiveEnergy: false,
          sampled: { mSpeed: 1, wellFed: false, effectiveUse: true },
        },
      };
    }),
  'last completion': () =>
    withSim((sim) => {
      sim.lastCompletion = {
        activityId: 'missing-activity',
        isWorkout: false,
        atMinute: 0,
      };
    }),
  suppression: () =>
    withSim((sim) => {
      sim.suppression = { 'missing-activity': 999 };
    }),
  'anchor ledger': () =>
    withSim((sim) => {
      sim.anchorsConsumedOnDay = { 'missing-anchor': 1 };
    }),
};

describe.each(Object.keys(poisoned))('%s', (field) => {
  test('is rejected by the load-boundary validator', () => {
    expect(() => validateCareerContentRefs(poisoned[field]!(), content)).toThrow(
      /unknown (activity|anchor)/,
    );
  });

  test('cannot be written by the repository', async () => {
    const repository = new CareerRepository(new MemoryStore(), content, 'writer');
    await repository.load();
    await expect(repository.save(poisoned[field]!(), 1)).rejects.toThrow(
      /unknown (activity|anchor)/,
    );
  });

  test('routes an already-persisted blob to recovery instead of the loop', async () => {
    const store = new MemoryStore();
    // Write past the repository, as a save from a build whose content still had the id.
    store.values.set(
      CAREER_GENERATION_KEYS[0],
      JSON.stringify({ ...poisoned[field]!(), writerId: 'other', generation: 0 }),
    );
    const repository = new CareerRepository(store, content, 'writer');
    const loaded = await repository.load();
    expect(loaded.status).toBe('recovery');
  });
});

test('an untouched career still loads and ticks', async () => {
  const store = new MemoryStore();
  const repository = new CareerRepository(store, content, 'writer');
  await repository.load();
  const saved = await repository.save(baseCareer(), 1);

  const reloaded = await new CareerRepository(store, content, 'reader').load();
  expect(reloaded.status).toBe('loaded');
  const loop = new GameLoop(saved.payload, content, {});
  expect(() => loop.runOneTick()).not.toThrow();
});
