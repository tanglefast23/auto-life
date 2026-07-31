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
