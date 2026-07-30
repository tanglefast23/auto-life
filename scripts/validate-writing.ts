import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import rawManifest from '../content/strings/review-manifest.json';

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

export function validateWritingReviews(root = process.cwd()): number {
  const manifest = ManifestSchema.parse(rawManifest);
  const reviewedFiles = new Set<string>();

  for (const review of manifest.reviews) {
    if (reviewedFiles.has(review.file)) {
      throw new Error(`duplicate writing review for "${review.file}"`);
    }
    reviewedFiles.add(review.file);

    const bytes = readFileSync(resolve(root, review.file));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== review.sha256) {
      throw new Error(
        `writing review is stale for "${review.file}": expected ${review.sha256}, got ${actualHash}`,
      );
    }

    const document = JSON.parse(bytes.toString('utf8')) as unknown;
    const actualIds = leafStringIds(document).sort();
    const reviewedIds = [...new Set(review.stringIds)].sort();
    if (
      reviewedIds.length !== review.stringIds.length ||
      JSON.stringify(actualIds) !== JSON.stringify(reviewedIds)
    ) {
      throw new Error(
        `writing review string IDs do not match "${review.file}"`,
      );
    }

    for (const rewrite of review.rewrites) {
      if (!reviewedIds.includes(rewrite.id)) {
        throw new Error(
          `writing rewrite "${rewrite.id}" is not a reviewed string ID`,
        );
      }
    }
  }

  return manifest.reviews.length;
}
