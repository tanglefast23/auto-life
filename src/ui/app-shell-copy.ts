import { z } from 'zod';
import raw from '../../content/strings/app-shell.json';

const StringsSchema = z.strictObject({
  loading: z.strictObject({
    preferences: z.string().min(1),
    career: z.string().min(1),
  }),
  title: z.strictObject({
    eyebrow: z.string().min(1),
    name: z.string().min(1),
    body: z.string().min(1),
    newGame: z.string().min(1),
    resume: z.string().min(1),
  }),
  identity: z.strictObject({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    name: z.string().min(1),
    pronouns: z.string().min(1),
    appearance: z.string().min(1),
    preferences: z.string().min(1),
    start: z.string().min(1),
    skip: z.string().min(1),
    back: z.string().min(1),
    theyThem: z.string().min(1),
    sheHer: z.string().min(1),
    heHim: z.string().min(1),
  }),
  resume: z.strictObject({
    title: z.string().min(1),
    body: z.string().min(1),
    fallback: z.string().min(1),
    dismiss: z.string().min(1),
  }),
  recovery: z.strictObject({
    title: z.string().min(1),
    body: z.string().min(1),
    copyRaw: z.string().min(1),
    copied: z.string().min(1),
    startFresh: z.string().min(1),
    confirmTitle: z.string().min(1),
    confirmBody: z.string().min(1),
    cancel: z.string().min(1),
    confirm: z.string().min(1),
  }),
  conflict: z.strictObject({
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  errors: z.strictObject({
    save: z.string().min(1),
    seed: z.string().min(1),
  }),
});

export const appShellStrings = StringsSchema.parse(raw);
