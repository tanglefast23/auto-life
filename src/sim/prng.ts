import { z } from 'zod';

/**
 * Five independent deterministic streams (SPEC §16.2). Each stream stores its CURRENT
 * uint32 mulberry32 state — restore/clone copy five small records in O(5), never
 * replaying call history. Salts are name-owned so adding a stream can never reseed
 * existing ones by array position.
 */
export const STREAM_NAMES = [
  'wrinkles',
  'storylets',
  'relationships',
  'careerEvents',
  'cosmetic',
] as const;
export type StreamName = (typeof STREAM_NAMES)[number];

const STREAM_SALTS: Record<StreamName, number> = {
  wrinkles: 0x243f6a88,
  storylets: 0x85a308d3,
  relationships: 0x13198a2e,
  careerEvents: 0x03707344,
  cosmetic: 0xa4093822,
};

const Uint32 = z.number().int().min(0).max(0xffffffff);
const StreamRecordSchema = z.strictObject({ state: Uint32, calls: z.number().int().min(0) });
export const PrngSnapshotSchema = z.strictObject({
  rootSeed: Uint32,
  streams: z.strictObject({
    wrinkles: StreamRecordSchema,
    storylets: StreamRecordSchema,
    relationships: StreamRecordSchema,
    careerEvents: StreamRecordSchema,
    cosmetic: StreamRecordSchema,
  }),
});
export type PrngSnapshot = z.infer<typeof PrngSnapshotSchema>;

/** One mulberry32 step from a uint32 state; returns the next state and the draw. */
function mulberryNext(state: number): { state: number; value: number } {
  let a = state >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: a >>> 0, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

export class PrngStreams {
  private snapshot: PrngSnapshot;

  private constructor(snapshot: PrngSnapshot) {
    this.snapshot = snapshot;
  }

  static create(rootSeed: number): PrngStreams {
    const seed = rootSeed >>> 0;
    const streams = Object.fromEntries(
      STREAM_NAMES.map((name) => [name, { state: (seed ^ STREAM_SALTS[name]) >>> 0, calls: 0 }]),
    ) as PrngSnapshot['streams'];
    return new PrngStreams({ rootSeed: seed, streams });
  }

  /** Restores from a validated plain snapshot in O(streams), regardless of history length. */
  static restore(raw: unknown): PrngStreams {
    return new PrngStreams(PrngSnapshotSchema.parse(raw));
  }

  next(name: StreamName): number {
    const rec = this.snapshot.streams[name];
    const { state, value } = mulberryNext(rec.state);
    rec.state = state;
    rec.calls += 1;
    return value;
  }

  serialize(): PrngSnapshot {
    return JSON.parse(JSON.stringify(this.snapshot)) as PrngSnapshot;
  }

  clone(): PrngStreams {
    return new PrngStreams(this.serialize());
  }
}
