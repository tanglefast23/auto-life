/**
 * Clock formatting (SPEC §5: `Day 3 · Wed · 14:32`).
 *
 * Separate from the HUD component so the format is asserted directly. Weekday comes
 * from the sim's own day numbering — SPEC §5 starts a new game on Day 1 (Mon).
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function weekdayForDay(day: number): string {
  const i = ((Math.trunc(day) - 1) % 7 + 7) % 7;
  return WEEKDAYS[i]!;
}

export function formatTimeOfDay(minuteOfDay: number): string {
  const m = ((Math.trunc(minuteOfDay) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatClock(day: number, minuteOfDay: number): string {
  return `Day ${Math.trunc(day)} · ${weekdayForDay(day)} · ${formatTimeOfDay(minuteOfDay)}`;
}
