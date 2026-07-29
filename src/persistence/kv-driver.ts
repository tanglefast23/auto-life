import * as SQLite from 'expo-sqlite';
import type { KvStore } from './kv';

/** Native driver: expo-sqlite (stable on iOS/Android; HFM-proven). */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const openDb = () => {
  dbPromise ??= SQLite.openDatabaseAsync('auto-life.db')
    .then(async (db) => {
      await db.execAsync('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
      return db;
    })
    .catch((err: unknown) => {
      dbPromise = null; // a failed open must not poison every later call
      throw err;
    });
  return dbPromise;
};

export const kv: KvStore = {
  async getItem(key) {
    const db = await openDb();
    const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', key);
    return row?.v ?? null;
  },
  async setItem(key, value) {
    const db = await openDb();
    await db.runAsync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', key, value);
  },
};
