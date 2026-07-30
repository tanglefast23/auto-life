import { z } from 'zod';
import rawStoryletStrings from '../../content/strings/storylets.json';

const StoryletStringsSchema = z.strictObject({
  wrinkles: z.strictObject({
    package: z.string().min(1),
    repair: z.string().min(1),
    favoriteShow: z.string().min(1),
  }),
  idle: z.strictObject({
    couch: z.string().min(1),
    window: z.string().min(1),
  }),
  milestones: z.strictObject({
    firstChord: z.string().min(1),
    balancedWeek: z.string().min(1),
  }),
});

export const storyletStrings =
  StoryletStringsSchema.parse(rawStoryletStrings);

export function storyletString(stringId: string): string {
  const [namespace, path] = stringId.split(':', 2);
  if (namespace !== 'storylets' || path === undefined) {
    throw new Error(`unsupported storylet string "${stringId}"`);
  }
  let value: unknown = storyletStrings;
  for (const segment of path.split('.')) {
    if (
      value === null ||
      typeof value !== 'object' ||
      !(segment in value)
    ) {
      throw new Error(`unknown storylet string "${stringId}"`);
    }
    value = (value as Record<string, unknown>)[segment];
  }
  if (typeof value !== 'string') {
    throw new Error(`storylet string "${stringId}" is not text`);
  }
  return value;
}
