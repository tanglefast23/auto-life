import type { ContentRegistry } from '../../sim/content';
import { practiceLevel } from '../../sim/practice-level';
import type { CommandOutcome, DomainEvent } from '../../sim/step';
import type { GameSnapshot } from '../snapshot';
import type { DomainCueEvent, MusicInputs } from './cue-router';

/**
 * Published sim truth → cue router inputs (P6 audit).
 *
 * The router was built, tested, and then never handed anything: `ApplicationRoot`
 * constructed one and referenced it nowhere, so the game shipped completely silent while
 * 25 committed WAVs, the mixer, the sliders, and the `M` binding all drove a bus nothing
 * ever asked to make a sound. This module is the missing half, and it is deliberately a
 * **pure** one — every rule below is decidable from two snapshots and a boundary, so what
 * fires when is unit-testable without an audio device or a mounted tree.
 *
 * The split it maintains matters more than it looks:
 *
 *  - **Continuous layers** (bed, riff, ambience) are a function of the *current* snapshot.
 *    `onMinute` is idempotent per voice, so publishing at any rate is safe and a fast-
 *    forwarded night self-corrects the moment the first watched snapshot lands.
 *  - **Discrete cues** are a function of a *transition*. They must fire exactly once, which
 *    is why they read watched boundaries only, and why "an activity started" is derived
 *    from the running card changing rather than from anything the queue reports.
 */

/** The slice of a snapshot the audio layer reads. Small on purpose: it is a cache key too. */
export interface CueView {
  minuteOfDay: number;
  currentCardId: string | null;
  /** What is running, if anything — the loop key for an activity's own sound. */
  currentActivityId: string | null;
  /**
   * Whether the sim is *executing* that card rather than still walking to it.
   *
   * `currentCardId` is set the moment travel toward a card begins, so a start derived
   * from the id alone opened `loop.shower` while she was crossing the house — and all
   * eight authored loops are activities you travel to.
   */
  running: boolean;
  /**
   * The day the morning recap on screen belongs to, or null when none is up.
   *
   * The day rather than a boolean, so the recap for a *new* day still sounds when the
   * previous one was never dismissed — a boolean would read that as "still showing".
   */
  recapDay: number | null;
  practiceLevel: 0 | 1 | 2 | 3;
  practicing: boolean;
}

export function cueViewOf(
  snapshot: GameSnapshot,
  content: ContentRegistry,
): CueView {
  const current =
    snapshot.currentCardId === null
      ? null
      : (snapshot.queue.find((card) => card.id === snapshot.currentCardId)?.activityId ??
        null);
  return {
    minuteOfDay: snapshot.minuteOfDay,
    currentCardId: snapshot.currentCardId,
    currentActivityId: current,
    // `processed` is what stage 4 actually ran this tick, which is the only field that
    // separates "walking to the shower" from "in the shower".
    running: snapshot.processed === 'activity',
    recapDay: snapshot.session.morningRecap?.forDay ?? null,
    practiceLevel: practiceLevel(
      Math.max(0, Math.round(snapshot.practicePoints * 100)),
      content.practice.levels,
    ),
    // SPEC §14's riff layers over the bed *while practising*, which is the running pose
    // rather than the accumulated points.
    practicing: snapshot.render.pose === 'practice',
  };
}

/**
 * Music inputs for one published snapshot.
 *
 * `rain` is deliberately absent rather than wired to `false` by accident: `audio.json`
 * authors a rain ambience for a weather wrinkle that v1 content does not yet deal, so
 * there is no state to read. The router already treats an omitted `rain` as "not raining",
 * and the asset stays declared for the wrinkle that will use it.
 */
export function musicInputsFor(view: CueView, paused: boolean): MusicInputs {
  return {
    minuteOfDay: view.minuteOfDay,
    practiceLevel: view.practiceLevel,
    practicing: view.practicing,
    paused,
  };
}

export interface CueBoundary {
  events: readonly DomainEvent[];
  outcomes: readonly CommandOutcome[];
}

