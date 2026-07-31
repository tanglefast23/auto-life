import type { KvStore } from '../persistence/kv';
import type { ContentRegistry } from '../sim/content';
import {
  AppPreferencesEnvelopeSchema,
  StoredCareerSchema,
  migrateKnownCareer,
  newAppPreferencesEnvelope,
  restoreCareerState,
  validateCareerContentRefs,
  type AppPreferencesEnvelope,
  type StoredCareer,
} from './career-state';

export const CAREER_GENERATION_KEYS = [
  'career/generation-0',
  'career/generation-1',
  'career/generation-2',
] as const;
export const CAREER_RESET_FENCE_KEY = 'career/reset-fence';
export const APP_PREFERENCES_KEY = 'preferences/app';
/**
 * One lock name for every career write. Save and reset must exclude each other, not
 * just their own kind — a reset racing a save is how a brand-new career gets discarded.
 */
export const CAREER_WRITE_LOCK = 'career/write';

export interface RecoveryBlob {
  key: string;
  raw: string;
  error: string;
}

export type CareerLoadResult =
  | { status: 'empty'; resetFence: number }
  | {
      status: 'loaded';
      career: StoredCareer;
      usedFallback: boolean;
      invalidNewer: RecoveryBlob[];
    }
  | {
      status: 'recovery';
      resetFence: number;
      blobs: RecoveryBlob[];
    };

export class StaleCareerWriterError extends Error {
  constructor() {
    super('This career changed in another tab. Reload before continuing.');
    this.name = 'StaleCareerWriterError';
  }
}

interface DecodedSlot {
  key: string;
  raw: string;
  headerGeneration: number | null;
  career: StoredCareer | null;
  error: string | null;
  fenced: boolean;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function headerFromRaw(
  raw: string,
): { generation: number; writerId: string; resetFence: number } | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (
      !Number.isInteger(record.generation) ||
      typeof record.writerId !== 'string' ||
      !Number.isInteger(record.resetFence)
    ) {
      return null;
    }
    return {
      generation: record.generation as number,
      writerId: record.writerId,
      resetFence: record.resetFence as number,
    };
  } catch {
    return null;
  }
}

export class CareerRepository {
  private writeTail: Promise<void> = Promise.resolve();
  private loaded = false;
  private loadedGeneration = -1;
  private loadedCareerId: string | null = null;
  private resetFence = 0;
  private parked = false;

  constructor(
    private readonly store: KvStore,
    private readonly content: ContentRegistry,
    private readonly writerId: string,
  ) {
    if (writerId.trim().length === 0) {
      throw new Error('writerId must not be empty');
    }
  }

  get isParked(): boolean {
    return this.parked;
  }

  async load(): Promise<CareerLoadResult> {
    const rawFence = await this.store.getItem(CAREER_RESET_FENCE_KEY);
    let corruptFence: RecoveryBlob | null = null;
    try {
      this.resetFence = parseResetFence(rawFence);
    } catch (error) {
      this.resetFence = 0;
      corruptFence = {
        key: CAREER_RESET_FENCE_KEY,
        raw: rawFence ?? '',
        error: errorText(error),
      };
    }
    const rawSlots = await Promise.all(
      CAREER_GENERATION_KEYS.map(async (key) => ({
        key,
        raw: await this.store.getItem(key),
      })),
    );
    const decoded = rawSlots.flatMap(({ key, raw }) =>
      raw === null ? [] : [this.decodeSlot(key, raw)],
    );
    const valid = decoded
      .filter(
        (slot): slot is DecodedSlot & { career: StoredCareer } =>
          slot.career !== null && !slot.fenced,
      )
      .sort((a, b) => b.career.generation - a.career.generation);
    const invalid = decoded.filter(
      (slot) => slot.error !== null && !slot.fenced,
    );
    const newestHeader = Math.max(
      -1,
      ...decoded
        .filter((slot) => !slot.fenced)
        .map((slot) => slot.headerGeneration ?? -1),
    );

    this.loaded = true;
    this.parked = false;
    if (corruptFence !== null) {
      this.loadedGeneration = newestHeader;
      this.loadedCareerId = null;
      return {
        status: 'recovery',
        resetFence: this.resetFence,
        blobs: [
          corruptFence,
          ...invalid.map(toRecoveryBlob),
        ],
      };
    }
    if (valid.length > 0) {
      const selected = valid[0]!.career;
      this.loadedGeneration = selected.generation;
      this.loadedCareerId = selected.careerId;
      return {
        status: 'loaded',
        career: selected,
        usedFallback: newestHeader > selected.generation,
        invalidNewer: invalid
          .filter(
            (slot) =>
              (slot.headerGeneration ?? -1) > selected.generation,
          )
          .map(toRecoveryBlob),
      };
    }

    if (invalid.length > 0) {
      this.loadedGeneration = newestHeader;
      this.loadedCareerId = null;
      return {
        status: 'recovery',
        resetFence: this.resetFence,
        blobs: invalid.map(toRecoveryBlob),
      };
    }
    this.loadedGeneration = -1;
    this.loadedCareerId = null;
    return { status: 'empty', resetFence: this.resetFence };
  }

