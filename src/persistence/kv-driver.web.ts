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
};
