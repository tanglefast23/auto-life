import { mSpeedAtStart } from './bars';
import { bandFor } from '../ui/bands';
import { toDisplay } from './fixed';
import { objectForActivityIn, type ContentRegistry } from './content';
import type { SimState } from './state';

/**
 * The render read-model (P3 T3).
 *
 * Master §4 gives `render/` "snapshots and interpolation data" as its input but never
 * defines the second half, and the P2 snapshot could not draw the sim: no position, no
 * facing, no travel path, no activity progress, no `m_speed`. This module derives all
 * of it from `SimState`.
 *
 * Two properties make it safe:
 *  - **Derived, never stored.** `SimState` is untouched, so the schema, the golden
 *    digest, and `ENGINE_VERSION` are all unaffected. Adding presentation state to the
 *    simulation would have made a render concern part of the replay contract.
 *  - **Pure.** Lives in `sim/` because facing is a function of the path and of
 *    `objects.json`'s declared facing — the renderer stays a consumer, not a deriver.
 */

export type Facing = 'up' | 'down' | 'left' | 'right';

/**
 * What the body is doing, for sprite selection. Derived here rather than in the
 * renderer so two renderers cannot disagree about what "sitting" means.
 *
 * P3's placeholder atlas had nine frames, so it mapped `stand` onto walk frame 0 and
 * `sleep` onto the seated frame. P6 authored design.md §6's full 48-frame bill, and the
 * pose is now **declared per activity in `content/activities.json`** rather than switched
 * on here — the renderer looks up authored frames by name and throws if they are missing,
 * so an activity can no longer silently borrow another one's animation.
 *
 * `stand` still aliases walk frame 0, which is the one reuse that is deliberate.
 */
export type Pose =
  | 'walk'
  | 'stand'
  | 'sleep'
  | 'nap'
  | 'sit'
  | 'eat'
  | 'brush'
  | 'shower'
  | 'lift'
  | 'run'
  | 'stretch'
  | 'practice'
  | 'toilet'
  | 'quickwash'
  | 'idle';

export interface TravelView {
  /** Full tile path, so the renderer can lerp between ticks rather than teleport. */
  readonly path: readonly { readonly x: number; readonly y: number }[];
  readonly elapsedTicks: number;
  readonly totalTicks: number;
}

export interface RenderView {
  /** Authoritative tile position at the end of this tick. */
  readonly position: { readonly x: number; readonly y: number };
  readonly facing: Facing;
  readonly pose: Pose;
  /**
   * Presentation-only activity identity. The renderer uses it to stage the body on the
   * matching furniture after navigation has ended; it is derived and never persisted.
   */
  readonly activityId: string | null;
  /** Non-null only while travelling. */
  readonly travel: TravelView | null;
  /** 0..1 for the progress ring over the sim (SPEC §11.1). Null when idle or asleep. */
  readonly activityProgress: number | null;
  /** SPEC §11.3 — walk/act tempo tracks this. */
  readonly mSpeed: number;
  /**
   * design.md §10: "tiredness is an animation state (droop frames), not a filter."
   *
   * The threshold is the Energy display band already tuned in `rates.json`. SPEC §11.1
   * records why Energy carries its own bands — 20 at bedtime is designed, and the default
   * <40 rule "would cry red every healthy evening" — so inventing a second tiredness
   * number here would be a silent way to disagree with a decision the SPEC already made.
   */
  readonly droop: boolean;
}

/**
 * Facing, in priority order:
 *  1. Travelling → the direction of the next step on the path.
 *  2. Running an activity → the interact point's declared facing from `objects.json`
 *     (the sim stands on the interact tile and faces the object).
 *  3. Asleep → the bed's declared facing.
 *  4. Idle → `down`, facing the player. Deterministic, and the one case with no data
 *     to derive from; a stored "last facing" would put presentation state into the
 *     replay contract for no visible gain.
 */
