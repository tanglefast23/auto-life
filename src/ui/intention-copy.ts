import { z } from 'zod';
import raw from '../../content/strings/intentions.json';

const IntentionRowSchema = z.strictObject({
  label: z.string().min(1),
  description: z.string().min(1),
});

const IntentionStringsSchema = z.strictObject({
  balanced: IntentionRowSchema,
  takeItEasy: IntentionRowSchema,
  getMoving: IntentionRowSchema,
  eatProperly: IntentionRowSchema,
  practiceFocus: IntentionRowSchema,
  prompt: z.strictObject({
    chip: z.string().min(1),
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    close: z.string().min(1),
    manual: z.string().min(1),
    selected: z.string().min(1),
    locked: z.string().min(1),
    addPracticeBlock: z.string().min(1),
    practiceBlockFull: z.string().min(1),
  }),
  preferenceBubbles: z.strictObject({
    happy: z.string().min(1),
    grumble: z.string().min(1),
  }),
});

export const intentionStrings = IntentionStringsSchema.parse(raw);

export function intentionString(stringId: string): string {
  const [file, path] = stringId.split(':');
  if (file !== 'intentions' || path === undefined) {
    throw new Error(`unsupported intention string "${stringId}"`);
  }
  let value: unknown = intentionStrings;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object') {
      throw new Error(`unknown intention string "${stringId}"`);
    }
    value = (value as Record<string, unknown>)[part];
  }
  if (typeof value !== 'string') {
    throw new Error(`unknown intention string "${stringId}"`);
  }
  return value;
}
