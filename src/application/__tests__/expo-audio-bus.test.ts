import type { AudioConfig, AudioCue } from '../../sim/content-schemas';
import type { AppPreferences } from '../career-state';

/**
 * The mixer itself — SPEC §18's "audio mixes with working sliders", as a test (P6 T13).
 *
 * The ship pass found this class untested: `audio-bus.test.ts` covers P5's deliberately
 * silent stub and `cue-router.test.ts` covers *which* cue fires, so nothing asserted the
 * arithmetic that turns three sliders into a volume. Every line below is a DoD line or a
 * failure the class's own comments name as the reason it is shaped this way.
 */

interface FakePlayer {
  volume: number;
  loop: boolean;
  playing: boolean;
  play: () => void;
  pause: () => void;
  remove: () => void;
  seekTo: (seconds: number) => void;
}

const mockPlayers: FakePlayer[] = [];
const mockRemoved: FakePlayer[] = [];
let mockRejectPlay = false;

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => {
    const player: FakePlayer = {
      volume: 1,
      loop: false,
      playing: false,
      play: () => {
        if (mockRejectPlay) throw new Error('NotAllowedError: play() blocked before a gesture');
        player.playing = true;
      },
      pause: () => {
        player.playing = false;
      },
      remove: () => {
        player.playing = false;
        mockRemoved.push(player);
      },
      seekTo: () => undefined,
    };
    mockPlayers.push(player);
    return player;
  },
}));

jest.mock('../audio/assets', () => ({
  AUDIO_ASSETS: { 'music.day': 1, 'ui.queue.insert': 2 },
}));

import { ExpoAudioBus } from '../audio/expo-audio-bus';

const cue = (assetId: string, gain: number): AudioCue =>
  ({ id: assetId, assetId, gain }) as unknown as AudioCue;

const config = {} as AudioConfig;

const mix = (over: Partial<AppPreferences['audio']> = {}): AppPreferences['audio'] =>
  ({ master: 1, music: 1, sfx: 1, muted: false, ...over }) as AppPreferences['audio'];

/** Native env: no gesture requirement, no dev auto-mute, so the mix is observable. */
const bus = (audio = mix()) =>
  new ExpoAudioBus(config, audio, { dev: false, platform: 'ios' });

beforeEach(() => {
  mockPlayers.length = 0;
  mockRemoved.length = 0;
  mockRejectPlay = false;
});

describe('the mix (SPEC §18: audio mixes with working sliders)', () => {
  it('multiplies master by the channel by the cue’s authored gain', () => {
    const b = bus(mix({ master: 0.5, music: 0.5 }));
    b.playLoop('bed', cue('music.day', 0.8), 'music');
    expect(mockPlayers[0]!.volume).toBeCloseTo(0.5 * 0.5 * 0.8, 6);
  });

  it('sends music through the music slider and SFX through the SFX slider', () => {
    const b = bus(mix({ music: 0.25, sfx: 1 }));
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.playCue('insert', cue('ui.queue.insert', 1));
    expect(mockPlayers[0]!.volume).toBeCloseTo(0.25, 6);
    expect(mockPlayers[1]!.volume).toBeCloseTo(1, 6);
  });

  it('moves every live voice when a slider moves, not just the next one to start', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.playCue('insert', cue('ui.queue.insert', 1));
    b.apply(mix({ master: 0.2 }));
    expect(mockPlayers[0]!.volume).toBeCloseTo(0.2, 6);
    expect(mockPlayers[1]!.volume).toBeCloseTo(0.2, 6);
  });

  it('mute wins over all three, and unmuting restores the mix rather than full volume', () => {
    const b = bus(mix({ master: 0.6, music: 0.5 }));
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.apply(mix({ master: 0.6, music: 0.5, muted: true }));
    expect(mockPlayers[0]!.volume).toBe(0);
    b.apply(mix({ master: 0.6, music: 0.5, muted: false }));
    expect(mockPlayers[0]!.volume).toBeCloseTo(0.3, 6);
  });

  it('clamps a hostile mix into 0..1 instead of handing the player an invalid volume', () => {
    const b = bus(mix({ master: 4, music: 4 }));
    b.playLoop('bed', cue('music.day', 4), 'music');
    expect(mockPlayers[0]!.volume).toBe(1);
    b.apply(mix({ master: -1 }));
    expect(mockPlayers[0]!.volume).toBe(0);
  });

  it('reports mute so the HUD and the M binding read the bus, not a second copy', () => {
    const b = bus(mix({ muted: true }));
    expect(b.muted).toBe(true);
  });
});

