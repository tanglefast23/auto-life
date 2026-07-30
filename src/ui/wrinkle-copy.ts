import { z } from 'zod';
import rawWrinkleStrings from '../../content/strings/wrinkles.json';

const EntryCopySchema = z.strictObject({
  title: z.string().min(1),
  intro: z.string().min(1),
  action: z.string().min(1),
  success: z.string().min(1),
  failure: z.string().min(1),
  outcome: z.string().min(1),
});

const WrinkleStringsSchema = z.strictObject({
  ui: z.strictObject({
    eyebrow: z.string().min(1),
    chipPrefix: z.string().min(1),
    announcement: z.string().min(1),
    close: z.string().min(1),
  }),
  package: EntryCopySchema,
  repair: EntryCopySchema,
  favoriteShow: EntryCopySchema,
  headache: EntryCopySchema,
  sleptGreat: EntryCopySchema,
  burnedBreakfast: EntryCopySchema,
  emptyFridge: EntryCopySchema,
  roughNight: EntryCopySchema,
});

const parsed = WrinkleStringsSchema.parse(rawWrinkleStrings);
const stringById = flattenStrings(parsed);

export const wrinkleStrings = parsed;

export function wrinkleString(stringId: string): string {
  const value = stringById.get(stringId);
  if (value === undefined) {
    throw new Error(`unknown wrinkle string "${stringId}"`);
  }
  return value;
}

export function fillWrinkleCopy(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]!
      : token,
  );
}

function flattenStrings(
  value: unknown,
  path: string[] = [],
  result = new Map<string, string>(),
): Map<string, string> {
  if (typeof value === 'string') {
    result.set(`wrinkles:${path.join('.')}`, value);
    return result;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `wrinkle strings must be nested objects at "${path.join('.')}"`,
    );
  }
  for (const [key, child] of Object.entries(value)) {
    flattenStrings(child, [...path, key], result);
  }
  return result;
}
