import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateWritingReviews } from '../validate-writing';

function copyStringsFixture(): {
  root: string;
  strings: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'auto-life-writing-'));
  const strings = join(root, 'content', 'strings');
  cpSync(join(process.cwd(), 'content', 'strings'), strings, {
    recursive: true,
  });
  return { root, strings };
}

test('the reviewed authored-string batch is current', () => {
  expect(validateWritingReviews()).toBe(10);
});

test('changing authored copy without a matching review makes validation fail', () => {
  const { root, strings } = copyStringsFixture();
  const target = join(strings, 'queue.json');
  writeFileSync(
    target,
    readFileSync(target, 'utf8').replace('Forecast updated.', 'Forecast changed.'),
  );

  try {
    expect(() => validateWritingReviews(root)).toThrow(/writing review is stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an authored string file without a review makes validation fail', () => {
  const { root, strings } = copyStringsFixture();
  writeFileSync(join(strings, 'unreviewed.json'), '{"message":"Hello."}\n');

  try {
    expect(() => validateWritingReviews(root)).toThrow(
      /missing writing review for "content\/strings\/unreviewed\.json"/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a review without an authored string file makes validation fail', () => {
  const { root, strings } = copyStringsFixture();
  const manifestPath = join(strings, 'review-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    reviews: Array<Record<string, unknown>>;
  };
  manifest.reviews.push({
    ...manifest.reviews[0],
    file: 'content/strings/missing.json',
  });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  try {
    expect(() => validateWritingReviews(root)).toThrow(
      /writing review has no authored file "content\/strings\/missing\.json"/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a recorded rewrite must match the current authored string', () => {
  const { root, strings } = copyStringsFixture();
  const manifestPath = join(strings, 'review-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    reviews: Array<{
      rewrites: Array<{ after: string }>;
    }>;
  };
  manifest.reviews[0]!.rewrites[0]!.after = 'A different sentence.';
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  try {
    expect(() => validateWritingReviews(root)).toThrow(
      /does not match the authored string/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