describe('browser autoplay (the failure the class was reshaped around)', () => {
  it('leaves a blocked voice pending and recovers it on the first gesture', () => {
    mockRejectPlay = true;
    const b = new ExpoAudioBus(config, mix(), { dev: false, platform: 'web' });
    b.playLoop('bed', cue('music.day', 1), 'music');
    expect(mockPlayers[0]!.playing).toBe(false);
    expect(b.isUnlocked).toBe(false);

    mockRejectPlay = false;
    b.unlock();
    // A rejected play must not count as started, or the never-double-play guard refuses
    // to retry and the whole session runs silent.
    expect(mockPlayers[0]!.playing).toBe(true);
    expect(b.isUnlocked).toBe(true);
  });

  it('auto-mutes a dev web preview, per SPEC §14 dev hygiene', () => {
    const b = new ExpoAudioBus(config, mix(), { dev: true, platform: 'web' });
    expect(b.muted).toBe(true);
  });

  it('keeps the dev auto-mute when stored preferences arrive', () => {
    // The rule used to be seeded into `settings.muted`, and the composition root applies
    // stored preferences on mount — so the very first `apply()` overwrote it and the dev
    // preview was audible from the second tick onwards.
    const b = new ExpoAudioBus(config, mix(), { dev: true, platform: 'web' });
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.apply(mix({ muted: false }));
    expect(b.muted).toBe(true);
    expect(mockPlayers[0]!.volume).toBe(0);
  });

  it('needs no gesture on native', () => {
    expect(bus().isUnlocked).toBe(true);
  });
});

describe('voices', () => {
  it('is idempotent per key, so a repeated minute does not restart the music', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.playLoop('bed', cue('music.day', 1), 'music');
    expect(mockPlayers).toHaveLength(1);
  });

  it('restarts a paused loop that is still wanted', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.stop('bed');
    expect(mockPlayers[0]!.playing).toBe(false);
    b.playLoop('bed', cue('music.day', 1), 'music');
    expect(mockPlayers[0]!.playing).toBe(true);
  });

  it('retriggers a one-shot in place rather than stacking a second voice', () => {
    const b = bus();
    b.playCue('click', cue('ui.queue.insert', 1));
    b.playCue('click', cue('ui.queue.insert', 1));
    expect(mockRemoved).toHaveLength(1);
    expect(b.has('click')).toBe(true);
  });

  it('names a missing asset instead of throwing inside a frame callback', () => {
    const b = bus();
    b.playLoop('nope', cue('not.authored', 1), 'music');
    expect(b.missingAssets()).toEqual(['not.authored']);
    expect(mockPlayers).toHaveLength(0);
  });

  it('leaves no orphaned audio after shutdown (SPEC §14 QA line)', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.playCue('insert', cue('ui.queue.insert', 1));
    b.shutdown();
    expect(mockRemoved).toHaveLength(2);
    expect(b.has('bed')).toBe(false);
  });

  it('stays shut down — a late unlock cannot resurrect a closed tab’s audio', () => {
    const b = new ExpoAudioBus(config, mix(), { dev: false, platform: 'web' });
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.shutdown();
    b.unlock();
    expect(mockPlayers[0]!.playing).toBe(false);
  });
});

/**
 * The volume ramp `content/audio.json`'s `crossfadeMs` was authored for.
 *
 * Without it the router's 19:00 "crossfade" was `playLoop(incoming)` then `remove(outgoing)`
 * in one synchronous call — a hard cut on the beat design.md §7 calls the coziest of the day.
 */
describe('fades', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ramps a voice down over the requested duration instead of cutting it', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    expect(mockPlayers[0]!.volume).toBeCloseTo(1, 6);

    b.fadeTo('bed', 0, 1000);
    jest.advanceTimersByTime(500);
    const halfway = mockPlayers[0]!.volume;
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(1);

    jest.advanceTimersByTime(600);
    expect(mockPlayers[0]!.volume).toBe(0);
  });

  it('fades a voice in from silence when given a starting level', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.fadeTo('bed', 1, 1000, { from: 0 });
    expect(mockPlayers[0]!.volume).toBe(0);
    jest.advanceTimersByTime(1100);
    expect(mockPlayers[0]!.volume).toBeCloseTo(1, 6);
  });

  it('releases the voice once a fade-out reaches silence', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.fadeTo('bed', 0, 1000, { removeWhenSilent: true });
    expect(b.has('bed')).toBe(true); // still overlapping the incoming bed
    jest.advanceTimersByTime(1100);
    expect(b.has('bed')).toBe(false);
    expect(mockRemoved).toHaveLength(1);
  });

  it('lets the mixer keep winning mid-ramp', () => {
    // The ramp is a multiplier on the computed mix, not a write over it, so a slider moved
    // during a four-second crossfade lands at the right level rather than being stomped.
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.fadeTo('bed', 0, 1000);
    jest.advanceTimersByTime(500);
    b.apply(mix({ master: 0.5 }));
    expect(mockPlayers[0]!.volume).toBeLessThanOrEqual(0.5);
    b.apply(mix({ muted: true }));
    expect(mockPlayers[0]!.volume).toBe(0);
  });

  it('lets a second fade cancel the first rather than racing it', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.fadeTo('bed', 0, 1000, { removeWhenSilent: true });
    jest.advanceTimersByTime(500);
    b.fadeTo('bed', 1, 0); // the bed came back before the fade finished
    jest.advanceTimersByTime(2000);
    expect(b.has('bed')).toBe(true);
    expect(mockPlayers[0]!.volume).toBeCloseTo(1, 6);
  });

  it('cancels a running ramp on shutdown, so no timer outlives the tab', () => {
    const b = bus();
    b.playLoop('bed', cue('music.day', 1), 'music');
    b.fadeTo('bed', 0, 1000, { removeWhenSilent: true });
    b.shutdown();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores a fade aimed at a voice that is not playing', () => {
    const b = bus();
    expect(() => b.fadeTo('nothing', 0, 1000)).not.toThrow();
  });
});
