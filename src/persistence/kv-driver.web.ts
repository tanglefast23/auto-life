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
};
