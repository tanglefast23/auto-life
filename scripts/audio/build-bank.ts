import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderBank } from './bank';
import { encodeWav, SAMPLE_RATE } from './wav';

/**
 * Renders the authored cue bank to committed WAV (P6 T9/T10).
 *
 * The art-side twin of `build-atlas.ts`, and deliberately the same shape: authored
 * parameters in, deterministic bytes out, committed, and diffed in CI by
 * `npm run audio:check`. Nothing in P6 waits on a purchase.
 *
 * The budget is asserted here rather than hoped for. Uncompressed audio is the obvious
 * risk in this approach, so the build fails if the bank exceeds it — a silent 40 MB web
 * bundle would be a worse outcome than a licensed pack.
 */

/** P6 plan §0b. Music beds dominate; everything else is under 1.5 s. */
const MAX_BANK_BYTES = 4 * 1024 * 1024;

export function main(): void {
  const bank = renderBank();
  const outDir = resolve(__dirname, '../../assets/audio');

  // Rebuild from empty, so a renamed cue cannot leave an orphan the bill gate then
  // "finds" on disk and reports as satisfied.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  let total = 0;
  const rows: string[] = [];
  for (const [id, samples] of Object.entries(bank)) {
    const bytes = encodeWav(samples);
    total += bytes.length;
    writeFileSync(resolve(outDir, `${id}.wav`), bytes);
    rows.push(`  ${id.padEnd(20)} ${(samples.length / SAMPLE_RATE).toFixed(2)}s  ${(bytes.length / 1024).toFixed(0)} KB`);
  }

  const written = readdirSync(outDir).filter((f) => f.endsWith('.wav'));
  console.log(`audio bank: ${written.length} cues, ${(total / 1024 / 1024).toFixed(2)} MB @ ${SAMPLE_RATE} Hz mono`);
  for (const row of rows) console.log(row);

  if (total > MAX_BANK_BYTES) {
    console.error(
      `\nBANK OVER BUDGET: ${(total / 1024 / 1024).toFixed(2)} MB > ${(MAX_BANK_BYTES / 1024 / 1024).toFixed(0)} MB.` +
        `\nDrop the music beds to 16000 Hz before cutting any cue (P6 plan §0b).`,
    );
    process.exit(1);
  }
  console.log(`wrote ${outDir}`);
}

if (require.main === module) main();
