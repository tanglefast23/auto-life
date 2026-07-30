import type { AudioConfig, FloorMaterial } from '../../sim/content-schemas';
import { EVENING_START_MINUTE } from '../../render/lighting';

/**
 * Domain events and snapshot state → audio cues (P6 T9/T10).
 *
 * Pure routing: it decides *what should be sounding*, and a bus decides how. That split is
 * what makes the two rules below testable without an audio device, which matters because
 * both are rules HFM learned the expensive way
 * (docs/lessons-from-hero-football-manager.md §3.1–3.3):
 *
 *  - **One completed action owns exactly one sound.** No doubled clicks, no cue fired from
 *    inside a state updater, and cancel never inherits a celebration.
 *  - **Silent during hydration.** P5 restores a career by replaying pending boundary work.
 *    Without this, a reload would replay a day of completions and fire a day of sounds at
 *    once — the loudest possible way to greet someone reopening a tab.
 */

export type MusicBed = 'day' | 'evening';

export interface BusLike {
  playLoop(key: string, cue: { assetId: string; gain: number }, channel?: 'music' | 'sfx'): void;
  playCue(key: string, cue: { assetId: string; gain: number }): void;
  stop(key: string): void;
  remove(key: string): void;
  has(key: string): boolean;
}

export type DomainCueEvent =
  | { kind: 'queue-card-inserted' }
  | { kind: 'queue-card-removed' }
  | { kind: 'activity-started'; activityId: string }
  | { kind: 'activity-completed'; activityId: string }
  | { kind: 'activity-stopped'; activityId: string }
  | { kind: 'adjacency-granted' }
  | { kind: 'urgent-raised' }
  | { kind: 'recap-shown' };

export interface MusicInputs {
  minuteOfDay: number;
  practiceLevel: 0 | 1 | 2 | 3;
  practicing: boolean;
  paused: boolean;
  rain?: boolean;
}

/**
 * Stable voice keys, so a repeat retriggers one slot instead of stacking voices.
 *
 * The bed is keyed **per variant**, not one shared `music.bed` slot. `playLoop` is
 * idempotent per key — that is what stops a repeated minute restarting the music — so a
 * shared key meant the 19:00 change re-called the slot that was already live and returned
 * early: the evening bed never started and the day bed simply kept playing. Separate keys
 * let the incoming bed start while the outgoing one is still sounding, which is what makes
 * it a crossfade rather than a cut.
 */
const bedKey = (bed: MusicBed) => `music.bed.${bed}`;
const RIFF_KEY = 'music.riff';
const ROOM_KEY = 'ambience.room';
const RAIN_KEY = 'ambience.rain';

export class CueRouter {
  private bed: MusicBed | null = null;
  private riffLevel: number | null = null;
  private readonly loops = new Set<string>();
  private paused = false;
  private hydrating = false;