function deriveFacing(s: SimState, content: ContentRegistry, travel: TravelView | null): Facing {
  const cur = s.current;

  if (travel !== null && travel.path.length > 0) {
    // EXACTLY the progress maths `interpolateTravel` uses — (path.length - 1), not
    // path.length. Pass 2 moved facing onto the drawn segment but left a different
    // formula behind, so pass 4 found the sprite facing down while sliding left through
    // a multi-corner journey. One formula, one source of truth.
    const span = travel.path.length - 1;
    const t = span <= 0 ? 0 : (Math.min(travel.totalTicks, travel.elapsedTicks) / Math.max(1, travel.totalTicks)) * span;
    const idx = Math.min(span, Math.floor(t));
    const here = travel.path[idx] ?? s.position;
    const next = travel.path[Math.min(span, idx + 1)] ?? here;
    const dx = next.x - here.x;
    const dy = next.y - here.y;
    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    }
    // Arrived, or a one-tile hop already consumed: face the destination object.
    const cardId = cur !== null && cur.type === 'travel' ? cur.cardId : null;
    const card = cardId === null ? undefined : s.queue.find((c) => c.id === cardId);
    if (card) return objectForActivityIn(content, card.activityId).facing;
    return 'down';
  }

  if (cur !== null && cur.type !== 'travel') {
    const activityId = cur.type === 'sleep' ? 'sleep' : cur.dto.activityId;
    return objectForActivityIn(content, activityId).facing;
  }
  // Idle: hold the facing of the last thing done. The RenderView contract already
  // promised this ("holds last value when still") while the code returned 'down'
  // unconditionally — so finishing the toilet facing up snapped the sprite 180° during
  // every one-tick gap between activities (adversarial pass 4: code vs its own comment).
  // `lastCompletion` is existing sim state, so this needs nothing new stored.
  if (s.lastCompletion !== null) {
    try {
      return objectForActivityIn(content, s.lastCompletion.activityId).facing;
    } catch {
      return 'down'; // an activity with no single object owner: fall through
    }
  }
  return 'down';
}

/**
 * `processedProgress` is the fraction the tick actually ADVANCED, supplied by `step()`.
 *
 * Reading only post-step `current` meant the ring could never reach 1: on the completion
 * tick `current` is already null, so a three-tick activity published
 * `0 → 0.33 → 0.67 → null` and the ring vanished at 67% instead of closing (adversarial
 * pass 4). Same class of bug as the travel view, same fix.
 */
function deriveProgress(s: SimState, processedProgress: number | null): number | null {
  if (processedProgress !== null) return Math.min(1, Math.max(0, processedProgress));
  const cur = s.current;
  if (cur === null || cur.type !== 'activity') return null;
  const { elapsedTicks, durationTicks } = cur.dto;
  if (durationTicks <= 0) return null;
  return Math.min(1, Math.max(0, elapsedTicks / durationTicks));
}

/**
 * Pose from the running unit, read from content.
 *
 * P3 derived this from the *object* (`obj.id === 'couch' ? 'sit' : 'stand'`), which was
 * the best available rule when only two poses existed but could never express that eating
 * and showering look different. Every activity now declares its own pose, so this is a
 * lookup rather than a heuristic — and `validate-content` fails the build if a declared
 * pose has no authored frames.
 */
function derivePose(s: SimState, content: ContentRegistry): Pose {
  const cur = s.current;
  // SPEC §5: `if !current: startNext() or idle()`. Nothing running is the *only* thing
  // the authored `idle` pose has ever meant — an `idle`-kind card never becomes current
  // (`step.ts` removes it), so returning `stand` here left the 2-frame idle pose, all
  // three idle variants, and `scene-layout.ts`'s `droop && idle` branch unreachable.
  // Twenty baked sprites, no way in, and both a creation preference and Goal 4's entire
  // reward resolving to nothing a player could see. Ruled render-only by Joe 2026-07-31:
  // the gap between cards is where she idles, and no sim, save or planner state moves.
  if (cur === null) return 'idle';
  if (cur.type === 'travel') return 'walk';
  if (cur.type === 'sleep') return activityPose(content, 'sleep');
  return activityPose(content, cur.dto.activityId);
}

