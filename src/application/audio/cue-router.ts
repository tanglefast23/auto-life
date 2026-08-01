import type { AudioConfig, AudioCue, FloorMaterial } from '../../sim/content-schemas';
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
  fadeTo(
    key: string,
    target: number,
    durationMs: number,
    options?: { from?: number; removeWhenSilent?: boolean },
  ): void;
}

export type DomainCueEvent =
  | { kind: 'queue-card-inserted' }
  | { kind: 'queue-card-removed' }
  | { kind: 'activity-started'; activityId: string }
  /** `graded` is the band when this completion resolved a check (docs/08 §11.4). */
  | { kind: 'activity-completed'; activityId: string; graded?: 'high' | 'mid' | 'low' }
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
 * The bed is keyed **per asset**, not per variant and not one shared `music.bed` slot.
 * `playLoop` is idempotent per key — that is what stops a repeated minute restarting the
 * music — so a single shared key meant the 19:00 change re-called the slot that was already
 * live and returned early: the evening bed never started and the day bed simply kept
 * playing. Distinct keys let the incoming bed start while the outgoing one is still
 * sounding, which is what makes it a crossfade rather than a cut.
 *
 * Keying by *asset* rather than by variant name adds the converse guarantee. When day and
 * evening are the same track — which is the shipped configuration — the two variants
 * resolve to one key, `playLoop`'s idempotency keeps the single voice running across the
 * boundary, and `onMinute` skips the crossfade entirely. Keyed by variant, the same
 * configuration would have started a second player of the same file and crossfaded it
 * against itself for four seconds: two copies of one track a few bars apart is audible
 * phasing, not a transition.
 */
const bedKey = (audio: AudioConfig, bed: MusicBed) =>
  `music.bed.${audio.music[bed].assetId}`;
const RIFF_KEY = 'music.riff';
const ROOM_KEY = 'ambience.room';
const RAIN_KEY = 'ambience.rain';

export class CueRouter {
  private bed: MusicBed | null = null;
  private riffLevel: number | null = null;
  /** Live activity loops, keyed by voice key and holding the cue needed to restart them. */
  private readonly loops = new Map<string, AudioCue>();
  private raining = false;
  private paused = false;
  private hydrating = false;

  constructor(
    private readonly bus: BusLike,
    private readonly audio: AudioConfig,
  ) {}

  /**
   * Pause silences every continuous voice; resume puts them all back.
   *
   * The resume half is not symmetry for its own sake. Every one of these layers is started
   * by a *change* — the bed at 06:00 and 19:00, the riff at a practice-level change, an
   * activity loop when a different activity starts — so a paused-then-resumed session had
   * nothing to restart it: the bed stayed silent until the next boundary, up to thirteen
   * game-hours away, and a tracked activity loop never came back at all. Only the room and
   * rain ambience recovered, because `onMinute` re-issues those every minute, which is
   * precisely what made the gap look like it was working.
   */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      if (this.bed !== null) this.bus.stop(bedKey(this.audio, this.bed));
      this.bus.stop(RIFF_KEY);
      this.bus.stop(ROOM_KEY);
      this.bus.stop(RAIN_KEY);
      for (const key of this.loops.keys()) this.bus.stop(key);
      return;
    }
    if (this.bed !== null) {
      this.bus.playLoop(bedKey(this.audio, this.bed), this.audio.music[this.bed], 'music');
    }
    if (this.riffLevel !== null) {
      const riff = this.audio.practiceRiffs.find((r) => r.level === this.riffLevel);
      if (riff !== undefined) this.bus.playLoop(RIFF_KEY, riff, 'music');
    }
    for (const [key, cue] of this.loops) this.bus.playLoop(key, cue, 'sfx');
    this.bus.playLoop(ROOM_KEY, this.audio.ambience.room, 'sfx');
    if (this.raining) this.bus.playLoop(RAIN_KEY, this.audio.ambience.rain, 'sfx');
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
   *
   * Overlapping the two voices is necessary but was not sufficient: the first version paired
   * `playLoop(incoming)` with `remove(outgoing)` in the same synchronous call, and `remove()`
   * detaches its media element on the spot. Both voices did exist at once, for roughly no
   * time at all, so the "crossfade" was a hard cut with the authored `crossfadeMs` read by
   * nothing. The ramps below are what spend it.
   */
  onMinute(inputs: MusicInputs): void {
    if (this.paused) return;

    const wanted = this.bedFor(inputs.minuteOfDay);
    if (wanted !== this.bed) {
      const outgoing = this.bed;
      const crossfadeMs = this.audio.music.crossfadeMs;
      const incomingKey = bedKey(this.audio, wanted);
      const outgoingKey = outgoing === null ? null : bedKey(this.audio, outgoing);
      if (outgoingKey === incomingKey) {
        // Both variants are the same track, so there is nothing to cross to. Crossfading
        // here would fade the one live voice down to silence and back up — a dip in the
        // middle of a track that never changed. Record the variant and leave it playing.
        this.bed = wanted;
      } else {
        // Incoming first, outgoing second — the overlap is the crossfade.
        this.bus.playLoop(incomingKey, this.audio.music[wanted], 'music');
        if (outgoingKey === null) {
          // The session's first bed has nothing to fade from, so it simply starts.
          this.bus.fadeTo(incomingKey, 1, 0);
        } else {
          this.bus.fadeTo(incomingKey, 1, crossfadeMs, { from: 0 });
          this.bus.fadeTo(outgoingKey, 0, crossfadeMs, { removeWhenSilent: true });
        }
        this.bed = wanted;
      }
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
    this.raining = inputs.rain === true;
    if (this.raining) this.bus.playLoop(RAIN_KEY, this.audio.ambience.rain, 'sfx');
    else if (this.bus.has(RAIN_KEY)) this.bus.remove(RAIN_KEY);
  }

  /**
   * The bar beat of the grade sequence (docs/08 §11.1), fired by the UI's own timeline.
   *
   * Driven from presentation rather than from a domain event for the same reason
   * `onFootstep` is: the sound belongs to a moment inside an animation, not to a tick. Sound
   * *policy* still lives here, so pause and hydration silence it like everything else.
   */
  onBarPop(): void {
    if (this.paused || this.hydrating) return;
    this.bus.playCue('sfx.bar.pop', this.audio.cues.barPop);
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
    return [...this.loops.keys()].sort();
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
        this.loops.set(key, loop);
        this.bus.playLoop(key, loop, 'sfx');
        return;
      }
      case 'activity-completed': {
        this.stopLoop(event.activityId);
        // A graded completion plays the grade INSTEAD of the generic settle. It is a more
        // specific sound, not an extra one — playing both would put two cues on one
        // completed action, which is exactly the rule at the top of this file.
        if (event.graded !== undefined) {
          const cue =
            event.graded === 'high'
              ? this.audio.cues.gradeHigh
              : event.graded === 'mid'
                ? this.audio.cues.gradeMid
                : this.audio.cues.gradeLow;
          this.bus.playCue('sfx.grade', cue);
          return;
        }
        this.bus.playCue('sfx.queue.complete', this.audio.cues.queueComplete);
        return;
      }
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
