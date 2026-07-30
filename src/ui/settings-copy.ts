import { z } from 'zod';
import raw from '../../content/strings/settings.json';

const LeafObject = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject(shape);

const SettingsCopySchema = z.strictObject({
  pause: LeafObject({
    open: z.string().min(1),
    title: z.string().min(1),
    resume: z.string().min(1),
    settings: z.string().min(1),
    goals: z.string().min(1),
    newGame: z.string().min(1),
    returnTitle: z.string().min(1),
  }),
  settings: LeafObject({
    title: z.string().min(1),
    back: z.string().min(1),
    audio: LeafObject({
      title: z.string().min(1),
      master: z.string().min(1),
      music: z.string().min(1),
      sfx: z.string().min(1),
      mute: z.string().min(1),
      muted: z.string().min(1),
      unmuted: z.string().min(1),
    }),
    gameplay: LeafObject({
      title: z.string().min(1),
      defaultSpeed: z.string().min(1),
      sleepSkip: z.string().min(1),
      intentionPrompt: z.string().min(1),
      autonomy: z.string().min(1),
      fullRoutine: z.string().min(1),
      essentialsOnly: z.string().min(1),
      reactiveOnly: z.string().min(1),
    }),
    display: LeafObject({
      title: z.string().min(1),
      reducedMotion: z.string().min(1),
      system: z.string().min(1),
      on: z.string().min(1),
      off: z.string().min(1),
      hudScale: z.string().min(1),
      fractionalScaling: z.string().min(1),
    }),
    accessibility: LeafObject({
      title: z.string().min(1),
      nonColorUrgency: z.string().min(1),
      verbosity: z.string().min(1),
      brief: z.string().min(1),
      full: z.string().min(1),
    }),
    controls: LeafObject({
      title: z.string().min(1),
      reference: z.string().min(1),
    }),
    sim: LeafObject({
      title: z.string().min(1),
      name: z.string().min(1),
      pronouns: z.string().min(1),
      save: z.string().min(1),
    }),
    data: LeafObject({
      title: z.string().min(1),
      lastSaved: z.string().min(1),
      neverSaved: z.string().min(1),
      reset: z.string().min(1),
    }),
    about: LeafObject({
      title: z.string().min(1),
      appVersion: z.string().min(1),
      engineVersion: z.string().min(1),
      credits: z.string().min(1),
    }),
  }),
  confirm: LeafObject({
    newGameTitle: z.string().min(1),
    newGameBody: z.string().min(1),
    resetTitle: z.string().min(1),
    resetBody: z.string().min(1),
    cancel: z.string().min(1),
    continue: z.string().min(1),
  }),
  errors: LeafObject({
    settingsSave: z.string().min(1),
    careerSave: z.string().min(1),
    returnTitle: z.string().min(1),
  }),
});

export const settingsStrings = SettingsCopySchema.parse(raw);
