export type PracticeLevel = 0 | 1 | 2 | 3;

/**
 * Practice thresholds are authored in display points while SimState stores
 * cumulative mastery points as integers x100.
 */
export function practiceLevel(
  points100: number,
  thresholds: readonly number[],
): PracticeLevel {
  if (!Number.isInteger(points100) || points100 < 0) {
    throw new Error('Practice points must be a non-negative integer x100.');
  }
  if (thresholds.length !== 3) {
    throw new Error('Practice requires exactly three level thresholds.');
  }
  let level: PracticeLevel = 0;
  for (const threshold of thresholds) {
    if (
      !Number.isInteger(threshold) ||
      threshold <= 0
    ) {
      throw new Error('Practice level thresholds must be positive integers.');
    }
    if (points100 >= threshold * 100) {
      level = (level + 1) as PracticeLevel;
    }
  }
  return level;
}
