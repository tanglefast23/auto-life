import type { KvStore } from '../../persistence/kv';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';
import {
  CAREER_RESET_FENCE_KEY,
  CareerRepository,
  StaleCareerWriterError,
} from '../career-repository';
import { newCareerState, type StoredCareer } from '../career-state';

/**
 * The cross-tab write contract (SPEC §11.7, §15).
 *
 * Two tabs sharing one origin share one store, and a save is a read-check-allocate-write
 * transaction. Without mutual exclusion both tabs read "newest is generation N", both
 * allocate N+1, both write the same key, and **both report success** — a probe printed
 * `['ok:g0', 'ok:g0']` while one player's session was silently discarded. The generation
 * check cannot fix that on its own; it has to run inside the same lock as the write.
 */

/** One origin, shared by every repository in a test — i.e. the tabs of one browser. */
class SharedOriginStore implements KvStore {
  readonly values = new Map<string, string>();
  /** Highest number of writers ever inside the lock at once. Must never exceed 1. */
  maxConcurrentHolders = 0;
  private holders = 0;
  private lockTail: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<
    (key: string, value: string | null) => void
  >();

  constructor(private readonly locking = true) {}

  async getItem(key: string): Promise<string | null> {
    await Promise.resolve();
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await Promise.resolve();
    this.values.set(key, value);
    for (const listener of this.listeners) listener(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
    for (const listener of this.listeners) listener(key, null);
  }

  subscribe(listener: (key: string, value: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Stands in for the Web Locks API: origin-wide, queued, released on throw. */
  withLock<T>(_name: string, work: () => Promise<T>): Promise<T> {
    if (!this.locking) return work();
    const run = async (): Promise<T> => {
      this.holders += 1;
      this.maxConcurrentHolders = Math.max(
        this.maxConcurrentHolders,
        this.holders,
      );
      try {
        return await work();
      } finally {
        this.holders -= 1;
      }
    };
    const result = this.lockTail.then(run, run);
    this.lockTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function career(careerId = 'shared-career', rootSeed = 7): StoredCareer {
  return newCareerState({
    rootSeed,
    sim: newGameState(
      'baseline',
      content.rates,
      rootSeed,
      PrngStreams.create(rootSeed).serialize(),
    ),
    careerId,
  });
}

test('two tabs saving at the same moment: exactly one succeeds', async () => {
  const store = new SharedOriginStore();
  const a = new CareerRepository(store, content, 'writer-a');
  const b = new CareerRepository(store, content, 'writer-b');
  await a.load();
  await b.load();

  const results = await Promise.allSettled([
    a.save(career(), 1),
    b.save(career(), 2),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
    StaleCareerWriterError,
  );
  expect(store.maxConcurrentHolders).toBe(1);
});

test('a reset racing an ordinary save leaves the new career intact', async () => {
  const store = new SharedOriginStore();
  const a = new CareerRepository(store, content, 'writer-a');
  await a.load();
  await a.save(career(), 1);

  const b = new CareerRepository(store, content, 'writer-b');
  await b.load();

  await Promise.allSettled([
    b.resetWithCareer(career('reset-career', 9), 3),
    a.save(career(), 2),
  ]);

  const reloaded = await new CareerRepository(store, content, 'reader').load();
  expect(reloaded.status).toBe('loaded');
  expect(reloaded.status === 'loaded' && reloaded.career.careerId).toBe(
    'reset-career',
  );
});

test('a raised fence rejects the next save even without a newer generation', async () => {
  const store = new SharedOriginStore();
  const a = new CareerRepository(store, content, 'writer-a');
  await a.load();
  await a.save(career(), 1);

  // Another tab's New Game, seen only as the durable fence.
  store.values.set(CAREER_RESET_FENCE_KEY, '1');

  await expect(a.save(career(), 2)).rejects.toBeInstanceOf(
    StaleCareerWriterError,
  );
  expect(a.isParked).toBe(true);
});

test('a corrupt fence is not treated as a conflict', async () => {
  // Recovery's only exit is "Start fresh", which is a write. The fence check must not
  // turn unreadable-fence corruption into an unrecoverable state.
  const store = new SharedOriginStore();
  const a = new CareerRepository(store, content, 'writer-a');
  await a.load();
  await a.save(career(), 1);

  store.values.set(CAREER_RESET_FENCE_KEY, 'not-a-number');

  await expect(a.save(career(), 2)).resolves.toMatchObject({ generation: 1 });
  expect(a.isParked).toBe(false);
});

test('watch parks a tab on another tab New Game', async () => {
  const store = new SharedOriginStore();
  const a = new CareerRepository(store, content, 'writer-a');
  await a.load();
  await a.save(career(), 1);

  let parked = false;
  const stop = a.watch(() => {
    parked = true;
  });

  const b = new CareerRepository(store, content, 'writer-b');
  await b.load();
  await b.resetWithCareer(career('reset-career', 9), 2);

  expect(parked).toBe(true);
  expect(a.isParked).toBe(true);
  stop();
});

test('the tab performing the reset does not park itself', async () => {
  const store = new SharedOriginStore();
  const a = new CareerRepository(store, content, 'writer-a');
  await a.load();

  let parked = false;
  const stop = a.watch(() => {
    parked = true;
  });
  await a.resetWithCareer(career('reset-career', 9), 1);

  expect(parked).toBe(false);
  expect(a.isParked).toBe(false);
  // And it can keep saving afterwards.
  await expect(a.save(career('reset-career', 9), 2)).resolves.toMatchObject({
    resetFence: 1,
  });
  stop();
});

test('without a lock driver the writers still order within one tab', async () => {
  // Native is single-process and supplies no lock; this pins that the repository keeps
  // working there rather than depending on the capability existing.
  const store = new SharedOriginStore(false);
  const only = new CareerRepository(store, content, 'writer-only');
  await only.load();

  const results = await Promise.all([
    only.save(career(), 1),
    only.save(career(), 2),
  ]);
  expect(results.map((r) => r.generation)).toEqual([0, 1]);
});
