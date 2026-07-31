import type { ObjectDef } from '../sim/content-schemas';

/**
 * Presentation-only room composition.
 *
 * `objects.json` owns navigation: blocked tiles, walk destinations, and deterministic
 * facing. Those deliberately stay on the 32px simulation grid. This table owns what the
 * player sees: real furniture is larger than a collision tile, a television has to face
 * its couch, and the front door has to overlap the wall it belongs to.
 */
export interface ObjectPresentation {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const OBJECT_PRESENTATION: Readonly<Record<string, ObjectPresentation>> = {
  // Bedroom: a full-size single bed and a wardrobe tall enough to contain the hero.
  bed: { x: 48, y: 40, width: 80, height: 120 },
  wardrobe: { x: 248, y: 40, width: 64, height: 96 },

  // Bathroom: fixtures share the north wall and project into the room.
  toilet: { x: 488, y: 40, width: 64, height: 80 },
  sink: { x: 568, y: 40, width: 64, height: 72 },
  shower: { x: 648, y: 32, width: 80, height: 128 },

  // Kitchen: appliances read as waist/chest-height stations, not one-tile icons.
  fridge: { x: 488, y: 232, width: 64, height: 96 },
  microwave: { x: 568, y: 248, width: 64, height: 72 },
  counter: { x: 640, y: 240, width: 88, height: 72 },

  // Living room: couch and television face one another; the long mat and gym machines
  // are sized for the 48x72 drawn hero rather than for the 32px navigation tile.
  couch: { x: 48, y: 248, width: 128, height: 64 },
  tv: { x: 68, y: 344, width: 88, height: 56 },
  rug: { x: 160, y: 300, width: 72, height: 104 },
  guitar: { x: 192, y: 232, width: 48, height: 80 },
  bench: { x: 240, y: 272, width: 96, height: 56 },
  treadmill: { x: 240, y: 352, width: 96, height: 48 },

  // The leaf crosses the bottom wall instead of floating on the hall floor.
  'front-door': { x: 376, y: 368, width: 64, height: 80 },
};

/** Safe fallback for future content; coverage tests require every current object above. */
export function objectPresentation(
  object: Pick<ObjectDef, 'id' | 'footprint'>,
): ObjectPresentation {
  const authored = OBJECT_PRESENTATION[object.id];
  if (authored !== undefined) return authored;
  const xs = object.footprint.map(([x]) => x);
  const ys = object.footprint.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX * 32,
    y: minY * 32,
    width: (Math.max(...xs) - minX + 1) * 32,
    height: (Math.max(...ys) - minY + 1) * 32,
  };
}

/**
 * Exact top-lefts for the 48x72 live hero while using an object.
 *
 * Navigation still ends at the authored `interactPoint`; only the final drawing slides
 * onto the seat, mattress, deck, or fixture. This is the missing distinction that made
 * sitting happen on the floor in front of the couch.
 */
export const ACTIVITY_HERO_ORIGINS: Readonly<
  Partial<Record<string, Readonly<{ x: number; y: number }>>>
> = {
  sleep: { x: 64, y: 52 },
  read: { x: 88, y: 220 },
  nap: { x: 88, y: 220 },
  snack: { x: 500, y: 248 },
  meal: { x: 564, y: 248 },
  weights: { x: 264, y: 250 },
  treadmill: { x: 268, y: 326 },
  stretch: { x: 172, y: 320 },
  shower: { x: 664, y: 64 },
  quickwash: { x: 568, y: 56 },
  brush: { x: 568, y: 56 },
  toilet: { x: 496, y: 48 },
  practice: { x: 192, y: 244 },
  package: { x: 384, y: 340 },
};

export function activityHeroOrigin(
  activityId: string | null,
): Readonly<{ x: number; y: number }> | null {
  if (activityId === null) return null;
  return ACTIVITY_HERO_ORIGINS[activityId] ?? null;
}
