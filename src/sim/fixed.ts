/**
 * ×6000 fixed-point arithmetic (SPEC §16.2). At this scale every per-hour rate with
 * ≤2 decimals is an exact integer per game-minute (SCALE / 60 = 100), and fills are
 * computed statelessly so active state stays plain JSON (save/forecast safe).
 */
export const SCALE = 6000;

const DECIMAL_TOLERANCE = 1e-9;

export function toFixed(display: number): number {
  if (!Number.isFinite(display)) throw new Error('display value must be finite');
  return Math.round(display * SCALE);
}

export const toDisplay = (fixed: number): number => fixed / SCALE;

export function ratePerMinuteFixed(perHour: number): number {
  if (!Number.isFinite(perHour) || perHour < 0) throw new Error('invalid hourly rate');
  const hundredths = Math.round(perHour * 100);
  // Tolerance-based: 0.29 * 100 === 28.999999999999996 in binary floats and is still valid.
  if (Math.abs(perHour * 100 - hundredths) > DECIMAL_TOLERANCE) {
    throw new Error(`rate ${perHour}/h has more than two decimal places`);
  }
  return hundredths; // SCALE / 60 = 100
}

/**
 * Signed remainder-carrying fill: the delta granted at tickIndex (1-based) of a
 * fill spanning totalTicks, such that the sum over all ticks is EXACTLY totalFixed.
 */
export function fillDelta(totalFixed: number, totalTicks: number, tickIndex: number): number {
  if (!Number.isSafeInteger(totalFixed)) throw new Error('total must be a safe integer');
  if (!Number.isInteger(totalTicks) || totalTicks < 1) throw new Error('totalTicks must be positive');
  if (!Number.isInteger(tickIndex) || tickIndex < 1 || tickIndex > totalTicks) {
    throw new Error('tickIndex out of range');
  }
  const sign = Math.sign(totalFixed);
  const magnitude = Math.abs(totalFixed);
  if (!Number.isSafeInteger(magnitude * tickIndex)) {
    throw new Error('fill arithmetic exceeds safe integer range');
  }
  const now = Math.floor((magnitude * tickIndex) / totalTicks);
  const before = Math.floor((magnitude * (tickIndex - 1)) / totalTicks);
  return sign * (now - before);
}
