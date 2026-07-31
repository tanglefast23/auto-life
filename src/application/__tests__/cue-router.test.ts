import { content } from '../../sim/content';
import { declaredAudioAssetIds } from '../../sim/content-schemas';
import { CueRouter, type BusLike, type DomainCueEvent } from '../audio/cue-router';
import { EVENING_START_MINUTE } from '../../render/lighting';

/**
 * P6 T9–T10 — the cue router.
 *
 * The rules under test are the ones HFM's handover says cost it the most
 * (docs/lessons-from-hero-football-manager.md §3.1–3.3): feedback is semantic, one
 * completed action owns exactly one sound, and the audio lifecycle is designed on day one
 * rather than patched afterwards.
 */

/** A recording double, so ordering and count are assertable without an audio device. */
class FakeBus implements BusLike {
  readonly events: string[] = [];
  private readonly live = new Set<string>();
  /** Paused voices stay live, exactly as the real bus keeps a paused player in its map. */
  private readonly paused = new Set<string>();

  playLoop(key: string, cue: { assetId: string; gain: number }, channel: 'music' | 'sfx' = 'music'): void {
    if (this.live.has(key)) {
      // Idempotent, like the real bus — except that a paused voice resumes rather than
      // being ignored, which is what makes the post-resume assertions meaningful.
      if (this.paused.delete(key)) this.events.push(`resume:${key}`);
      return;
    }
    this.live.add(key);
    this.events.push(`start:${key}:${cue.assetId}:${channel}`);
  }

  playCue(key: string, cue: { assetId: string; gain: number }): void {
    this.events.push(`cue:${key}:${cue.assetId}`);
  }

  stop(key: string): void {
    if (!this.live.has(key)) return;
    this.paused.add(key);
    this.events.push(`stop:${key}`);
  }

  remove(key: string): void {
    this.paused.delete(key);
    if (this.live.delete(key)) this.events.push(`remove:${key}`);
  }

  has(key: string): boolean {
    return this.live.has(key);
  }

  fadeTo(
    key: string,
    target: number,
    durationMs: number,
    options: { from?: number; removeWhenSilent?: boolean } = {},
  ): void {
    if (!this.live.has(key)) return;
    const tail = options.removeWhenSilent === true ? ':remove' : '';
    const head = options.from === undefined ? '' : `${options.from}->`;
    this.events.push(`fade:${key}:${head}${target}:${durationMs}${tail}`);
    // An instant ramp to silence resolves now; a timed one deliberately does not, so the
    // outgoing voice is still live during the overlap the crossfade exists to create.
    if (durationMs <= 0 && target === 0 && options.removeWhenSilent === true) this.remove(key);
  }

  cueKeys(): string[] {
    return this.events.filter((e) => e.startsWith('cue:')).map((e) => e.split(':').slice(1, -1).join(':'));
  }

  playing(): string[] {
    return [...this.live].sort();
  }

  /** Live and not paused — what a listener would actually be hearing. */
  audible(): string[] {
    return [...this.live].filter((key) => !this.paused.has(key)).sort();
  }
}

const music = (bed: 'day' | 'evening') => ({
  minuteOfDay: bed === 'day' ? 12 * 60 : 20 * 60,
  practiceLevel: 0 as const,
  practicing: false,
  paused: false,
});

