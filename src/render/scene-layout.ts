import type { HomeMapConfig, ObjectsConfig } from '../sim/content-schemas';
import type { Lighting } from './lighting';
import type { Facing, Pose, RenderView } from '../sim/render-view';
import { interpolateTravel } from '../sim/render-view';

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
const CHAR_Y_OFFSET = CHAR_H - TILE;

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
 * Objects, drawn at their footprint's top-left.
 *
 * Sorted by the footprint's bottom row so that an object lower on the screen paints
 * later — the cheapest correct depth rule for a fixed top-down room, and it keeps the
 * draw order stable (and therefore the Atlas buffer stable) across frames.
 */
export function buildObjectQuads(objects: ObjectsConfig): Quad[] {
  return objects.objects
    .map((o) => {
      const xs = o.footprint.map(([x]) => x);
      const ys = o.footprint.map(([, y]) => y);
      return {
        sprite: `object.${o.id}`,
        x: Math.min(...xs) * TILE,
        y: Math.min(...ys) * TILE,
        bottom: Math.max(...ys),
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
 * interpolated so the sim glides instead of teleporting (SPEC §5). The sprite is 48 px
 * tall on a 32 px tile, so it is lifted by the difference to stand feet-on-tile.
 */
export function buildCharacterQuad(
  index: AtlasIndex,
  paletteId: string,
  view: RenderView,
  alpha: number,
  phase: number,
  variantId: string | null = null,
): Quad {
  const tile = view.travel !== null ? interpolateTravel(view.travel, alpha) : view.position;
  return {
    sprite: characterSprite(index, paletteId, view.pose, view.facing, phase, view.droop, variantId),
    x: tile.x * TILE,
    y: tile.y * TILE - CHAR_Y_OFFSET,
  };
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
