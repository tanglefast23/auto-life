import { createAudioPlayer } from 'expo-audio';
import type { AudioConfig, AudioCue } from '../../sim/content-schemas';
import type { AppPreferences } from '../career-state';
import type { AudioBus } from '../audio-bus';
import { AUDIO_ASSETS } from './assets';

/**
 * The real mixer (P6 T8), behind the `AudioBus` interface P5 defined.
 *
 * P5 shipped every control — Master/Music/SFX sliders, mute, the `M` binding, and
 * persistence — against a bus that deliberately made no sound. This is the implementation
 * those controls were always for, so `ApplicationRoot` swaps one constructor and nothing
 * else moves.
 *
 * Three things here exist because of specific recorded failures rather than general
 * caution:
 *
 *  - **Autoplay.** Desktop Chrome is the frozen playtest browser and it blocks playback
 *    before a user gesture. A rejected `play()` must not count as started, or the
 *    never-double-play guard then refuses to retry and the whole session runs silent —
 *    the exact shape an audit caught in this plan's own draft. Hence `unlock()` and the
 *    pending-replay set.
 *  - **Teardown.** HFM needed recovery logic across four audio banks after the fact
 *    (docs/lessons-from-hero-football-manager.md §3.3). `shutdown()` removes every player
 *    and is wired to the lifecycle barrier P5 already owns, so no audio survives a closed
 *    tab or a parked stale tab.
 *  - **Missing assets are named, not thrown.** A throw inside a frame callback takes the
 *    app down for a sound. `missingAssets()` is how the T13 bill gate proves the set is
 *    complete.
 */

type Player = ReturnType<typeof createAudioPlayer>;

export interface BusEnvironment {
  dev?: boolean;
  platform?: string;
}

/** How often a ramp updates. Matches the renderer's own 32 ms transition cadence. */
const RAMP_TICK_MS = 32;

export interface FadeOptions {
  /**
   * Level to jump to before the ramp begins — how a voice fades *in* from silence. Without
   * it a newly created voice is already at full and "fade in" would be a no-op.
   */
  from?: number;
  /** Remove the voice once the ramp reaches zero, so a faded-out loop frees its player. */
  removeWhenSilent?: boolean;
}

