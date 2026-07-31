import type { FloorMaterial, HomeMapConfig, ObjectsConfig } from '../sim/content-schemas';
import type { Lighting } from './lighting';
import type { Facing, Pose, RenderView } from '../sim/render-view';
import { interpolateTravel } from '../sim/render-view';
import { activityHeroOrigin, objectPresentation } from './object-presentation';

/**
 * Scene layout (P3 T6), kept pure and separate from the Skia component.
 *
 * Everything about *what goes where* is decided here so it can be unit-tested without
 * a canvas; `WorldScene.tsx` only turns these quads into an `<Atlas>` call. The static
 * quads are built once from content, because a 24×14 tilemap plus 14 objects does not
 * change during a run.
 */

export const TILE = 32;
/** design.md §5: character is 32×48, so it overhangs its tile by 16px upward. */
export const CHAR_W = 32;
export const CHAR_H = 48;
/**
 * One actor carries the whole emotional story, so the HFM-derived hero is deliberately
 * larger than a one-tile crowd sprite. 1.5× remains a legal half-step in this renderer
 * and gives every authored face pixel room to read without enlarging the world grid.
 */
export const HERO_DRAW_SCALE = 1.5;

export function heroDrawOrigin(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: tileX * TILE + (TILE - CHAR_W * HERO_DRAW_SCALE) / 2,
    y: tileY * TILE + TILE - CHAR_H * HERO_DRAW_SCALE,
  };
}

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface AtlasIndex {
  width: number;
  height: number;
  tile: number;
  sprites: Record<string, SpriteRect>;
  /** Frame count per pose key, emitted by the builder so the renderer never guesses. */
  poses: Record<string, number>;
  /** Appearance ids with baked character frames. */
  appearances: string[];
}

/** One draw: a named atlas sprite at a logical-pixel destination. */
export interface Quad {
  sprite: string;
  /** Logical pixels, before §11.5 scaling. */
  x: number;
  y: number;
}

export function lookup(index: AtlasIndex, name: string): SpriteRect {
  const r = index.sprites[name];
  if (!r) throw new Error(`atlas has no sprite "${name}" — regenerate with npm run art:atlas`);
  return r;
}

/**
 * Floor and wall tiles, row-major. Glyph → sprite comes from `home-map.json`'s own
 * `rooms` map, so adding a room is a content edit and never a renderer edit.
 */
export function buildTileQuads(map: HomeMapConfig, lighting: Lighting = 'day'): Quad[] {
  const glyphToRoom = new Map<string, string>();
  for (const [room, glyph] of Object.entries(map.rooms)) glyphToRoom.set(glyph, room);

  const quads: Quad[] = [];
  for (let y = 0; y < map.grid.length; y++) {
    const row = map.grid[y];
    if (row === undefined) continue;
    for (let x = 0; x < row.length; x++) {
      const glyph = row[x]!;
      const room = glyphToRoom.get(glyph);
      const sprite =
        glyph === map.walls
          ? `tile.wall.${lighting}`
          : room !== undefined
            ? `tile.${room}.${lighting}`
            : null;
      if (sprite === null) throw new Error(`home-map glyph "${glyph}" at (${x},${y}) maps to no room or wall`);
      quads.push({ sprite, x: x * TILE, y: y * TILE });
    }
  }
  // Lamp pools sit above the floor and below everything else. design.md §7 makes them
  // part of the evening tile set, so they are quads rather than a light pass.
  if (lighting === 'evening') {
    for (const [x, y] of map.lamps) {
      quads.push({ sprite: 'tile.lamp.evening', x: x * TILE, y: y * TILE });
    }
  }
  return quads;
}

/**
 * Which floor the sim is standing on (P6 T10's footsteps).
 *
 * Reads `home-map.json`'s own room glyphs and per-room `materials`, the same two fields the
 * tile builder above uses, so a footstep can never disagree with the floor drawn under it.
 * Out-of-bounds and wall tiles fall back to the hall's material rather than throwing: this
 * is called from a frame callback, and a sound is never worth taking the app down for.
 */
export function floorMaterialAt(
  map: HomeMapConfig,
  x: number,
  y: number,
): FloorMaterial {
  const fallback: FloorMaterial = 'wood';
  const row = map.grid[Math.round(y)];
  if (row === undefined) return fallback;
  const glyph = row[Math.round(x)];
  if (glyph === undefined) return fallback;
  for (const [room, roomGlyph] of Object.entries(map.rooms)) {
    if (roomGlyph === glyph) return map.materials[room] ?? fallback;
  }
  return fallback;
}

/**
 * Objects, drawn at their authored visual bounds.
 *
 * The simulation footprint remains the pathfinding contract. Visual bounds are allowed
 * to be larger and to cross a wall edge, which is how a bed can fit a person and a door
 * can look installed without changing any deterministic movement. Objects sort by their
 * visual bottom edge so depth still matches what the player sees.
 */
