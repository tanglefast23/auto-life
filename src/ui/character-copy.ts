import { content } from '../sim/content';
import raw from '../../content/strings/character.json';

/**
 * Player-facing strings for stats, perks and grades (docs/08).
 *
 * Resolves through the authored catalog rather than hard-coding labels, for the same reason
 * every other copy module here does: `validate:content` cross-checks the ids, and the
 * writing review gate (`scripts/validate-writing.ts`) covers the file.
 */

type Catalog = Record<string, unknown>;

function lookup(stringId: string): string {
  const [file, path] = stringId.split(':');
  if (file !== 'character' || path === undefined) {
    throw new Error(`unsupported character string "${stringId}"`);
  }
  let value: unknown = raw as Catalog;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object') {
      throw new Error(`unknown character string "${stringId}"`);
    }
    value = (value as Catalog)[part];
  }
  if (typeof value !== 'string') throw new Error(`unknown character string "${stringId}"`);
  return value;
}

export const characterString = lookup;

export function gradeLabel(gradeId: string): string {
  const grade = content.grades.grades.find((g) => g.id === gradeId);
  if (grade === undefined) throw new Error(`unknown grade "${gradeId}"`);
  return lookup(grade.labelStringId);
}

export function statLabel(statId: string): string {
  const stat = content.stats.stats.find((s) => s.id === statId);
  if (stat === undefined) throw new Error(`unknown stat "${statId}"`);
  return lookup(stat.labelStringId);
}

export function statBlurb(statId: string): string {
  const stat = content.stats.stats.find((s) => s.id === statId);
  if (stat === undefined) throw new Error(`unknown stat "${statId}"`);
  return lookup(stat.blurbStringId);
}

export interface PerkCopy {
  id: string;
  familyLabel: string;
  label: string;
  blurb: string;
}

export function perkCopy(perkId: string): PerkCopy {
  for (const family of content.perks.families) {
    const option = family.options.find((candidate) => candidate.id === perkId);
    if (option === undefined) continue;
    return {
      id: option.id,
      familyLabel: lookup(family.labelStringId),
      label: lookup(option.labelStringId),
      blurb: lookup(option.blurbStringId),
    };
  }
  throw new Error(`unknown perk "${perkId}"`);
}
