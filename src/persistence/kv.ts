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
}

export { kv } from './kv-driver';