export function buildObjectQuads(objects: ObjectsConfig): Quad[] {
  return objects.objects
    .map((o) => {
      const visual = objectPresentation(o);
      return {
        sprite: `object.${o.id}`,
        x: visual.x,
        y: visual.y,
        bottom: visual.y + visual.height,
      };
    })
    .sort((a, b) => a.bottom - b.bottom || a.sprite.localeCompare(b.sprite))
    .map(({ sprite, x, y }) => ({ sprite, x, y }));
}

/**
 * Static scene = tiles then objects, for one lighting state.
 *
 * Built once per lighting state rather than once per run: there are exactly two, so the
 * renderer memoizes both and swaps, which keeps the 350-quad buffer stable within a state.
 */
export function buildStaticQuads(
  map: HomeMapConfig,
  objects: ObjectsConfig,
  lighting: Lighting = 'day',
): Quad[] {
  return [...buildTileQuads(map, lighting), ...buildObjectQuads(objects)];
}

export const DECORATION_PLACEMENTS: Readonly<
  Record<string, Quad>
> = {
  // Package choices sit in the counter's two authored decoration slots.
  'leafy-plant': {
    sprite: 'decoration.leafy-plant',
    x: 20 * TILE + 8,
    y: 8 * TILE - 20,
  },
  'sunny-vase': {
    sprite: 'decoration.sunny-vase',
    x: 21 * TILE + 8,
    y: 8 * TILE - 20,
  },
  // Goal 2's plant sits on the wardrobe, so it remains distinct from either package choice.
  'bedroom-plant': {
    sprite: 'decoration.trailing-vine',
    x: 8 * TILE + 8,
    y: 2 * TILE - 20,
  },
  'wrinkle-keepsake': {
    sprite: 'decoration.keepsake-box',
    x: 2 * TILE + 8,
    y: 9 * TILE - 20,
  },
  'wrinkle-print': {
    sprite: 'decoration.framed-print',
    x: 3 * TILE + 8,
    y: 9 * TILE - 20,
  },
  'practice-poster': {
    sprite: 'decoration.practice-poster',
    x: 10 * TILE + 8,
    y: 2 * TILE - 20,
  },
};

/** Run-scoped game rewards drawn above the static furniture and below the character. */
export function buildDecorationQuads(
  grantedIds: readonly string[],
): Quad[] {
  return grantedIds.flatMap((id) => {
    const placement = DECORATION_PLACEMENTS[id];
    return placement === undefined ? [] : [{ ...placement }];
  });
}

/**
 * Which character sprite to draw.
 *
 * `phase` is 0..1 through the current animation cycle, and the frame count comes from the
 * **atlas index**, not from a constant here — so adding a frame to a pose is an art change
 * with no renderer edit, and a pose with no authored frames is a loud throw rather than a
 * silently reused walk frame. That silent reuse is why a sleeping sim looked like a
 * sitting one for three phases.
 *
 * `stand` still aliases walk frame 0: it is the one reuse that is deliberate, and it is
 * why the bill is 48 frames rather than 52.
 */
export function characterSprite(
  index: AtlasIndex,
  paletteId: string,
  pose: Pose,
  facing: Facing,
  phase: number,
  droop = false,
  variantId: string | null = null,
): string {
  const at = (key: string, frames: number): string => {
    const wrapped = ((phase % 1) + 1) % 1;
    return `char.${paletteId}.${key}-${Math.min(frames - 1, Math.floor(wrapped * frames))}`;
  };

  if (pose === 'stand') {
    if (droop && index.poses['stand-droop'] !== undefined) return `char.${paletteId}.stand-droop-0`;
    return `char.${paletteId}.walk-${facing}-0`;
  }

  // An idle variant is decoration on a pose that already exists, so an unknown one falls
  // back rather than throwing: a save may carry a variant from a later version, and a
  // flourish must never take the session down.
  if (pose === 'idle' && variantId !== null) {
    const frames = index.poses[`idle-${variantId}`];
    if (frames !== undefined) return at(`idle-${variantId}`, frames);
  }

  const key = pose === 'walk' ? `walk-${facing}` : pose;
  const frames = index.poses[key];
  if (frames === undefined) throw new Error(`atlas has no frames for pose "${key}"`);
  if (droop && pose === 'idle' && index.poses['stand-droop'] !== undefined) {
    return `char.${paletteId}.stand-droop-0`;
  }
  return at(key, frames);
}

/**
 * The character quad for a frame.
 *
 * `alpha` is progress through the current tick (0..1); while travelling the position is
 * interpolated so the sim glides instead of teleporting (SPEC §5). The source sprite is
 * 32×48 but the one-and-only hero is drawn at 1.5×. Travel and idle keep the feet on the
 * navigation tile. A running activity uses a presentation-only origin that places the
 * body on the mattress, seat, treadmill deck, or fixture it is actually using.
 */
