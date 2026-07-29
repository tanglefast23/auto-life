import rawRates from '../../content/rates.json';
import rawActivities from '../../content/activities.json';
import rawAnchors from '../../content/anchors.json';
import rawReactive from '../../content/reactive.json';
import rawAdjacency from '../../content/adjacency.json';
import rawPractice from '../../content/practice.json';
import {
  ActivitiesSchema,
  AdjacencySchema,
  AnchorsSchema,
  PracticeSchema,
  RatesSchema,
  ReactiveSchema,
  type ActivitiesConfig,
  type AdjacencyConfig,
  type AnchorsConfig,
  type PracticeConfig,
  type RatesConfig,
  type ReactiveConfig,
} from './content-schemas';

/**
 * The one runtime import path for content. Raw JSON is parsed exactly once here;
 * everything else (runtime and tests alike) imports the typed result.
 * New content files register here — never in a second, tests-only list.
 */
export interface ContentRegistry {
  rates: RatesConfig;
  activities: ActivitiesConfig;
  anchors: AnchorsConfig;
  reactive: ReactiveConfig;
  adjacency: AdjacencyConfig;
  practice: PracticeConfig;
}

export const content: ContentRegistry = {
  rates: RatesSchema.parse(rawRates),
  activities: ActivitiesSchema.parse(rawActivities),
  anchors: AnchorsSchema.parse(rawAnchors),
  reactive: ReactiveSchema.parse(rawReactive),
  adjacency: AdjacencySchema.parse(rawAdjacency),
  practice: PracticeSchema.parse(rawPractice),
};

export function activityById(id: string) {
  const def = content.activities.activities.find((a) => a.id === id);
  if (!def) throw new Error(`unknown activity id "${id}"`);
  return def;
}
