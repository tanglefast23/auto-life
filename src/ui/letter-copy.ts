import { z } from 'zod';
import rawLetterStrings from '../../content/strings/letter.json';

const LetterStringsSchema = z.strictObject({
  offer: z.strictObject({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    prepared: z.string().min(1),
    unprepared: z.string().min(1),
    accept: z.string().min(1),
    decline: z.string().min(1),
    declineNote: z.string().min(1),
    announcement: z.string().min(1),
  }),
  accepted: z.strictObject({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    bodyWithoutBonus: z.string().min(1),
    terminal: z.string().min(1),
    done: z.string().min(1),
  }),
  summary: z.strictObject({
    accepted: z.string().min(1),
    declined: z.string().min(1),
  }),
});

export const letterStrings =
  LetterStringsSchema.parse(rawLetterStrings);

export function fillLetterCopy(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : token,
  );
}
