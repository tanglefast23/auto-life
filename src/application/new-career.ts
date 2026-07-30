import type { ContentRegistry } from '../sim/content';
import { PrngStreams, type PrngSnapshot } from '../sim/prng';
import { newGameState } from '../sim/state';
import type { Chronotype } from '../sim/types';
import {
  IdentityStateSchema,
  newCareerState,
  type IdentityState,
  type StoredCareer,
} from './career-state';

export interface SeedSource {
  nextSeed(): number;
}

export class CryptoSeedSource implements SeedSource {
  nextSeed(): number {
    const cryptoValue = globalThis.crypto as
      | {
          getRandomValues?: (values: Uint32Array) => Uint32Array;
        }
      | undefined;
    if (cryptoValue?.getRandomValues === undefined) {
      throw new Error('Secure random seed generation is unavailable.');
    }
    return cryptoValue.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }
}

export class RecordedSeedSource implements SeedSource {
  private index = 0;

  constructor(private readonly seeds: readonly number[]) {
    if (seeds.length === 0) throw new Error('at least one seed is required');
  }

  nextSeed(): number {
    const seed = this.seeds[this.index];
    if (seed === undefined) throw new Error('recorded seeds exhausted');
    this.index += 1;
    return seed >>> 0;
  }
}

/**
 * Reuses one recorded seed for every fresh career. The exported P4.5 build
 * uses this only when its explicit playtest URL parameter is present, so the
 * normal player path remains crypto-seeded.
 */
export class FixedSeedSource implements SeedSource {
  constructor(private readonly seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
      throw new Error('fixed seed must be an unsigned 32-bit integer');
    }
  }

  nextSeed(): number {
    return this.seed >>> 0;
  }
}

export function playtestSeedFromSearch(search: string): number | null {
  const values = new URLSearchParams(search).getAll('playtestSeed');
  if (values.length !== 1) return null;
  const raw = values[0]!;
  if (!/^(0|[1-9]\d{0,9})$/.test(raw)) return null;
  const seed = Number(raw);
  return Number.isInteger(seed) && seed <= 0xffff_ffff
    ? seed
    : null;
}

export interface IdentityDraft {
  rootSeed: number;
  prng: PrngSnapshot;
  chronotype: Exclude<Chronotype, 'baseline'>;
  secondCategoryId: 'workout' | 'food' | 'idle';
  secondOptionId: string;
}

export interface IdentityForm {
  name: string;
  pronouns: IdentityState['pronouns'];
  appearancePresetId: string;
}

const RANDOM_NAMES = ['Alex', 'Mika', 'Rowan', 'Sam'] as const;
const PRONOUN_PRESETS: readonly IdentityState['pronouns'][] = [
  { subject: 'they', object: 'them', possessive: 'their' },
  { subject: 'she', object: 'her', possessive: 'her' },
  { subject: 'he', object: 'him', possessive: 'his' },
];

function drawIndex(streams: PrngStreams, length: number): number {
  if (length <= 0) throw new Error('cannot draw from an empty list');
  return Math.min(
    length - 1,
    Math.floor(streams.next('cosmetic') * length),
  );
}

export function prepareIdentityDraft(
  seedSource: SeedSource,
  content: ContentRegistry,
): IdentityDraft {
  const rootSeed = seedSource.nextSeed() >>> 0;
  const streams = PrngStreams.create(rootSeed);
  const chronotypeCategory = content.identity.preferenceCategories.find(
    (category) => category.id === 'chronotype',
  );
  const optionalCategories = content.identity.preferenceCategories.filter(
    (
      category,
    ): category is typeof category & {
      id: 'workout' | 'food' | 'idle';
    } =>
      category.id === 'workout' ||
      category.id === 'food' ||
      category.id === 'idle',
  );
  if (chronotypeCategory === undefined) {
    throw new Error('chronotype content is missing');
  }
  const chronotypeOption =
    chronotypeCategory.options[
      drawIndex(streams, chronotypeCategory.options.length)
    ];
  if (chronotypeOption?.mechanic.kind !== 'chronotype') {
    throw new Error('chronotype option has no chronotype mechanic');
  }
  const secondCategory =
    optionalCategories[drawIndex(streams, optionalCategories.length)];
  if (secondCategory === undefined) {
    throw new Error('optional preference content is missing');
  }
  const secondOption =
    secondCategory.options[
      drawIndex(streams, secondCategory.options.length)
    ];
  if (secondOption === undefined) {
    throw new Error('preference option content is missing');
  }
  return {
    rootSeed,
    prng: streams.serialize(),
    chronotype: chronotypeOption.mechanic.value,
    secondCategoryId: secondCategory.id,
    secondOptionId: secondOption.id,
  };
}

export function finishIdentityCareer(
  draft: IdentityDraft,
  form: IdentityForm,
  content: ContentRegistry,
): StoredCareer {
  return buildCareer(draft, form, content);
}

export function skipIdentityCareer(
  draft: IdentityDraft,
  content: ContentRegistry,
): StoredCareer {
  const streams = PrngStreams.restore(draft.prng);
  const name = RANDOM_NAMES[drawIndex(streams, RANDOM_NAMES.length)]!;
  const pronouns =
    PRONOUN_PRESETS[drawIndex(streams, PRONOUN_PRESETS.length)]!;
  const appearance =
    content.identity.appearancePresets[
      drawIndex(streams, content.identity.appearancePresets.length)
    ];
  if (appearance === undefined) {
    throw new Error('appearance preset content is missing');
  }
  return buildCareer(
    { ...draft, prng: streams.serialize() },
    {
      name,
      pronouns,
      appearancePresetId: appearance.id,
    },
    content,
  );
}

function buildCareer(
  draft: IdentityDraft,
  form: IdentityForm,
  content: ContentRegistry,
): StoredCareer {
  const secondCategory = content.identity.preferenceCategories.find(
    (category) => category.id === draft.secondCategoryId,
  );
  const secondOption = secondCategory?.options.find(
    (option) => option.id === draft.secondOptionId,
  );
  if (secondCategory === undefined || secondOption === undefined) {
    throw new Error('rolled preference is not registered');
  }
  const identity = IdentityStateSchema.parse({
    name: form.name,
    pronouns: form.pronouns,
    appearancePresetId: form.appearancePresetId,
    activePreferenceCategoryIds: [
      'chronotype',
      draft.secondCategoryId,
    ],
    foodMoodId:
      secondCategory.id === 'food' ? secondOption.id : null,
    idlePreferenceId:
      secondCategory.id === 'idle' ? secondOption.id : null,
  });
  const sim = newGameState(
    draft.chronotype,
    content.rates,
    draft.rootSeed,
  );
  if (
    secondCategory.id === 'workout' &&
    secondOption.mechanic.kind === 'preferred-workout'
  ) {
    sim.preferredWorkout = secondOption.mechanic.activityId as
      | 'weights'
      | 'treadmill';
  }
  return newCareerState({
    rootSeed: draft.rootSeed,
    sim,
    identity,
    prng: draft.prng,
    careerId: `career-${draft.rootSeed}`,
  });
}
