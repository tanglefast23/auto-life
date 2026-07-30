import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateWritingReviews } from '../validate-writing';

test('the reviewed authored-string batch is current', () => {
  expect(validateWritingReviews()).toBe(2);
});

test('changing authored copy without a matching review makes validation fail', () => {
  const root = mkdtempSync(join(tmpdir(), 'auto-life-writing-'));
  const strings = join(root, 'content', 'strings');
  mkdirSync(strings, { recursive: true });
  const source = join(process.cwd(), 'content', 'strings', 'queue.json');
  const target = join(strings, 'queue.json');
  copyFileSync(source, target);
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
