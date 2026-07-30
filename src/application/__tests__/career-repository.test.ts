import engineV7 from '../__fixtures__/engine-v7-career.json';
import type { KvStore } from '../../persistence/kv';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import { bootApplication, type BootState } from '../boot';
import {
  APP_PREFERENCES_KEY,
  AppPreferencesRepository,
  CAREER_GENERATION_KEYS,
  CAREER_RESET_FENCE_KEY,
  CareerRepository,
  StaleCareerWriterError,
} from '../career-repository';
import {
  newAppPreferencesEnvelope,
  newCareerState,
  type StoredCareer,
} from '../career-state';

class FakeKvStore implements KvStore {
  readonly values = new Map<string, string>();
  readonly setStarts: string[] = [];
  readonly barrierStarts: string[] = [];
  private readonly listeners = new Set<
    (key: string, value: string | null) => void
  >();
  private blockedSet:
    | {
        release: () => void;
        promise: Promise<void>;
      }
    | undefined;
  private failKey: string | null = null;

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.setStarts.push(key);
    if (this.blockedSet !== undefined) {
      const blocked = this.blockedSet;
      this.blockedSet = undefined;
      await blocked.promise;
    }
    if (this.failKey === key) {
      this.failKey = null;
      throw new Error(`rejected write for ${key}`);
    }
    this.values.set(key, value);
    for (const listener of this.listeners) listener(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
    for (const listener of this.listeners) listener(key, null);
  }

