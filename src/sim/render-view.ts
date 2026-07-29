import { mSpeedAtStart } from './bars';
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
 * A0 authored `walk×4dir` and one seated frame, so P3's placeholder atlas maps
 * `stand` onto walk frame 0 and `sleep` onto the seated frame. The remaining poses
 * are P6's art (design.md §6 lists the full ~48-frame v1 bill).
 */
export type Pose = 'walk' | 'stand' | 'sit' | 'sleep';

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
  /** Non-null only while travelling. */
  readonly travel: TravelView | null;
  /** 0..1 for the progress ring over the sim (SPEC §11.1). Null when idle or asleep. */
  readonly activityProgress: number | null;
  /** SPEC §11.3 — walk/act tempo tracks this. */
  readonly mSpeed: number;
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
function deriveFacing(s: SimState, content: ContentRegistry): Facing {
  const cur = s.current;
  if (cur === null) return 'down';

  if (cur.type === 'travel') {
    // The tile the sim is heading for next, using the same index maths step() uses.
    const idx = Math.min(
      cur.path.length - 1,
      Math.floor((cur.path.length * cur.elapsedTicks) / cur.totalTicks),
    );
    const here = cur.path[idx] ?? s.position;
    const next = cur.path[Math.min(cur.path.length - 1, idx + 1)] ?? here;
    const dx = next.x - here.x;
    const dy = next.y - here.y;
    if (dx === 0 && dy === 0) {
      // Arrived, or a one-tile hop already consumed: face the destination object.
      const card = s.queue.find((c) => c.id === cur.cardId);
      if (card) {
        const obj = objectForActivityIn(content, card.activityId);
        return obj.facing;
      }
      return 'down';
    }
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  const activityId = cur.type === 'sleep' ? 'sleep' : cur.dto.activityId;
  return objectForActivityIn(content, activityId).facing;
}

function deriveProgress(s: SimState): number | null {
  const cur = s.current;
  if (cur === null || cur.type !== 'activity') return null;
  const { elapsedTicks, durationTicks } = cur.dto;
  if (durationTicks <= 0) return null;
  return Math.min(1, Math.max(0, elapsedTicks / durationTicks));
}

/**
 * Pose from the running unit. `couch` owns nap and idle in objects.json, so "seated"
 * is read from the object rather than from a hard-coded activity list — the same
 * data-driven rule the engine uses everywhere else.
 */
function derivePose(s: SimState, content: ContentRegistry): Pose {
  const cur = s.current;
  if (cur === null) return 'stand';
  if (cur.type === 'travel') return 'walk';
  if (cur.type === 'sleep') return 'sleep';
  const obj = objectForActivityIn(content, cur.dto.activityId);
  return obj.id === 'couch' ? 'sit' : 'stand';
}

export function deriveRenderView(s: SimState, content: ContentRegistry): RenderView {
  const cur = s.current;
  return {
    position: { x: s.position.x, y: s.position.y },
    facing: deriveFacing(s, content),
    pose: derivePose(s, content),
    travel:
      cur !== null && cur.type === 'travel'
        ? { path: cur.path, elapsedTicks: cur.elapsedTicks, totalTicks: cur.totalTicks }
        : null,
    activityProgress: deriveProgress(s),
    mSpeed: mSpeedAtStart(s.bars),
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
