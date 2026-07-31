import type { KvStore } from './kv';

const PREFIX = 'auto-life/';

/** Web driver: localStorage. Async interface kept so drivers stay swappable. */
export const kv: KvStore = {
  async getItem(key) {
    return globalThis.localStorage.getItem(PREFIX + key);
  },
  async setItem(key, value) {
    globalThis.localStorage.setItem(PREFIX + key, value);
  },
  async removeItem(key) {
    globalThis.localStorage.removeItem(PREFIX + key);
  },
  getItemBarrier(key) {
    return globalThis.localStorage.getItem(PREFIX + key);
  },
  setItemBarrier(key, value) {
    globalThis.localStorage.setItem(PREFIX + key, value);
  },
  subscribe(listener) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || !event.key.startsWith(PREFIX)) return;
      listener(event.key.slice(PREFIX.length), event.newValue);
    };
    globalThis.addEventListener('storage', onStorage);
    return () => globalThis.removeEventListener('storage', onStorage);
  },
  /**
   * Web Locks: origin-scoped, so one tab's save transaction excludes every other tab's.
   *
   * The API has been in every evergreen browser since 2022 and Chrome — the frozen
   * playtest browser — is well past that. Where it is genuinely absent the work still
   * runs; the repository's own conflict check then remains the only guard, which is
   * exactly the pre-lock behaviour rather than a new failure.
   */
  async withLock(name, work) {
    const locks = (
      globalThis.navigator as { locks?: LockManager } | undefined
    )?.locks;
    if (locks === undefined) return work();
    return locks.request(PREFIX + name, work);
  },
};