  constructor(
    private readonly bus: BusLike,
    private readonly audio: AudioConfig,
  ) {}

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      if (this.bed !== null) this.bus.stop(bedKey(this.bed));
      this.bus.stop(RIFF_KEY);
      this.bus.stop(ROOM_KEY);
      this.bus.stop(RAIN_KEY);
      for (const key of this.loops) this.bus.stop(key);
    }
  }

  setHydrating(hydrating: boolean): void {
    this.hydrating = hydrating;
  }

  /** Which bed a minute belongs to — the same boundary the tiles use, by construction. */
  bedFor(minuteOfDay: number): MusicBed {
    const raw = Number.isFinite(minuteOfDay) ? Math.floor(minuteOfDay) : 0;
    const m = ((raw % 1440) + 1440) % 1440;
    return m >= EVENING_START_MINUTE || m < 6 * 60 ? 'evening' : 'day';
  }

  /**
   * Drive the continuous layers.
   *
   * The incoming bed starts **before** the outgoing one stops, so the 19:00 change is a
   * crossfade rather than a gap — SPEC §11.3 calls it "the coziest beat of the day", and a
   * half-second of silence in the middle of it would be the opposite.
   */
  onMinute(inputs: MusicInputs): void {
    if (this.paused) return;

    const wanted = this.bedFor(inputs.minuteOfDay);
    if (wanted !== this.bed) {
      const outgoing = this.bed;
      // Incoming first, outgoing second — the overlap is the crossfade.
      this.bus.playLoop(bedKey(wanted), this.audio.music[wanted], 'music');
      if (outgoing !== null) this.bus.remove(bedKey(outgoing));
      this.bed = wanted;
    }

    // The riff layers over the bed; it never replaces it (SPEC §14).
    if (inputs.practicing) {
      const riff = this.audio.practiceRiffs.find((r) => r.level === inputs.practiceLevel);
      if (riff !== undefined && this.riffLevel !== inputs.practiceLevel) {
        this.bus.remove(RIFF_KEY);
        this.bus.playLoop(RIFF_KEY, riff, 'music');
        this.riffLevel = inputs.practiceLevel;
      }
    } else if (this.riffLevel !== null) {
      this.bus.remove(RIFF_KEY);
      this.riffLevel = null;
    }

    this.bus.playLoop(ROOM_KEY, this.audio.ambience.room, 'sfx');
    if (inputs.rain === true) this.bus.playLoop(RAIN_KEY, this.audio.ambience.rain, 'sfx');
    else if (this.bus.has(RAIN_KEY)) this.bus.remove(RAIN_KEY);
  }

  /** A footstep per walk-cycle contact, pitched by the floor the sim is standing on. */
  onFootstep(material: FloorMaterial): void {
    if (this.paused || this.hydrating) return;
    const cue = this.audio.footsteps[material];
    if (cue === undefined) return;
    this.bus.playCue('sfx.footstep', cue);
  }

  onEvents(events: readonly DomainCueEvent[]): void {
    if (this.paused || this.hydrating) return;
    for (const event of events) this.route(event);
  }

  /** Activity loops that have not been stopped — exposed so teardown can be asserted. */
  activeLoops(): string[] {
    return [...this.loops].sort();
  }

  /** Activities with no authored loop. The T13 bill gate reads this. */
  unauthored(activityIds: readonly string[]): string[] {
    return activityIds.filter((id) => this.audio.activityLoops[id] === undefined).sort();
  }

  private route(event: DomainCueEvent): void {
    switch (event.kind) {
      case 'queue-card-inserted':
        this.bus.playCue('sfx.queue.insert', this.audio.cues.queueInsert);
        return;
      case 'queue-card-removed':
        // Deliberately not the completion cue. Removing a card is not an achievement, and
        // giving it one is the same class of mistake as cancel inheriting celebration.
        this.bus.playCue('sfx.queue.remove', this.audio.cues.queueRemove);
        return;
      case 'activity-started': {
        const loop = this.audio.activityLoops[event.activityId];
        if (loop === undefined) return; // most activities are silent; that is not an error
        const key = `loop.${event.activityId}`;
        this.loops.add(key);
        this.bus.playLoop(key, loop, 'sfx');
        return;
      }
      case 'activity-completed':
        this.stopLoop(event.activityId);
        this.bus.playCue('sfx.queue.complete', this.audio.cues.queueComplete);
        return;
      case 'activity-stopped':
        // Stop is a player cancelling. The loop ends; no completion sound is earned.
        this.stopLoop(event.activityId);
        return;
      case 'adjacency-granted':
        this.bus.playCue('sfx.adjacency', this.audio.cues.adjacency);
        return;
      case 'urgent-raised':
        this.bus.playCue('sfx.urgency', this.audio.cues.urgency);
        return;
      case 'recap-shown':
        this.bus.playCue('sfx.recap', this.audio.cues.recap);
        return;
    }
  }

  private stopLoop(activityId: string): void {
    const key = `loop.${activityId}`;
    if (!this.loops.has(key)) return;
    this.bus.remove(key);
    this.loops.delete(key);
  }
}
