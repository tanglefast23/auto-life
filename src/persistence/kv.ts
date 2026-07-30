/**
 * Persistence adapter seam — the P0 kill-gate decision (see docs/superpowers/evidence/P0.md).
 *
 * expo-sqlite's web support is alpha and hung `openDatabaseAsync` on the static export,
 * so the web driver is localStorage-backed (v1 persists one small versioned JSON blob —
 * SPEC §15 — well inside localStorage limits). Native keeps expo-sqlite behind this same
 * interface: `kv-driver.ts` is the native driver, `kv-driver.web.ts` overrides it on web
 * via Metro platform resolution.
 */
export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /**
   * Optional lifecycle barrier. Web localStorage supplies a synchronous write
   * so `pagehide` does not depend on a later event-loop turn. Native omits it
   * and uses its normal immediate best-effort flush.
   */
  getItemBarrier?(key: string): string | null;
  setItemBarrier?(key: string, value: string): void;
  /**
   * Optional external-change feed. Web maps this to `storage`; test drivers use
   * it to prove two-writer parking. Native has one process and omits it.
   */
  subscribe?(
    listener: (key: string, value: string | null) => void,
  ): () => void;
}

export { kv } from './kv-driver';
