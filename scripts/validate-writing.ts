import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const ReviewSchema = z.strictObject({
  file: z.string().startsWith('content/strings/'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  humanizer: z.strictObject({
    name: z.literal('humanizer'),
    version: z.string().min(1),
    invocation: z.string().min(1),
  }),
  stringIds: z.array(z.string().min(1)).min(1),
  rewrites: z.array(
    z.strictObject({
      id: z.string().min(1),
      before: z.string().min(1),
      after: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
  checklist: z.string().min(1),
});

const ManifestSchema = z.strictObject({
  version: z.literal(1),
  reviews: z.array(ReviewSchema).min(1),
});

function leafStringIds(value: unknown, path: string[] = []): string[] {
  if (typeof value === 'string') return [path.join('.')];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`authored strings must be nested objects at "${path.join('.')}"`);
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafStringIds(child, [...path, key]),
  );
}

function leafStrings(
  value: unknown,
  path: string[] = [],
): Array<readonly [string, string]> {
  if (typeof value === 'string') return [[path.join('.'), value]];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`authored strings must be nested objects at "${path.join('.')}"`);
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafStrings(child, [...path, key]),
  );
}

export function validateWritingReviews(root = process.cwd()): number {
  const manifestPath = resolve(
    root,
    'content',
    'strings',
    'review-manifest.json',
  );
  const manifest = ManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown,
  );
  const reviewedFiles = new Set<string>();
  const authoredFiles = new Set(
    readdirSync(resolve(root, 'content', 'strings'))
      .filter(
        (filename) =>
          filename.endsWith('.json') && filename !== 'review-manifest.json',
      )
      .map((filename) => `content/strings/${filename}`),
  );

  for (const review of manifest.reviews) {
    if (reviewedFiles.has(review.file)) {
      throw new Error(`duplicate writing review for "${review.file}"`);
    }
    reviewedFiles.add(review.file);
  }

  for (const file of authoredFiles) {
    if (!reviewedFiles.has(file)) {
      throw new Error(`missing writing review for "${file}"`);
    }
  }

  for (const file of reviewedFiles) {
    if (!authoredFiles.has(file)) {
      throw new Error(`writing review has no authored file "${file}"`);
    }
  }

  for (const review of manifest.reviews) {
    const bytes = readFileSync(resolve(root, review.file));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== review.sha256) {
      throw new Error(
        `writing review is stale for "${review.file}": expected ${review.sha256}, got ${actualHash}`,
      );
    }

    const document = JSON.parse(bytes.toString('utf8')) as unknown;
    const actualIds = leafStringIds(document).sort();
    const actualStrings = new Map(leafStrings(document));
    const reviewedIds = [...new Set(review.stringIds)].sort();
    if (
      reviewedIds.length !== review.stringIds.length ||
      JSON.stringify(actualIds) !== JSON.stringify(reviewedIds)
    ) {
      throw new Error(
        `writing review string IDs do not match "${review.file}"`,
      );
    }

    const rewrittenIds = new Set<string>();
    for (const rewrite of review.rewrites) {
      if (!reviewedIds.includes(rewrite.id)) {
        throw new Error(
          `writing rewrite "${rewrite.id}" is not a reviewed string ID`,
        );
      }
      if (rewrittenIds.has(rewrite.id)) {
        throw new Error(`duplicate writing rewrite for "${rewrite.id}"`);
      }
      rewrittenIds.add(rewrite.id);
      if (rewrite.before === rewrite.after) {
        throw new Error(`writing rewrite "${rewrite.id}" did not change`);
      }
      if (actualStrings.get(rewrite.id) !== rewrite.after) {
        throw new Error(
          `writing rewrite "${rewrite.id}" does not match the authored string`,
        );
      }
    }
  }

  return manifest.reviews.length;
}