  getItemBarrier(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItemBarrier(key: string, value: string): void {
    this.barrierStarts.push(key);
    this.values.set(key, value);
    for (const listener of this.listeners) listener(key, value);
  }

  subscribe(
    listener: (key: string, value: string | null) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  blockNextSet(): () => void {
    let release: () => void = () => {};
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.blockedSet = { promise, release };
    return release;
  }

  failNextSetFor(key: string): void {
    this.failKey = key;
  }
}

function freshCareer(
  seed = 1234,
  careerId = `career-${seed}`,
): StoredCareer {
  const prng = PrngStreams.create(seed).serialize();
  return newCareerState({
    rootSeed: seed,
    sim: newGameState(
      'baseline',
      content.rates,
      seed,
      prng,
    ),
    prng,
    careerId,
  });
}

async function savedCareer(
  store: FakeKvStore,
  count: number,
): Promise<StoredCareer> {
  const repository = new CareerRepository(
    store,
    content,
    'writer-a',
  );
  await repository.load();
  let career = freshCareer();
  for (let index = 0; index < count; index += 1) {
    career = await repository.save(career, index + 1);
  }
  return career;
}

test('three fixed generations rotate and newest corruption falls back exactly one', async () => {
  const store = new FakeKvStore();
  const newest = await savedCareer(store, 4);
  expect(newest.generation).toBe(3);
  expect(
    CAREER_GENERATION_KEYS.every((key) => store.values.has(key)),
  ).toBe(true);

  const broken = JSON.parse(
    store.values.get(CAREER_GENERATION_KEYS[0])!,
  ) as StoredCareer;
  (broken.payload.sim.bars as unknown as { energy: unknown }).energy =
    'corrupt';
  store.values.set(CAREER_GENERATION_KEYS[0], JSON.stringify(broken));

  const loaded = await new CareerRepository(
    store,
    content,
    'writer-b',
  ).load();
  expect(loaded).toMatchObject({
    status: 'loaded',
    usedFallback: true,
    career: { generation: 2 },
  });
  if (loaded.status !== 'loaded') throw new Error('expected fallback');
  expect(loaded.invalidNewer).toHaveLength(1);
  expect(loaded.invalidNewer[0]!.raw).toContain('"generation":3');
});

test('all corrupt generations and an unknown engine stay available for recovery', async () => {
  const allCorrupt = new FakeKvStore();
  for (let index = 0; index < 3; index += 1) {
    allCorrupt.values.set(
      CAREER_GENERATION_KEYS[index]!,
      JSON.stringify({
        generation: index,
        writerId: 'old',
        resetFence: 0,
        payload: { broken: true },
      }),
    );
  }
  const recovery = await new CareerRepository(
    allCorrupt,
    content,
    'reader',
  ).load();
  expect(recovery).toMatchObject({
    status: 'recovery',
    blobs: expect.any(Array),
  });
  if (recovery.status !== 'recovery') {
    throw new Error('expected recovery');
  }
  expect(recovery.blobs).toHaveLength(3);

  const unknown = new FakeKvStore();
  const future = freshCareer();
  const rawFuture = {
    ...future,
    engineVersion: 999,
    generation: 9,
    writerId: 'future-writer',
  };
  unknown.values.set(
    CAREER_GENERATION_KEYS[0],
    JSON.stringify(rawFuture),
  );
  expect(
    await new CareerRepository(
      unknown,
      content,
      'reader',
    ).load(),
  ).toMatchObject({
    status: 'recovery',
    blobs: [expect.objectContaining({ raw: expect.stringContaining('999') })],
  });
});

test('known legacy data migrates before current strict parsing', async () => {
  const store = new FakeKvStore();
  store.values.set(
    CAREER_GENERATION_KEYS[0],
    JSON.stringify(engineV7),
  );
  const loaded = await new CareerRepository(
    store,
    content,
    'reader',
  ).load();
  expect(loaded).toMatchObject({
    status: 'loaded',
    career: {
      engineVersion: 9,
      payload: {
        sim: {
          current: { type: 'travel', cardId: 'c0' },
        },
      },
    },
  });
});

test('engine v8 careers migrate without losing the saved queue', async () => {
  const store = new FakeKvStore();
  const prior = JSON.parse(JSON.stringify(freshCareer()));
  prior.engineVersion = 8;
  prior.payload.sim.engineVersion = 8;
  prior.payload.sim.queue = [{
    id: 'saved-v8-card',
    activityId: 'meal',
    owner: 'PINNED',
    urgent: false,
    source: 'player',
    enqueuedTick: prior.payload.sim.clock.absoluteMinute,
  }];
  store.values.set(
    CAREER_GENERATION_KEYS[0],
    JSON.stringify(prior),
  );

  const loaded = await new CareerRepository(
    store,
    content,
    'reader',
  ).load();

  expect(loaded).toMatchObject({
    status: 'loaded',
    career: {
      engineVersion: 9,
      payload: {
        sim: {
          engineVersion: 9,
          queue: [{ id: 'saved-v8-card', activityId: 'meal' }],
        },
      },
    },
  });
});

test('writes serialize and a rejected write does not skip a generation', async () => {
  const store = new FakeKvStore();
  const repository = new CareerRepository(
    store,
    content,
    'writer-a',
  );
  await repository.load();
  const release = store.blockNextSet();
  const first = repository.save(freshCareer(), 1);
  const second = repository.save(freshCareer(), 2);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(store.setStarts).toEqual([CAREER_GENERATION_KEYS[0]]);
  release();
  const [generation0, generation1] = await Promise.all([first, second]);
  expect([generation0.generation, generation1.generation]).toEqual([0, 1]);
  expect(store.setStarts.slice(0, 2)).toEqual([
    CAREER_GENERATION_KEYS[0],
    CAREER_GENERATION_KEYS[1],
  ]);

  store.failNextSetFor(CAREER_GENERATION_KEYS[2]);
  await expect(repository.save(generation1, 3)).rejects.toThrow(
    /rejected write/,
  );
  const retried = await repository.save(generation1, 4);
  expect(retried.generation).toBe(2);
});

test('a second live writer parks before it can overwrite the first', async () => {
  const store = new FakeKvStore();
  const first = new CareerRepository(
    store,
    content,
    'writer-a',
  );
  const second = new CareerRepository(
    store,
    content,
    'writer-b',
  );
  await Promise.all([first.load(), second.load()]);
  let conflictNotices = 0;
  const unwatch = second.watch(() => {
    conflictNotices += 1;
  });

  await first.save(freshCareer(), 1);
  expect(second.isParked).toBe(true);
  expect(conflictNotices).toBe(1);
  await expect(second.save(freshCareer(), 2)).rejects.toBeInstanceOf(
    StaleCareerWriterError,
  );
  unwatch();
});

test('the durable reset fence prevents an older career from resurrecting', async () => {
  const store = new FakeKvStore();
  const oldCareer = await savedCareer(store, 1);
  expect(oldCareer.generation).toBe(0);
  const repository = new CareerRepository(
    store,
    content,
    'reset-writer',
  );
  await repository.load();
  store.failNextSetFor(CAREER_GENERATION_KEYS[1]);

  await expect(
    repository.resetWithCareer(freshCareer(9876, 'new-career'), 10),
  ).rejects.toThrow(/rejected write/);
  expect(store.values.get(CAREER_RESET_FENCE_KEY)).toBe('1');
  expect(store.values.get(CAREER_GENERATION_KEYS[0])).toContain(
    oldCareer.careerId,
  );

  const afterFailure = await new CareerRepository(
    store,
    content,
    'reader',
  ).load();
  expect(afterFailure).toEqual({ status: 'empty', resetFence: 1 });
});

test('a corrupt reset fence opens recovery and still permits a fresh career', async () => {
  const store = new FakeKvStore();
  const oldCareer = await savedCareer(store, 1);
  store.values.set(CAREER_RESET_FENCE_KEY, 'not-a-fence');
  const repository = new CareerRepository(
    store,
    content,
    'recovery-writer',
  );

  const loaded = await repository.load();
  expect(loaded).toEqual({
    status: 'recovery',
    resetFence: 0,
    blobs: [
      {
        key: CAREER_RESET_FENCE_KEY,
        raw: 'not-a-fence',
        error: 'career reset fence is corrupt',
      },
    ],
  });

  const fresh = await repository.resetWithCareer(
    freshCareer(9876, 'fresh-after-corruption'),
    10,
  );
  expect(fresh.generation).toBe(oldCareer.generation + 1);
  expect(store.values.get(CAREER_RESET_FENCE_KEY)).toBe('1');
});

test('a lifecycle barrier uses the synchronous driver capability', async () => {
  const store = new FakeKvStore();
  const repository = new CareerRepository(
    store,
    content,
    'barrier-writer',
  );
  await repository.load();
  const saved = await repository.saveBarrier(freshCareer(), 22);
  expect(saved.generation).toBe(0);
  expect(store.barrierStarts).toEqual([CAREER_GENERATION_KEYS[0]]);
  expect(
    JSON.parse(store.values.get(CAREER_GENERATION_KEYS[0])!)
      .savedAtEpochMs,
  ).toBe(22);
});

test('app-global preferences survive malformed career data', async () => {
  const store = new FakeKvStore();
  const preferences = newAppPreferencesEnvelope();
  preferences.preferences.audio.muted = true;
  await new AppPreferencesRepository(store).save(preferences);
  store.values.set(CAREER_GENERATION_KEYS[0], '{broken');

  expect(
    await new AppPreferencesRepository(store).load(),
  ).toEqual(preferences);
  expect(store.values.has(APP_PREFERENCES_KEY)).toBe(true);
});

test('boot loads preferences before career and records a hidden resume', async () => {
  const store = new FakeKvStore();
  await savedCareer(store, 1);
  const states: BootState[] = [];
  const final = await bootApplication(
    {
      preferences: new AppPreferencesRepository(store),
      careers: new CareerRepository(
        store,
        content,
        'boot-reader',
      ),
      isHidden: () => true,
    },
    (state) => states.push(state),
  );

  expect(states.map((state) => state.status)).toEqual([
    'loading-preferences',
    'loading-career',
    'resume',
  ]);
  expect(final).toMatchObject({
    status: 'resume',
    startSystemPaused: true,
  });
});