export function buildCharacterQuad(
  index: AtlasIndex,
  paletteId: string,
  view: RenderView,
  alpha: number,
  phase: number,
  variantId: string | null = null,
  facingOverride: Facing | null = null,
): Quad {
  const tile = view.travel !== null ? interpolateTravel(view.travel, alpha) : view.position;
  const stagedOrigin = view.travel === null ? activityHeroOrigin(view.activityId) : null;
  const origin = stagedOrigin ?? heroDrawOrigin(tile.x, tile.y);
  return {
    sprite: characterSprite(
      index,
      paletteId,
      view.pose,
      glanceFacing(view, facingOverride),
      phase,
      view.droop,
      variantId,
    ),
    x: origin.x,
    y: origin.y,
  };
}

/**
 * SPEC §11.3's "sim glances at the queue when it changes".
 *
 * Presentation only — `render-view.ts` stays the sole deriver of real facing, and this
 * never reaches `SimState`. It applies to a standing or idle sim and to nothing else: a
 * walking sim's facing *is* her direction of travel, so turning her head mid-path would
 * draw her striding sideways, and a sleeping sim has one authored orientation.
 */
function glanceFacing(view: RenderView, override: Facing | null): Facing {
  if (override === null || view.travel !== null) return view.facing;
  return view.pose === 'stand' || view.pose === 'idle' ? override : view.facing;
}

/**
 * Lock an animated logical coordinate to the display's physical-pixel grid.
 *
 * The room is already rendered at an integer number of physical pixels per art pixel,
 * but travel interpolation deliberately produces fractional art coordinates. Drawing
 * those fractions directly lets CanvasKit blend the character across adjacent physical
 * pixels while the floor stays crisp, which reads as a flickering afterimage. This keeps
 * sub-tile movement while ensuring every rendered edge lands on a real screen pixel.
 */
export function snapToPhysicalPixel(
  logicalPosition: number,
  physicalPerArtPixel: number,
): number {
  if (
    !Number.isFinite(logicalPosition) ||
    !Number.isFinite(physicalPerArtPixel) ||
    physicalPerArtPixel <= 0
  ) {
    return logicalPosition;
  }
  return (
    Math.round(logicalPosition * physicalPerArtPixel) /
    physicalPerArtPixel
  );
}

/**
 * Walk-cycle advance for one frame.
 *
 * SPEC §11.3: "walk/act tempo visibly tracks `m_speed`". `m_speed` runs 0.5–1.5, so a
 * drained sim's cycle is a third the rate of a rested one — the tiredness the SPEC
 * promises is visible, and it comes from the same number that scales durations.
 */
export const WALK_CYCLES_PER_SECOND = 2;
/**
 * How long the sim must have nothing to do before the idle pose is actually drawn.
 *
 * Real milliseconds, not game minutes, because this guards against a *visual* flicker and
 * a human's eye does not speed up at 4×. One tick is 500ms at 1× and 125ms at 4×, so a
 * one-tick gap — which is every gap the default autonomy currently produces — stays
 * standing at every speed the DoD measures.
 */
export const IDLE_DWELL_MS = 900;

/**
 * The pose to *draw*, given how long the read-model has been reporting idle.
 *
 * `render-view.ts` is right that she is idle in the gap between two cards; it is simply
 * that the gap is one tick long, and a single-frame air-guitar flashed 428 times a week
 * reads as a glitch rather than a reward. The read-model keeps telling the truth and the
 * renderer waits for a pose it can hold — which is why this lives here and not there.
 *
 * Honest consequence, recorded rather than hidden: while every gap is one tick, this means
 * the idle flourishes are drawn *approximately never* under `full-routine`. Making Goal 4's
 * reward genuinely visible needs downtime the planner does not currently leave.
 */
export function dwelledPose(pose: Pose, idleHeldMs: number): Pose {
  if (pose !== 'idle') return pose;
  return idleHeldMs >= IDLE_DWELL_MS ? 'idle' : 'stand';
}

export function advancePhase(phase: number, deltaMs: number, mSpeed: number): number {
  // Frame deltas are hostile input. `performance.now()` differences can come back
  // non-finite on a first frame and negative when the timestamp source steps backward
  // (adversarial pass 1 found both): NaN poisoned `phase` permanently — every later
  // comparison against it is false, so the walk loop froze on frame 0 for the rest of
  // the session — and a negative delta pushed `phase` out of its [0,1) contract.
  const dt = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  const rate = Number.isFinite(mSpeed) ? Math.max(0, mSpeed) : 0;
  const base = Number.isFinite(phase) ? phase : 0;
  const next = base + (dt / 1000) * WALK_CYCLES_PER_SECOND * rate;
  // Guard the modulo too: a negative or non-finite `base` must not escape.
  const wrapped = next % 1;
  return Number.isFinite(wrapped) ? (wrapped + 1) % 1 : 0;
}