describe('music (SPEC §14)', () => {
  it('plays the day bed before 19:00 and the evening bed from 19:00', () => {
    const router = new CueRouter(new FakeBus(), content.audio);
    expect(router.bedFor(EVENING_START_MINUTE - 1)).toBe('day');
    expect(router.bedFor(EVENING_START_MINUTE)).toBe('evening');
  });

  it('changes bed on exactly the minute the lighting changes', () => {
    // `bedFor` and `lightingAt` both read EVENING_START_MINUTE, and the content gate
    // asserts audio.json agrees, so the room and the music cannot disagree about evening.
    expect(content.audio.music.crossfadeMinute).toBe(EVENING_START_MINUTE);
  });

  it('starts the incoming bed before stopping the outgoing one — a crossfade, not a gap', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onMinute(music('day'));
    router.onMinute(music('evening'));
    const starts = bus.events.filter((e) => e.startsWith('start:music.bed'));
    expect(starts).toHaveLength(2);
    expect(starts[0]).toContain(content.audio.music.day.assetId);
    expect(starts[1]).toContain(content.audio.music.evening.assetId);
    // Both beds are live at once. The first version of this assertion checked only that
    // `remove` came after the incoming `start` — which the hard-cut implementation also
    // satisfied, because it removed the outgoing voice on the very next statement.
    expect(bus.playing()).toEqual(expect.arrayContaining(['music.bed.day', 'music.bed.evening']));
  });

  it('spends the authored crossfadeMs ramping both beds, rather than cutting', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    const ms = content.audio.music.crossfadeMs;
    expect(ms).toBeGreaterThan(0);

    router.onMinute(music('day'));
    // The session's first bed has nothing to fade from and simply starts at full.
    expect(bus.events).toContain('fade:music.bed.day:1:0');

    router.onMinute(music('evening'));
    expect(bus.events).toContain(`fade:music.bed.evening:0->1:${ms}`);
    expect(bus.events).toContain(`fade:music.bed.day:0:${ms}:remove`);
    // The outgoing voice is released by the ramp, not detached under it.
    expect(bus.events).not.toContain('remove:music.bed.day');
  });

  it('never double-plays a bed across repeated minutes', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    for (const m of [20 * 60, 20 * 60 + 1, 20 * 60 + 2]) {
      router.onMinute({ ...music('evening'), minuteOfDay: m });
    }
    expect(bus.events.filter((e) => e.startsWith('start:music.bed'))).toHaveLength(1);
  });

  it('layers the Practice riff over the bed rather than replacing it', () => {
    const bus = new FakeBus();
    new CueRouter(bus, content.audio).onMinute({ ...music('day'), practicing: true, practiceLevel: 2 });
    expect(bus.playing()).toEqual(expect.arrayContaining(['music.bed.day', 'music.riff']));
  });

  it('picks a distinct riff asset per Practice level', () => {
    const assets = new Set<string>();
    for (const level of [0, 1, 2, 3] as const) {
      const bus = new FakeBus();
      new CueRouter(bus, content.audio).onMinute({ ...music('day'), practicing: true, practiceLevel: level });
      const start = bus.events.find((e) => e.startsWith('start:music.riff'));
      expect(start).toContain(`riff.l${level}`);
      assets.add(start!);
    }
    expect(assets.size).toBe(4);
  });

  it('drops the riff when the Practice session ends', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onMinute({ ...music('day'), practicing: true, practiceLevel: 1 });
    router.onMinute({ ...music('day'), practicing: false });
    expect(bus.playing()).not.toContain('music.riff');
  });

  it('swaps ambience to rain for the wrinkle variant and back again', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onMinute({ ...music('day'), rain: true });
    expect(bus.playing()).toContain('ambience.rain');
    router.onMinute({ ...music('day'), rain: false });
    expect(bus.playing()).not.toContain('ambience.rain');
    expect(bus.playing()).toContain('ambience.room');
  });

  it('goes quiet when the game pauses', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onMinute(music('day'));
    router.setPaused(true);
    expect(bus.events).toContain('stop:music.bed.day');
  });

  /**
   * Resume, which pause had no counterpart for.
   *
   * Every continuous layer here is started by a *change*, so nothing re-started them after
   * a pause: the bed waits for the next 06:00/19:00 boundary — up to thirteen game-hours —
   * and a tracked activity loop waits forever. Ambience recovered on its own because
   * `onMinute` re-issues it every minute, which is exactly what disguised the gap.
   */
  it('puts every voice back when the game resumes', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onMinute({ ...music('day'), practicing: true, practiceLevel: 2, rain: true });
    router.onEvents([{ kind: 'activity-started', activityId: 'shower' }]);
    const before = bus.audible();
    expect(before).toEqual(
      expect.arrayContaining(['music.bed.day', 'music.riff', 'ambience.room', 'ambience.rain', 'loop.shower']),
    );

    router.setPaused(true);
    expect(bus.audible()).toEqual([]);

    router.setPaused(false);
    expect(bus.audible()).toEqual(before);
  });

  it('does not resurrect rain that had already stopped', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onMinute({ ...music('day'), rain: true });
    router.onMinute({ ...music('day'), rain: false });
    router.setPaused(true);
    router.setPaused(false);
    expect(bus.audible()).toContain('ambience.room');
    expect(bus.audible()).not.toContain('ambience.rain');
  });

  it('ignores a repeated pause or resume rather than re-issuing voices', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onMinute(music('day'));
    router.setPaused(true);
    router.setPaused(true);
    router.setPaused(false);
    router.setPaused(false);
    expect(bus.events.filter((e) => e === 'stop:music.bed.day')).toHaveLength(1);
    expect(bus.events.filter((e) => e === 'resume:music.bed.day')).toHaveLength(1);
  });
});