  async save(
    career: StoredCareer,
    savedAtEpochMs: number,
  ): Promise<StoredCareer> {
    return this.enqueueWrite(async () => {
      this.requireWritable();
      await this.assertNoConflict();
      if (
        this.loadedCareerId !== null &&
        career.careerId !== this.loadedCareerId
      ) {
        throw new Error('cannot overwrite a different loaded career');
      }
      const next = StoredCareerSchema.parse({
        ...career,
        generation: this.loadedGeneration + 1,
        savedAtEpochMs,
        writerId: this.writerId,
        resetFence: this.resetFence,
      });
      validateCareerContentRefs(next, this.content);
      await this.store.setItem(
        generationKey(next.generation),
        JSON.stringify(next),
      );
      this.loadedGeneration = next.generation;
      this.loadedCareerId = next.careerId;
      return next;
    });
  }

  async saveBarrier(
    career: StoredCareer,
    savedAtEpochMs: number,
  ): Promise<StoredCareer> {
    if (
      this.store.getItemBarrier === undefined ||
      this.store.setItemBarrier === undefined
    ) {
      return this.save(career, savedAtEpochMs);
    }
    const setItemBarrier = this.store.setItemBarrier.bind(this.store);
    return this.enqueueWrite(async () => {
      this.requireWritable();
      this.assertNoNewerExternalGenerationBarrier();
      if (
        this.loadedCareerId !== null &&
        career.careerId !== this.loadedCareerId
      ) {
        throw new Error('cannot overwrite a different loaded career');
      }
      const next = StoredCareerSchema.parse({
        ...career,
        generation: this.loadedGeneration + 1,
        savedAtEpochMs,
        writerId: this.writerId,
        resetFence: this.resetFence,
      });
      validateCareerContentRefs(next, this.content);
      setItemBarrier(
        generationKey(next.generation),
        JSON.stringify(next),
      );
      this.loadedGeneration = next.generation;
      this.loadedCareerId = next.careerId;
      return next;
    });
  }

  /**
   * Establishes the fence before the first new-career generation. If the second
   * write fails, older generations remain available for diagnostics but are
   * ineligible for load, so a partial reset can never resurrect them.
   */
  async resetWithCareer(
    career: StoredCareer,
    savedAtEpochMs: number,
  ): Promise<StoredCareer> {
    return this.enqueueWrite(async () => {
      this.requireWritable();
      await this.assertNoConflict();
      // Adopt the new fence BEFORE publishing it. `watch()` now parks on a fence it did
      // not expect, and a store that delivers change events synchronously would
      // otherwise hand this repository its own reset and park the tab that performed it.
      // Restored on failure so a rejected write leaves no phantom fence behind.
      const previousFence = this.resetFence;
      const nextFence = previousFence + 1;
      this.resetFence = nextFence;
      try {
        await this.store.setItem(
          CAREER_RESET_FENCE_KEY,
          String(nextFence),
        );
      } catch (error) {
        this.resetFence = previousFence;
        throw error;
      }
      const next = StoredCareerSchema.parse({
        ...career,
        generation: this.loadedGeneration + 1,
        savedAtEpochMs,
        writerId: this.writerId,
        resetFence: nextFence,
      });
      validateCareerContentRefs(next, this.content);
      await this.store.setItem(
        generationKey(next.generation),
        JSON.stringify(next),
      );
      this.loadedGeneration = next.generation;
      this.loadedCareerId = next.careerId;
      return next;
    });
  }

  watch(onParked: () => void): () => void {
    if (this.store.subscribe === undefined) return () => undefined;
    return this.store.subscribe((key, value) => {
      // A New Game in another tab raises the fence. Watching generations alone missed
      // it whenever the reset did not also allocate a newer generation, and this tab
      // then kept playing a career the next load will discard.
      if (key === CAREER_RESET_FENCE_KEY) {
        const durable = Number(value);
        if (
          value !== null &&
          Number.isSafeInteger(durable) &&
          durable > this.resetFence
        ) {
          this.parked = true;
          onParked();
        }
        return;
      }
      if (
        !CAREER_GENERATION_KEYS.includes(
          key as (typeof CAREER_GENERATION_KEYS)[number],
        ) ||
        value === null
      ) {
        return;
      }
      const header = headerFromRaw(value);
      if (
        header !== null &&
        header.generation > this.loadedGeneration &&
        header.writerId !== this.writerId
      ) {
        this.parked = true;
        onParked();
      }
    });
  }

