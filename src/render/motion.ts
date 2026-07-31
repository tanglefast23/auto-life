import { theme } from '../ui/theme';

/**
 * Motion and juice (design.md §10, SPEC §11.3, §11.6; P6 T11).
 *
 * One table of named motions, and one `resolveMotion` that applies the reduced-motion
 * setting. That shape is the point: SPEC §11.6 says reduced motion "kills pulses and
 * parallax, **keeps state changes**", which is a rule about every animation at once. A
 * per-component `if (reducedMotion)` branch is how half of them quietly stop obeying it.
 *
 * design.md §10's constraints are encoded rather than described:
 *  - card slide+squash is 90 ms — not "fast";
 *  - the completion poof is 4 frames;
 *  - **gold sparkle is strictly for rewards**, matching §2's rule that gold is light
 *    sources and reward moments only;
 *  - there is **no screen shake**, and the test asserts the table cannot grow one.
 */

export type MotionTrigger =
  | 'card-inserted'
  | 'card-removed'
  | 'card-completed'
  | 'reward'
  | 'urgent'
  | 'recap-shown'
  | 'queue-changed'
  | 'lighting-changed';

export interface Motion {
  /** Milliseconds. Zero means "apply the end state immediately". */
  durationMs: number;
  /** Sprite frames, for the effects that are animations rather than transitions. */
  frames: number;
  /** What causes it. One trigger, one motion — the audio router's rule, applied to pixels. */
  trigger: MotionTrigger;
  /**
   * Whether this motion is *decoration* (a pulse, a sparkle, a parallax) or a **state
   * change**. Reduced motion zeroes the first and preserves the second. This flag is the
   * whole of SPEC §11.6's rule, in one field.
   */
  decorative: boolean;
  /** Palette colour, when the motion draws something. */
  color?: string;
  /** Scale overshoot for a squash, as a multiplier. 1 means no squash. */
  squash?: number;
}

export const MOTION = {
  /** design.md §10: "Card slide+squash (90 ms)". */
  cardSlide: { durationMs: 90, frames: 0, trigger: 'card-inserted', decorative: false, squash: 1.12 },
  cardRemove: { durationMs: 90, frames: 0, trigger: 'card-removed', decorative: false, squash: 0.88 },
  /** design.md §10: "completion poof (4 f)". */
  poof: { durationMs: 160, frames: 4, trigger: 'card-completed', decorative: true, color: theme.color.creamShadow },
  /** design.md §10: "gold sparkle strictly for rewards". The only gold motion in the game. */
  sparkle: { durationMs: 420, frames: 6, trigger: 'reward', decorative: true, color: theme.color.gold },
  /** SPEC §11.6: urgency must also read without colour, so the pulse is never the only signal. */
  urgentPulse: { durationMs: 700, frames: 0, trigger: 'urgent', decorative: true, color: theme.color.red },
  /** SPEC §11.4: the recap "slides in with wake". */
  recapSlide: { durationMs: 220, frames: 0, trigger: 'recap-shown', decorative: false },
  /** SPEC §11.3: "sim glances at the queue when it changes (she knows you're steering)". */
  queueGlance: { durationMs: 500, frames: 0, trigger: 'queue-changed', decorative: true },
  /** design.md §7: the 19:00 change is "the coziest beat of the day" — a fade, not a cut. */
  lightingCrossfade: { durationMs: 4000, frames: 0, trigger: 'lighting-changed', decorative: false },
} as const satisfies Record<string, Motion>;

export type MotionName = keyof typeof MOTION;

export interface MotionPreferences {
  reducedMotion: boolean;
}

/**
 * Apply the accessibility setting.
 *
 * A decorative motion collapses to nothing. A state change keeps its end state and loses
 * only the tween, so a card still moves to its new position and the recap still appears —
 * they simply arrive instead of travelling. That distinction is what "keeps state changes"
 * means, and getting it wrong in the permissive direction makes the setting a lie.
 */
export function resolveMotion(motion: Motion, prefs: MotionPreferences): Motion {
  if (!prefs.reducedMotion) return motion;
  return { ...motion, durationMs: 0, frames: motion.decorative ? 0 : motion.frames };
}

/** Progress through a motion at a given elapsed time, 0..1. Hostile inputs fail soft. */
export function motionProgress(motion: Motion, elapsedMs: number): number {
  if (motion.durationMs <= 0) return 1;
  const t = Number.isFinite(elapsedMs) ? elapsedMs : motion.durationMs;
  return Math.max(0, Math.min(1, t / motion.durationMs));
}

/**
 * The squash multiplier at a point in a card motion.
 *
 * Overshoots, then settles to exactly 1 — a squash that does not return to 1 leaves the
 * card permanently the wrong size, which is the failure mode of every hand-rolled spring.
 */
export function squashAt(motion: Motion, elapsedMs: number): number {
  const overshoot = motion.squash ?? 1;
  if (overshoot === 1 || motion.durationMs <= 0) return 1;
  const t = motionProgress(motion, elapsedMs);
  return 1 + (overshoot - 1) * Math.sin(Math.PI * t);
}

/** Which frame of a multi-frame effect to draw. Returns null once it has finished. */
export function effectFrame(motion: Motion, elapsedMs: number): number | null {
  if (motion.frames <= 0) return null;
  const t = motionProgress(motion, elapsedMs);
  if (t >= 1) return null;
  return Math.min(motion.frames - 1, Math.floor(t * motion.frames));
}