describe('SFX (HFM §3.1–3.2)', () => {
  const allEvents: DomainCueEvent[] = [
    { kind: 'queue-card-inserted' },
    { kind: 'queue-card-removed' },
    { kind: 'adjacency-granted' },
    { kind: 'urgent-raised' },
    { kind: 'recap-shown' },
  ];

  it('fires each UI cue exactly once per triggering event', () => {
    const bus = new FakeBus();
    new CueRouter(bus, content.audio).onEvents(allEvents);
    expect(bus.cueKeys()).toEqual([
      'sfx.queue.insert', 'sfx.queue.remove', 'sfx.adjacency', 'sfx.urgency', 'sfx.recap',
    ]);
  });

  it('gives insert and remove opposite sounds, and neither is the completion sound', () => {
    const { queueInsert, queueRemove, queueComplete } = content.audio.cues;
    expect(queueInsert.assetId).not.toBe(queueRemove.assetId);
    // The other direction of HFM's "cancel inherits celebration" bug.
    expect(queueRemove.assetId).not.toBe(queueComplete.assetId);
  });

  it('starts an activity loop on start and stops it on completion', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onEvents([{ kind: 'activity-started', activityId: 'shower' }]);
    expect(bus.playing()).toContain('loop.shower');
    router.onEvents([{ kind: 'activity-completed', activityId: 'shower' }]);
    expect(bus.playing()).not.toContain('loop.shower');
    expect(bus.cueKeys()).toContain('sfx.queue.complete');
  });

  it('stops a loop on Stop, and awards no completion sound for it', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onEvents([{ kind: 'activity-started', activityId: 'treadmill' }]);
    router.onEvents([{ kind: 'activity-stopped', activityId: 'treadmill' }]);
    expect(bus.playing()).not.toContain('loop.treadmill');
    expect(bus.cueKeys()).not.toContain('sfx.queue.complete');
  });

  it('uses the material of the tile the sim is standing on', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.onFootstep('wood');
    router.onFootstep('tile');
    expect(bus.events.filter((e) => e.includes('footstep'))).toEqual([
      'cue:sfx.footstep:footstep.wood',
      'cue:sfx.footstep:footstep.tile',
    ]);
  });

  it('is silent while paused', () => {
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.setPaused(true);
    router.onEvents(allEvents);
    router.onFootstep('wood');
    expect(bus.cueKeys()).toEqual([]);
  });

  it('is silent for events replayed during hydration', () => {
    // P5 restores a career by replaying pending boundary work. Without this, reopening a
    // tab would fire a day of completion sounds at once.
    const bus = new FakeBus();
    const router = new CueRouter(bus, content.audio);
    router.setHydrating(true);
    router.onEvents([{ kind: 'activity-completed', activityId: 'meal' }, { kind: 'adjacency-granted' }]);
    expect(bus.cueKeys()).toEqual([]);
    router.setHydrating(false);
    router.onEvents([{ kind: 'adjacency-granted' }]);
    expect(bus.cueKeys()).toEqual(['sfx.adjacency']);
  });

  it('names activities with no authored loop instead of failing silently', () => {
    const router = new CueRouter(new FakeBus(), content.audio);
    // Most activities are legitimately silent; the point is that the list is inspectable
    // rather than a shrug, so the T13 bill gate can report shipped scope.
    expect(router.unauthored(['idle', 'sleep', 'toilet'])).toEqual(['idle', 'sleep', 'toilet']);
    expect(router.unauthored(['shower', 'meal'])).toEqual([]);
  });
});

describe('audio content and the rendered bank agree', () => {
  it('declares an asset for every SPEC §14 layer, with no id declared twice', () => {
    const ids = declaredAudioAssetIds(content.audio);
    expect(ids).toEqual(expect.arrayContaining([
      content.audio.music.day.assetId,
      content.audio.music.evening.assetId,
      content.audio.ambience.room.assetId,
      content.audio.ambience.rain.assetId,
    ]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers Practice levels 0..3 exactly once', () => {
    expect(content.audio.practiceRiffs.map((r) => r.level).sort()).toEqual([0, 1, 2, 3]);
  });

  it('has a footstep for every floor material the home map uses', () => {
    for (const material of Object.values(content.homeMap.materials)) {
      expect(content.audio.footsteps[material]).toBeDefined();
    }
  });
});
