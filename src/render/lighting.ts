import { LIGHTING_STATES, type Lighting } from './sprites/tiles';

export { LIGHTING_STATES, type Lighting };

/**
 * When the room changes state (design.md §7, SPEC §11.3).
 *
 * SPEC §11.3 calls the 19:00 change "the coziest beat of the day", and SPEC §14 crossfades
 * the music on the same minute. Both consumers read the constant from here rather than
 * each carrying a 19, so the lights and the music physically cannot disagree about when
 * evening starts — the content gate asserts `content/audio.json` matches this value.
 *
 * Pure and framework-free, so the rule is unit-testable without a canvas.
 */
export const EVENING_START_MINUTE = 19 * 60;

/**
 * Morning is 06:00 rather than midnight. A player who stays up past midnight is still in
 * the evening state; the room brightening at 00:00 while the sim is asleep would read as a
 * bug, not as dawn.
 */
export const DAY_START_MINUTE = 6 * 60;

export function lightingAt(minuteOfDay: number): Lighting {
  const raw = Number.isFinite(minuteOfDay) ? Math.floor(minuteOfDay) : 0;
  const m = ((raw % 1440) + 1440) % 1440;
  return m >= EVENING_START_MINUTE || m < DAY_START_MINUTE ? 'evening' : 'day';
}

export function tileSpriteFor(room: string, minuteOfDay: number): string {
  return `tile.${room}.${lightingAt(minuteOfDay)}`;
}

export function lampSpriteFor(minuteOfDay: number): string {
  return `tile.lamp.${lightingAt(minuteOfDay)}`;
}
