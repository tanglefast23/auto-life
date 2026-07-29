import rawRates from '../../content/rates.json';
import rawActivities from '../../content/activities.json';
import rawAnchors from '../../content/anchors.json';
import rawReactive from '../../content/reactive.json';
import rawAdjacency from '../../content/adjacency.json';
import rawPractice from '../../content/practice.json';
import rawHomeMap from '../../content/home-map.json';
import rawObjects from '../../content/objects.json';
import {
  ActivitiesSchema,
  AdjacencySchema,
  AnchorsSchema,
  HomeMapSchema,
  ObjectsSchema,
  PracticeSchema,
  RatesSchema,
  ReactiveSchema,
  type ActivitiesConfig,
  type AdjacencyConfig,
  type AnchorsConfig,
  type HomeMapConfig,
  type ObjectsConfig,
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
  homeMap: HomeMapConfig;
  objects: ObjectsConfig;
}

export const content: ContentRegistry = {
  rates: RatesSchema.parse(rawRates),
  activities: ActivitiesSchema.parse(rawActivities),
  anchors: AnchorsSchema.parse(rawAnchors),
  reactive: ReactiveSchema.parse(rawReactive),
  adjacency: AdjacencySchema.parse(rawAdjacency),
  practice: PracticeSchema.parse(rawPractice),
  homeMap: HomeMapSchema.parse(rawHomeMap),
  objects: ObjectsSchema.parse(rawObjects),
};

/** Registry-scoped lookups: the engine resolves ONLY through these — a step()
 * caller's registry is the single source of truth (audit round 3: the globals
 * silently shadowed injected content for activities/objects). */
export function objectForActivityIn(registry: ContentRegistry, activityId: string) {
  const owners = registry.objects.objects.filter((o) => o.activities.includes(activityId));
  if (owners.length !== 1) throw new Error(`activity "${activityId}" must have exactly one object owner, found ${owners.length}`);
  const owner = owners[0];
  if (!owner) throw new Error('unreachable');
  return owner;
}

export function objectForActivity(activityId: string) {
  return objectForActivityIn(content, activityId);
}

export function activityByIdIn(registry: ContentRegistry, id: string) {
  const def = registry.activities.activities.find((a) => a.id === id);
  if (!def) throw new Error(`unknown activity id "${id}"`);
  return def;
}

export function activityById(id: string) {
  return activityByIdIn(content, id);
}
