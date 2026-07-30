import { z } from 'zod';
import rawFirstSessionStrings from '../../content/strings/first-session.json';

const FirstSessionStringsSchema = z.strictObject({
  package: z.strictObject({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    announcement: z.string().min(1),
    choices: z.strictObject({
      leafyPlant: z.strictObject({
        label: z.string().min(1),
        description: z.string().min(1),
      }),
      sunnyVase: z.strictObject({
        label: z.string().min(1),
        description: z.string().min(1),
      }),
    }),
  }),
  goals: z.strictObject({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    panelLabel: z.string().min(1),
    open: z.string().min(1),
    close: z.string().min(1),
    complete: z.string().min(1),
    allComplete: z.string().min(1),
    progress: z.strictObject({
      whyOpened: z.string().min(1),
      openWhy: z.string().min(1),
      editDone: z.string().min(1),
      makeEdit: z.string().min(1),
      forecastSeen: z.string().min(1),
      checkForecast: z.string().min(1),
      whyLineOpened: z.string().min(1),
      whyLineNotOpened: z.string().min(1),
      planEdited: z.string().min(1),
      planNotEdited: z.string().min(1),
      forecastChangeSeen: z.string().min(1),
      forecastChangeNotSeen: z.string().min(1),
    }),
    meetYou: z.strictObject({
      title: z.string().min(1),
      instruction: z.string().min(1),
      reward: z.string().min(1),
    }),
    changeOfPlans: z.strictObject({
      title: z.string().min(1),
      instruction: z.string().min(1),
      reward: z.string().min(1),
    }),
  }),
  recap: z.strictObject({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    activities: z.string().min(1),
    meals: z.string().min(1),
    practice: z.string().min(1),
    activityLabel: z.string().min(1),
    mealLabel: z.string().min(1),
    practiceLabel: z.string().min(1),
    missedNone: z.string().min(1),
    missedSome: z.string().min(1),
    finishedHeading: z.string().min(1),
    noneFinished: z.string().min(1),
    journalLine: z.string().min(1),
    details: z.string().min(1),
    less: z.string().min(1),
    done: z.string().min(1),
    announcement: z.string().min(1),
  }),
});

export const firstSessionStrings =
  FirstSessionStringsSchema.parse(rawFirstSessionStrings);

export function fillFirstSessionCopy(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : token,
  );
}