/**
 * Which of the three grade cues a grade earns (docs/08 §11.4).
 *
 * Derived from the letter rather than looked up, so this module stays pure and content-free
 * like the rest of the file. `content/grades.json` carries the same `band` for the UI's
 * colour, and `cue-source.test.ts` asserts the two agree across all fifteen grades — a
 * duplicated rule is only safe when something checks it.
 */
export function gradeBandOf(gradeId: string): 'high' | 'mid' | 'low' {
  const letter = gradeId.charAt(0).toLowerCase();
  if (letter === 'a' || letter === 'b') return 'high';
  if (letter === 'c') return 'mid';
  return 'low';
}

/**
 * The cue events one watched minute produced.
 *
 * Ordering is start → engine events → queue verbs, so a card that starts and completes
 * inside the same tick opens its loop before the completion closes it rather than leaving
 * a loop running with nothing to stop it.
 */
export function domainCueEvents(
  previous: CueView | null,
  next: CueView,
  boundary: CueBoundary,
): DomainCueEvent[] {
  const cues: DomainCueEvent[] = [];

  // A different card is *executing* than was executing a minute ago. Derived from the
  // snapshot rather than from an outcome because most activities start with no command at
  // all — the planner starts them, and the queue verbs below are only the player's half.
  //
  // The transition is into `running`, not into a new card id. Keying on the id alone
  // announced the start at the moment travel began; requiring `running` *and* keying on
  // the id would then never fire at all, because the id does not change again on arrival —
  // it was already the travel target. So the edge that matters is entering `running`, plus
  // the id changing for a card that follows another with no walk between them.
  const startedId = next.currentActivityId;
  if (
    startedId !== null &&
    previous !== null &&
    next.running &&
    (!previous.running || next.currentCardId !== previous.currentCardId)
  ) {
    cues.push({ kind: 'activity-started', activityId: startedId });
  }

  // SPEC §11.4's recap arriving is a state change, not a command, so it is read here for
  // the same reason a started activity is: the player did not ask for it.
  if (next.recapDay !== null && previous !== null && next.recapDay !== previous.recapDay) {
    cues.push({ kind: 'recap-shown' });
  }

  // docs/08 §11.4: a graded completion carries its band, so the router can play the grade
  // instead of the generic settle. `activityGraded` is emitted immediately after the
  // completion it belongs to, so pairing them by activity id is unambiguous within a tick.
  const gradeBands = new Map<string, 'high' | 'mid' | 'low'>();
  for (const event of boundary.events) {
    if (event.type !== 'activityGraded') continue;
    const [activityId = '', gradeId = ''] = event.detail.split(':');
    gradeBands.set(activityId, gradeBandOf(gradeId));
  }

  for (const event of boundary.events) {
    if (event.type === 'activityCompleted') {
      const graded = gradeBands.get(event.detail);
      cues.push({
        kind: 'activity-completed',
        activityId: event.detail,
        ...(graded !== undefined ? { graded } : {}),
      });
    } else if (event.type === 'urgent') {
      cues.push({ kind: 'urgent-raised' });
    } else if (event.type === 'adjacencyGranted') {
      cues.push({ kind: 'adjacency-granted' });
    }
  }

  for (const outcome of boundary.outcomes) {
    if (outcome.status !== 'accepted') continue;
    if (
      outcome.type === 'insertPlayer' ||
      outcome.type === 'insertWrinkle' ||
      outcome.type === 'undoLastRemove' ||
      (outcome.type === 'objectClick' && outcome.effect === 'inserted')
    ) {
      cues.push({ kind: 'queue-card-inserted' });
    } else if (outcome.type === 'removeCard' && outcome.effect === 'removed') {
      cues.push({ kind: 'queue-card-removed' });
    } else if (
      outcome.type === 'stopCurrent' ||
      (outcome.type === 'removeCard' && outcome.effect === 'stopped')
    ) {
      // Stop is a player cancelling: the loop ends and no completion is earned. The
      // activity id comes from what WAS running, since it no longer is.
      const stopped = previous?.currentActivityId;
      if (stopped != null) cues.push({ kind: 'activity-stopped', activityId: stopped });
    }
  }

  return cues;
}
