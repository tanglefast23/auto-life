import rawRates from '../../content/rates.json';
import rawActivities from '../../content/activities.json';
import { ActivitiesSchema, RatesSchema, type ActivitiesConfig, type RatesConfig } from './content-schemas';

/**
 * The one runtime import path for content. Raw JSON is parsed exactly once here;
 * everything else (runtime and tests alike) imports the typed result.
 * New content files register here — never in a second, tests-only list.
 */
export interface ContentRegistry {
  rates: RatesConfig;
  activities: ActivitiesConfig;
}

export const content: ContentRegistry = {
  rates: RatesSchema.parse(rawRates),
  activities: ActivitiesSchema.parse(rawActivities),
};

export function activityById(id: string) {
  const def = content.activities.activities.find((a) => a.id === id);
  if (!def) throw new Error(`unknown activity id "${id}"`);
  return def;
}
