/**
 * Minimal deterministic WAV writer (mono PCM16), plus the synthesis primitives the cue
 * bank is authored with.
 *
 * Deliberately dependency-free, for the same reason `scripts/art/png.ts` is: the audio
 * pipeline runs in CI, and pulling an audio library to write "exactly these samples" is a
 * supply-chain surface for no benefit. A RIFF header is forty lines.
 *
 * **Why synthesize at all** (P6 plan §0b): the alternative was a licensed pack, which put
 * v1's only external validation behind a purchase with no deadline — five of six audit
 * reviewers converged on that as the phase's biggest scheduling risk. Authored audio is
 * deterministic, byte-reproducible, diffable, and needs no supply chain, which is exactly
 * the argument the project already accepted for art.
 *
 * Everything here is a pure function of its parameters. No `Math.random`, no `Date.now` —
 * `npm run audio:check` diffs a fresh render against the committed bank, so a stray
 * source of entropy would show up as a permanently dirty tree.
 */

/** Mono, 22.05 kHz, 16-bit. Enough for chiptune-adjacent cues; a quarter the bytes of CD. */
export const SAMPLE_RATE = 22050;

export type Samples = Float32Array;

export function seconds(n: number): number {
  return Math.max(0, Math.round(n * SAMPLE_RATE));
}

export function silence(duration: number): Samples {
  return new Float32Array(seconds(duration));
}

export type Wave = 'sine' | 'square' | 'triangle' | 'saw' | 'noise';

/**
 * Deterministic pseudo-noise.
 *
 * A 16-bit LFSR rather than `Math.random`, because the bank has to render byte-identically
 * on every machine or `audio:check` is meaningless.
 */
function lfsr(seed: number): () => number {
  let state = seed >>> 0 || 0xace1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

export interface ToneOptions {
  wave?: Wave;
  /** Constant frequency, or a function of normalised time for a sweep. */
  freq: number | ((t: number) => number);
  duration: number;
  gain?: number;
  /** Attack/decay in seconds. A cue with no attack clicks; HFM's handover §3.2 is explicit. */
  attack?: number;
  release?: number;
  seed?: number;
}

export function tone(opts: ToneOptions): Samples {
  const { wave = 'sine', freq, duration, gain = 1, attack = 0.005, release = 0.05, seed = 1 } = opts;
  const n = seconds(duration);
  const out = new Float32Array(n);
  const rand = lfsr(seed);
  const attackSamples = Math.max(1, seconds(attack));
  const releaseSamples = Math.max(1, seconds(release));
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    const f = typeof freq === 'function' ? freq(t) : freq;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    let v: number;
    switch (wave) {
      case 'square':
        v = Math.sin(phase) >= 0 ? 1 : -1;
        break;
      case 'triangle':
        v = (2 / Math.PI) * Math.asin(Math.sin(phase));
        break;
      case 'saw':
        v = (phase / Math.PI) - 1;
        break;
      case 'noise':
        v = rand();
        break;
      default:
        v = Math.sin(phase);
    }
    // Linear attack and release. Shaping the envelope is not decoration: an abrupt start
    // is the "heavy click" HFM had to replace, and an abrupt end pops.
    const env =
      Math.min(1, i / attackSamples) * Math.min(1, Math.max(0, (n - i) / releaseSamples));
    out[i] = v * gain * env;
  }
  return out;
}

/** Sum several layers, longest wins. Used for chords and for layering a riff over a bed. */
export function mix(...layers: readonly Samples[]): Samples {
  const n = layers.reduce((m, l) => Math.max(m, l.length), 0);
  const out = new Float32Array(n);
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i++) out[i] = (out[i] ?? 0) + layer[i]!;
  }
  return out;
}

/** Lay `layer` into `base` starting at `atSeconds`. Used to sequence notes into a loop. */
export function place(base: Samples, layer: Samples, atSeconds: number): Samples {
  const start = seconds(atSeconds);
  for (let i = 0; i < layer.length; i++) {
    const j = start + i;
    if (j >= base.length) break;
    base[j] = (base[j] ?? 0) + layer[i]!;
  }
  return base;
}

/** Concatenate. */
export function join(...parts: readonly Samples[]): Samples {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * Crossfade the tail of a loop into its own head, so it repeats without a seam.
 *
 * A music bed that clicks once every eight seconds is worse than no music, and the click
 * is inaudible in a waveform view — it has to be built out, not listened for.
 */
export function seamless(samples: Samples, fadeSeconds = 0.12): Samples {
  const fade = Math.min(seconds(fadeSeconds), Math.floor(samples.length / 4));
  if (fade <= 0) return samples;
  const out = samples.slice(0, samples.length - fade);
  for (let i = 0; i < fade; i++) {
    const w = i / fade;
    const tail = samples[samples.length - fade + i]!;
    out[i] = (out[i] ?? 0) * w + tail * (1 - w);
  }
  return out;
}

/** Normalise to a target peak, so every cue is authored at a predictable loudness. */
export function normalize(samples: Samples, peak = 0.9): Samples {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  if (max === 0) return samples;
  const scale = peak / max;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i]! * scale;
  return out;
}

/** Semitone offsets from A4, so riffs can be written musically rather than in hertz. */
export function note(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

function u32le(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

function u16le(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff];
}

/** Encode to mono PCM16 WAV. Byte-reproducible for identical input. */
export function encodeWav(samples: Samples, sampleRate = SAMPLE_RATE): Uint8Array {
  const dataBytes = samples.length * 2;
  const header = [
    ...ascii('RIFF'),
    ...u32le(36 + dataBytes),
    ...ascii('WAVE'),
    ...ascii('fmt '),
    ...u32le(16),
    ...u16le(1), // PCM
    ...u16le(1), // mono
    ...u32le(sampleRate),
    ...u32le(sampleRate * 2), // byte rate
    ...u16le(2), // block align
    ...u16le(16), // bits per sample
    ...ascii('data'),
    ...u32le(dataBytes),
  ];
  const out = new Uint8Array(header.length + dataBytes);
  out.set(header, 0);
  const view = new DataView(out.buffer, out.byteOffset + header.length, dataBytes);
  for (let i = 0; i < samples.length; i++) {
    // Round-half-away-from-zero then clamp, so a sample at exactly 1.0 does not wrap to
    // -32768 — the one arithmetic trap in PCM conversion.
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    const scaled = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    view.setInt16(i * 2, Math.max(-32768, Math.min(32767, scaled)), true);
  }
  return out;
}
