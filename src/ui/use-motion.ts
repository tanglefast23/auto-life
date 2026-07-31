import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import {
  effectFrame,
  resolveMotion,
  squashAt,
  type Motion,
} from '../render/motion';
import {
  diffQueueMotions,
  motionForCardEvent,
  type CardMotionEvent,
  type QueueMotionFrame,
} from './card-motion';

/**
 * The React side of design.md §10's motion table (P6 T11).
 *
 * Every hook here resolves through `resolveMotion` before it does anything, so SPEC
 * §11.6's reduced-motion contract is applied in one place. A component that reached for
 * `Animated.timing` directly would be re-deriving that rule, which is how half of a set of
 * animations quietly stops obeying it — the failure the single table exists to prevent.
 */

/** `useNativeDriver` is unavailable for layout props on web, and warns loudly if asked. */
const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Run one motion from 0 to 1, restarting whenever `restartKey` changes.
 *
 * A resolved duration of zero — reduced motion, or a motion that has none — sets the value
 * to 1 rather than animating to it. That *is* "keeps state changes": the card arrives at
 * its end state instead of travelling there.
 */
export function useMotionRun(
  motion: Motion,
  reducedMotion: boolean,
  restartKey: unknown = null,
): Animated.Value {
  // Seeded from the resolved motion, not from 0. Setting it to 1 in the effect instead
  // would paint one frame at zero opacity before reduced motion took hold — a flash
  // visible precisely to the people who asked for less movement.
  const value = useRef(
    new Animated.Value(resolveMotion(motion, { reducedMotion }).durationMs <= 0 ? 1 : 0),
  ).current;
  useEffect(() => {
    const resolved = resolveMotion(motion, { reducedMotion });
    if (resolved.durationMs <= 0) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: resolved.durationMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [motion, reducedMotion, restartKey, value]);
  return value;
}

/**
 * The squash curve for a motion, as an interpolation of a 0..1 driver.
 *
 * The stops are sampled from `squashAt` rather than hand-written, so the table stays the
 * one source of the curve — and because `squashAt` settles to exactly 1, the card cannot
 * be left permanently the wrong size.
 */
const SQUASH_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

export function squashInterpolation(
  motion: Motion,
  driver: Animated.Value,
  reducedMotion: boolean,
): Animated.AnimatedInterpolation<number> | number {
  const resolved = resolveMotion(motion, { reducedMotion });
  if (resolved.durationMs <= 0 || (resolved.squash ?? 1) === 1) return 1;
  return driver.interpolate({
    inputRange: [...SQUASH_STOPS],
    outputRange: SQUASH_STOPS.map((t) => squashAt(resolved, t * resolved.durationMs)),
  });
}

/**
 * A departing card, kept alive just long enough to be seen leaving.
 *
 * `frame` is the poof's current sprite step, or null for the motions that are transitions
 * rather than animations.
 */
export interface QueueGhost {
  readonly key: string;
  readonly event: CardMotionEvent;
  readonly motion: Motion;
  readonly frame: number | null;
}

/**
 * Replay departures from the queue as short-lived ghosts.
 *
 * Ghosts are the only way SPEC §11.3's completion poof can exist — the card is already
 * gone from the snapshot when the strip re-renders. They are deliberately *not* part of
 * `visualRows`: keyboard focus, drag indices, and every existing mount assertion read that
 * list, and a decorative 90 ms artefact must not be able to perturb any of them.
 *
 * Under reduced motion there are no ghosts at all. Both departure motions resolve to zero
 * duration, and the state change the setting promises to keep — the card is gone — has
 * already been applied by the snapshot itself.
 */
export function useQueueGhosts(
  frame: QueueMotionFrame | null,
  reducedMotion: boolean,
): QueueGhost[] {
  const previous = useRef<QueueMotionFrame | null>(null);
  const [ghosts, setGhosts] = useState<readonly { key: string; event: CardMotionEvent; startedAt: number }[]>([]);
  const sequence = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const before = previous.current;
    previous.current = frame;
    if (frame === null) return;
    const departures = diffQueueMotions(before, frame);
    if (departures.length === 0) return;
    const born: { key: string; event: CardMotionEvent; startedAt: number }[] = [];
    for (const event of departures) {
      const motion = resolveMotion(motionForCardEvent(event.kind), { reducedMotion });
      if (motion.durationMs <= 0) continue;
      // Keyed by a counter, not by card id: the same id can leave, be undone, and leave
      // again inside one motion, and two live ghosts must not collide on a React key.
      sequence.current += 1;
      const key = `${event.cardId}#${sequence.current}`;
      born.push({ key, event, startedAt: Date.now() });
      const timer = setTimeout(() => {
        timers.current = timers.current.filter((live) => live !== timer);
        setGhosts((live) => live.filter((ghost) => ghost.key !== key));
      }, motion.durationMs);
      timers.current.push(timer);
    }
    if (born.length > 0) setGhosts((live) => [...live, ...born]);
  }, [frame, reducedMotion]);

  // One ticker for every live ghost, and none at all when there are none — a poof is four
  // frames over 160 ms, so it needs a clock, but an idle queue must not pay for one.
  const hasFramedGhost = ghosts.length > 0;
  useEffect(() => {
    if (!hasFramedGhost) return;
    const id = setInterval(() => setNow(Date.now()), 32);
    return () => clearInterval(id);
  }, [hasFramedGhost]);

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current = [];
    },
    [],
  );

  return useMemo(
    () =>
      ghosts.map((ghost) => {
        const motion = resolveMotion(motionForCardEvent(ghost.event.kind), { reducedMotion });
        return {
          key: ghost.key,
          event: ghost.event,
          motion,
          frame: effectFrame(motion, Math.max(0, now - ghost.startedAt)),
        };
      }),
    // `now` is the ticker; it is what advances the poof's frame.
    [ghosts, now, reducedMotion],
  );
}