function activityPose(content: ContentRegistry, activityId: string): Pose {
  const activity = content.activities.activities.find((a) => a.id === activityId);
  // An unknown activity id cannot be a pose decision — fall back to standing rather than
  // throwing inside a render read-model that the live loop calls every tick.
  return (activity?.pose as Pose | undefined) ?? 'stand';
}

/**
 * `processedTravel` is the journey segment the tick actually ADVANCED, captured by
 * `step()` before it mutates `elapsedTicks` — the same "what was processed" precedent
 * the `processed` field already sets.
 *
 * Reading travel off the post-step state was wrong in three ways, all found by probing
 * the first journey (adversarial pass 2):
 *   - the renderer never saw `elapsedTicks: 0`, so the very first frame of a journey was
 *     already two tiles along — the sim teleported before interpolation began;
 *   - on the arrival tick `current` has already become the next activity, so `travel`
 *     was null and the final leg teleported;
 *   - a one-tick journey (toilet → sink) reported `processed: 'travel'` with
 *     `travel: null`, so it was 100% teleport with no interpolation data at all.
 */
export function deriveRenderView(
  s: SimState,
  content: ContentRegistry,
  processedTravel: TravelView | null = null,
  processedProgress: number | null = null,
): RenderView {
  const cur = s.current;
  const live =
    cur !== null && cur.type === 'travel'
      ? { path: cur.path, elapsedTicks: cur.elapsedTicks, totalTicks: cur.totalTicks }
      : null;
  const travel = processedTravel ?? live;
  return {
    position: { x: s.position.x, y: s.position.y },
    facing: deriveFacing(s, content, travel),
    pose: travel !== null ? 'walk' : derivePose(s, content),
    activityId:
      travel !== null || cur === null || cur.type === 'travel'
        ? null
        : cur.type === 'sleep'
          ? 'sleep'
          : cur.dto.activityId,
    // Master §4: render never mutates simulation truth. A `readonly` type is a
    // compile-time promise only — pass 2 proved that touching
    // `snapshot.render.travel.path[0]` mutated the live GameLoop state. Copy the path.
    travel: travel === null ? null : { path: travel.path.map((pt) => ({ x: pt.x, y: pt.y })), elapsedTicks: travel.elapsedTicks, totalTicks: travel.totalTicks },
    activityProgress: deriveProgress(s, processedProgress),
    mSpeed: mSpeedAtStart(s.bars),
    droop: bandFor('energy', toDisplay(s.bars.energy), content.rates).band !== 'normal',
  };
}

/**
 * Sub-tile position for a fractional tick (SPEC §5: "the renderer interpolates ticks
 * to 60 fps").
 *
 * This is not cosmetic. `travelTicks` compresses a 10-tile path into ~3 ticks, so the
 * authoritative position advances ~3.5 tiles per tick, and at 1× a tick is 500 ms.
 * Drawing raw per-tick positions would teleport the sim across the room three times a
 * second.
 *
 * `alpha` is progress through the CURRENT tick, 0..1. Returns fractional tile
 * coordinates. Pure, so it is unit-testable without a renderer.
 */
export function interpolateTravel(travel: TravelView, alpha: number): { x: number; y: number } {
  const a = Math.min(1, Math.max(0, alpha));
  const { path, elapsedTicks, totalTicks } = travel;
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1 || totalTicks <= 0) {
    const only = path[path.length - 1]!;
    return { x: only.x, y: only.y };
  }
  // Continuous progress along the path in [0, path.length - 1].
  const ticks = Math.min(totalTicks, elapsedTicks + a);
  const t = (ticks / totalTicks) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(t));
  const frac = t - i;
  const from = path[i]!;
  const to = path[i + 1]!;
  return { x: from.x + (to.x - from.x) * frac, y: from.y + (to.y - from.y) * frac };
}