interface Voice {
  player: Player;
  cue: AudioCue;
  channel: 'music' | 'sfx';
  loop: boolean;
  wantsPlay: boolean;
  /**
   * Ramp position, 0..1, multiplied onto the computed mix rather than written over it.
   *
   * That is the whole reason a fade cannot fight the mixer: `applyVolume` still derives
   * master × channel × gain and mute still wins, so moving a slider halfway through a
   * four-second crossfade lands at the right level instead of being stomped 32 ms later.
   */
  fade: number;
  /** The live ramp, held so a second crossfade cancels the first instead of racing it. */
  ramp: ReturnType<typeof setInterval> | null;
}

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export class ExpoAudioBus implements AudioBus {
  private settings: AppPreferences['audio'];
  private readonly voices = new Map<string, Voice>();
  private readonly missing = new Set<string>();
  /**
   * SPEC §14 dev hygiene: "web previews auto-muted in dev builds".
   *
   * A latch rather than a seeded `settings.muted`, because the composition root applies
   * stored preferences on mount — so the seeded version was overwritten by the first
   * `apply()` and the rule lasted until the end of the constructor. Silent while the mixer
   * itself was silent; audible the moment the cue router was actually wired.
   */
  private readonly devMuted: boolean;
  private unlocked: boolean;
  private disposed = false;

  constructor(
    private readonly audio: AudioConfig,
    initial: AppPreferences['audio'],
    env: BusEnvironment = {},
  ) {
    const dev = env.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__);
    const web = (env.platform ?? 'web') === 'web';
    this.devMuted = dev && web;
    this.settings = { ...initial };
    // Native has no gesture requirement; web stays locked until the first interaction.
    this.unlocked = !web;
  }

  get muted(): boolean {
    return this.devMuted || this.settings.muted;
  }

  apply(settings: AppPreferences['audio']): void {
    this.settings = { ...settings };
    for (const voice of this.voices.values()) this.applyVolume(voice);
  }

  /**
   * Called from the first real user gesture. Retries anything that wanted to play while
   * the browser was still refusing.
   */
  unlock(): void {
    if (this.unlocked || this.disposed) return;
    this.unlocked = true;
    for (const voice of this.voices.values()) {
      if (voice.wantsPlay) this.start(voice);
    }
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  missingAssets(): string[] {
    return [...this.missing].sort();
  }

  /** Start or keep a looping voice. Idempotent: calling twice does not restart it. */
  playLoop(key: string, cue: AudioCue, channel: 'music' | 'sfx' = 'music'): void {
    const existing = this.voices.get(key);
    if (existing !== undefined) {
      existing.wantsPlay = true;
      if (!existing.player.playing) this.start(existing);
      return;
    }
    const voice = this.create(cue, channel, true);
    if (voice === null) return;
    this.voices.set(key, voice);
    voice.wantsPlay = true;
    this.start(voice);
  }

  /** A one-shot cue. One completed action owns exactly one sound (HFM §3.2). */
  playCue(key: string, cue: AudioCue): void {
    const voice = this.create(cue, 'sfx', false);
    if (voice === null) return;
    // Reuse the slot so a rapid repeat retriggers rather than stacking a second voice on
    // top of the first, which is how HFM ended up with doubled clicks.
    this.remove(key);
    this.voices.set(key, voice);
    voice.wantsPlay = true;
    this.start(voice);
  }

  stop(key: string): void {
    const voice = this.voices.get(key);
    if (voice === undefined) return;
    voice.wantsPlay = false;
    voice.player.pause();
  }

  has(key: string): boolean {
    return this.voices.has(key);
  }

  /**
   * Ramp a voice's level over time — the thing `content/audio.json`'s `crossfadeMs` was
   * always for.
   *
   * Before this existed the router's "crossfade" was `playLoop(incoming)` followed by
   * `remove(outgoing)` in the same synchronous call, and `remove()` detaches the media
   * element instantly: design.md §7's "coziest beat of the day" was a hard cut with an
   * authored 4000 ms sitting unread in the schema.
   */
  fadeTo(key: string, target: number, durationMs: number, options: FadeOptions = {}): void {
    const voice = this.voices.get(key);
    if (voice === undefined) return;
    this.clearRamp(voice);
    if (options.from !== undefined) voice.fade = clamp01(options.from);
    const from = voice.fade;
    const to = clamp01(target);
    const finish = (): void => {
      voice.fade = to;
      this.applyVolume(voice);
      if (to === 0 && options.removeWhenSilent === true) this.remove(key);
    };
    if (!Number.isFinite(durationMs) || durationMs <= 0 || from === to) {
      finish();
      return;
    }
    this.applyVolume(voice);
    const started = Date.now();
    voice.ramp = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / durationMs);
      if (t >= 1) {
        this.clearRamp(voice);
        finish();
        return;
      }
      voice.fade = from + (to - from) * t;
      this.applyVolume(voice);
    }, RAMP_TICK_MS);
  }

  remove(key: string): void {
    const voice = this.voices.get(key);
    if (voice === undefined) return;
    this.clearRamp(voice);
    voice.player.remove();
    this.voices.delete(key);
  }

  /** No orphaned audio after tab close — SPEC §14's QA line, as code. */
  shutdown(): void {
    this.disposed = true;
    for (const voice of this.voices.values()) {
      // A live ramp is a timer, and a timer outlives a removed player. Leaving one running
      // is the same orphan this method exists to prevent, one indirection further out.
      this.clearRamp(voice);
      voice.player.remove();
    }
    this.voices.clear();
  }

  private clearRamp(voice: Voice): void {
    if (voice.ramp === null) return;
    clearInterval(voice.ramp);
    voice.ramp = null;
  }

  private create(cue: AudioCue, channel: 'music' | 'sfx', loop: boolean): Voice | null {
    const source = AUDIO_ASSETS[cue.assetId];
    if (source === undefined) {
      this.missing.add(cue.assetId);
      return null;
    }
    const player = createAudioPlayer(source);
    player.loop = loop;
    const voice: Voice = { player, cue, channel, loop, wantsPlay: false, fade: 1, ramp: null };
    this.applyVolume(voice);
    return voice;
  }

  private start(voice: Voice): void {
    if (!this.unlocked) return; // stays pending; `unlock()` retries it
    try {
      voice.player.play();
    } catch {
      // A rejected play is *not* a started voice. Leaving `wantsPlay` true is what lets
      // the first gesture recover it instead of the session running silent forever.
      this.unlocked = false;
    }
  }

  /**
   * master × channel × the cue's authored gain, with mute winning over all three.
   *
   * Mute sets the output to zero without touching the stored mix, so unmuting restores
   * what the player had rather than jumping to full volume.
   */
  private applyVolume(voice: Voice): void {
    const channel = voice.channel === 'music' ? this.settings.music : this.settings.sfx;
    const level = this.muted
      ? 0
      : this.settings.master * channel * voice.cue.gain * voice.fade;
    voice.player.volume = clamp01(level);
  }

  /** Exposed for the cue router, which needs the same content the bus was built with. */
  get config(): AudioConfig {
    return this.audio;
  }
}
