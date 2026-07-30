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

interface Voice {
  player: Player;
  cue: AudioCue;
  channel: 'music' | 'sfx';
  loop: boolean;
  wantsPlay: boolean;
}

export class ExpoAudioBus implements AudioBus {
  private settings: AppPreferences['audio'];
  private readonly voices = new Map<string, Voice>();
  private readonly missing = new Set<string>();
  private unlocked: boolean;
  private disposed = false;

  constructor(
    private readonly audio: AudioConfig,
    initial: AppPreferences['audio'],
    env: BusEnvironment = {},
  ) {
    const dev = env.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__);
    const web = (env.platform ?? 'web') === 'web';
    // SPEC §14 dev hygiene: "web previews auto-muted in dev builds".
    this.settings = dev && web ? { ...initial, muted: true } : { ...initial };
    // Native has no gesture requirement; web stays locked until the first interaction.
    this.unlocked = !web;
  }

  get muted(): boolean {
    return this.settings.muted;
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
    this.voices.get(key)?.player.remove();
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

  remove(key: string): void {
    const voice = this.voices.get(key);
    if (voice === undefined) return;
    voice.player.remove();
    this.voices.delete(key);
  }

  /** No orphaned audio after tab close — SPEC §14's QA line, as code. */
  shutdown(): void {
    this.disposed = true;
    for (const voice of this.voices.values()) voice.player.remove();
    this.voices.clear();
  }

  private create(cue: AudioCue, channel: 'music' | 'sfx', loop: boolean): Voice | null {
    const source = AUDIO_ASSETS[cue.assetId];
    if (source === undefined) {
      this.missing.add(cue.assetId);
      return null;
    }
    const player = createAudioPlayer(source);
    player.loop = loop;
    const voice: Voice = { player, cue, channel, loop, wantsPlay: false };
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
    const level = this.settings.muted ? 0 : this.settings.master * channel * voice.cue.gain;
    voice.player.volume = Math.max(0, Math.min(1, level));
  }

  /** Exposed for the cue router, which needs the same content the bus was built with. */
  get config(): AudioConfig {
    return this.audio;
  }
}
