import { z } from 'zod';
import raw from '../../content/strings/identity.json';

const IdentityStringsSchema = z.strictObject({
  appearance: z.strictObject({
    morningBlue: z.string().min(1),
    mossGreen: z.string().min(1),
    warmClay: z.string().min(1),
    plumNight: z.string().min(1),
  }),
  categories: z.strictObject({
    chronotype: z.string().min(1),
    workout: z.string().min(1),
    food: z.string().min(1),
    idle: z.string().min(1),
  }),
  preferences: z.strictObject({
    earlyBird: z.string().min(1),
    nightOwl: z.string().min(1),
    weightsPerson: z.string().min(1),
    treadmillPerson: z.string().min(1),
    properMeals: z.string().min(1),
    grazer: z.string().min(1),
    windowGazer: z.string().min(1),
    slowStretcher: z.string().min(1),
  }),
});

const identityStrings = IdentityStringsSchema.parse(raw);

export function identityString(stringId: string): string {
  const [file, path] = stringId.split(':');
  if (file !== 'identity' || path === undefined) {
    throw new Error(`unsupported identity string "${stringId}"`);
  }
  let value: unknown = identityStrings;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object') {
      throw new Error(`unknown identity string "${stringId}"`);
    }
    value = (value as Record<string, unknown>)[part];
  }
  if (typeof value !== 'string') {
    throw new Error(`unknown identity string "${stringId}"`);
  }
  return value;
}