  private decodeSlot(key: string, raw: string): DecodedSlot {
    const header = headerFromRaw(raw);
    try {
      const parsed = JSON.parse(raw) as unknown;
      let career: StoredCareer;
      const current = StoredCareerSchema.safeParse(parsed);
      if (current.success) {
        career = restoreCareerState(current.data);
      } else {
        career = migrateKnownCareer(parsed, this.content);
      }
      validateCareerContentRefs(career, this.content);
      return {
        key,
        raw,
        headerGeneration: header?.generation ?? career.generation,
        career,
        error: null,
        fenced: career.resetFence < this.resetFence,
      };
    } catch (error) {
      return {
        key,
        raw,
        headerGeneration: header?.generation ?? null,
        career: null,
        error: errorText(error),
        fenced:
          header !== null && header.resetFence < this.resetFence,
      };
    }
  }

  private requireWritable(): void {
    if (!this.loaded) {
      throw new Error('load the career repository before writing');
    }
    if (this.parked) throw new StaleCareerWriterError();
  }

  /**
   * The whole conflict test, run inside the write lock so its answer is still true when
   * the write lands. Two questions, because a newer generation is not the only way
   * another tab can invalidate this writer:
   *
   *  1. Has anyone written a newer generation? (their save wins; this one is stale)
   *  2. Has anyone raised the durable reset fence? (their New Game wins; every record
   *     this writer produces from here is already fenced out of the next load)
   *
   * Only (1) was checked before, and it only catches a reset that also happens to
   * allocate a newer generation.
   */
  private async assertNoConflict(): Promise<void> {
    await this.assertFenceUnchanged();
    await this.assertNoNewerExternalGeneration();
  }

  private async assertFenceUnchanged(): Promise<void> {
    const raw = await this.store.getItem(CAREER_RESET_FENCE_KEY);
    let durable: number;
    try {
      durable = parseResetFence(raw);
    } catch {
      // A corrupt fence is NOT a conflict. `load()` already routed it to recovery with
      // `resetFence` reset to 0, and the only way out of that screen is "Start fresh" —
      // which is a write. Parking here would make the corruption unrecoverable.
      return;
    }
    if (durable > this.resetFence) {
      this.parked = true;
      throw new StaleCareerWriterError();
    }
  }

  private async assertNoNewerExternalGeneration(): Promise<void> {
    const values = await Promise.all(
      CAREER_GENERATION_KEYS.map((key) => this.store.getItem(key)),
    );
    for (const value of values) {
      if (value === null) continue;
      const header = headerFromRaw(value);
      if (
        header !== null &&
        header.resetFence >= this.resetFence &&
        header.generation > this.loadedGeneration &&
        header.writerId !== this.writerId
      ) {
        this.parked = true;
        throw new StaleCareerWriterError();
      }
    }
  }

  private assertNoNewerExternalGenerationBarrier(): void {
    if (this.store.getItemBarrier === undefined) return;
    for (const key of CAREER_GENERATION_KEYS) {
      const value = this.store.getItemBarrier(key);
      if (value === null) continue;
      const header = headerFromRaw(value);
      if (
        header !== null &&
        header.resetFence >= this.resetFence &&
        header.generation > this.loadedGeneration &&
        header.writerId !== this.writerId
      ) {
        this.parked = true;
        throw new StaleCareerWriterError();
      }
    }
  }

  /**
   * In-process ordering AND cross-tab exclusion.
   *
   * `writeTail` alone only orders this tab's writes; the lock is what makes the
   * read-check-allocate-write one transaction across every tab on the origin. Drivers
   * without a lock (native, which is single-process) run the work unchanged.
   */
  private enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
    const withLock = this.store.withLock?.bind(this.store);
    const locked =
      withLock === undefined
        ? work
        : () => withLock(CAREER_WRITE_LOCK, work);
    const result = this.writeTail.then(locked, locked);
    this.writeTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export class AppPreferencesRepository {
  constructor(private readonly store: KvStore) {}

  async load(): Promise<AppPreferencesEnvelope> {
    const raw = await this.store.getItem(APP_PREFERENCES_KEY);
    if (raw === null) return newAppPreferencesEnvelope();
    try {
      return AppPreferencesEnvelopeSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return newAppPreferencesEnvelope();
    }
  }

  async save(
    envelope: AppPreferencesEnvelope,
  ): Promise<AppPreferencesEnvelope> {
    const parsed = AppPreferencesEnvelopeSchema.parse(envelope);
    await this.store.setItem(APP_PREFERENCES_KEY, JSON.stringify(parsed));
    return parsed;
  }
}

function parseResetFence(raw: string | null): number {
  if (raw === null) return 0;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('career reset fence is corrupt');
  }
  return value;
}

function generationKey(generation: number): string {
  return CAREER_GENERATION_KEYS[
    generation % CAREER_GENERATION_KEYS.length
  ]!;
}

function toRecoveryBlob(slot: DecodedSlot): RecoveryBlob {
  return {
    key: slot.key,
    raw: slot.raw,
    error: slot.error ?? 'unknown career error',
  };
}
