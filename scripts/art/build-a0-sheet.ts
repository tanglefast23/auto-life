import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { A0_BODY_FRAMES, A0_HAIR, A0_OUTFIT } from '../../src/render/sprites/a0';
import {
  deriveSlim,
  opaqueCount,
  rasterize,
  silhouette,
  torsoWidth,
  type BodyFrame,
  type BuildName,
} from '../../src/render/sprite-spec';
import { CREAM_BASE, CREAM_SHADOW, hexToRgb, INK } from '../../src/render/palette';
import { blit, createBitmap, encodePng, scaleNearest, type Bitmap } from './png';
import { auditBitmap, formatReport, reportIsClean } from './validate-palette';

/**
 * Renders the A0 review sheet (master §5: "Reviewed rendered evidence at target scales").
 *
 * The sheet is the deliverable a human actually looks at, so it shows the thing under
 * review rather than a pretty arrangement: every frame of both builds, at 1×/2×/4×,
 * with the flat-Ink silhouette row directly beneath each composite — because
 * design.md §6's readability test is "reads in flat Ink", and you cannot judge that
 * from a coloured sprite.
 */

const PAD = 2;

function fill(bmp: Bitmap, hex: string): void {
  const { r, g, b } = hexToRgb(hex);
  for (let i = 0; i < bmp.width * bmp.height; i++) {
    bmp.data[i * 4] = r;
    bmp.data[i * 4 + 1] = g;
    bmp.data[i * 4 + 2] = b;
    bmp.data[i * 4 + 3] = 255;
  }
}

export interface BuiltFrame {
  build: BuildName;
  frame: BodyFrame;
  composite: Bitmap;
  silhouette: Bitmap;
}

export function buildAllFrames(): BuiltFrame[] {
  const out: BuiltFrame[] = [];
  for (const build of ['average', 'slim'] as const) {
    for (const base of A0_BODY_FRAMES) {
      const frame = build === 'average' ? base : deriveSlim(base);
      const frameIndex = frame.id.endsWith('-1') ? 1 : 0;
      const composite = rasterize({ frame, frameIndex, hair: A0_HAIR, outfit: A0_OUTFIT });
      out.push({ build, frame, composite, silhouette: silhouette(composite) });
    }
  }
  return out;
}

/** One row per build, one column per frame; composite over silhouette. */
function sheetForScale(built: BuiltFrame[], scale: number): Bitmap {
  const perBuild = built.filter((b) => b.build === 'average').length;
  const cellW = 32 * scale + PAD * 2;
  const cellH = 48 * scale + PAD * 2;
  const sheet = createBitmap(cellW * perBuild, cellH * 4);
  fill(sheet, CREAM_BASE);
  // Row separators so the four bands (avg composite / avg silhouette / slim / slim silhouette) read apart.
  const { r, g, b } = hexToRgb(CREAM_SHADOW);
  for (let row = 1; row < 4; row++) {
    const y = row * cellH;
    for (let x = 0; x < sheet.width; x++) {
      const i = (y * sheet.width + x) * 4;
      sheet.data[i] = r;
      sheet.data[i + 1] = g;
      sheet.data[i + 2] = b;
      sheet.data[i + 3] = 255;
    }
  }
  const rowFor = (build: BuildName, kind: 'composite' | 'silhouette') =>
    (build === 'average' ? 0 : 2) + (kind === 'composite' ? 0 : 1);
  const colOf = new Map<string, number>();
  let next = 0;
  for (const b of built) {
    const key = b.frame.id.replace(/^(average|slim)-/, '');
    if (!colOf.has(key)) colOf.set(key, next++);
  }
  for (const b of built) {
    const col = colOf.get(b.frame.id.replace(/^(average|slim)-/, '')) ?? 0;
    blit(sheet, scaleNearest(b.composite, scale), col * cellW + PAD, rowFor(b.build, 'composite') * cellH + PAD);
    blit(sheet, scaleNearest(b.silhouette, scale), col * cellW + PAD, rowFor(b.build, 'silhouette') * cellH + PAD);
  }
  return sheet;
}

export function main(): void {
  const built = buildAllFrames();
  const reports = built.map((b) => auditBitmap(`${b.build}/${b.frame.id}`, b.composite, 'character'));
  let failed = 0;
  for (const r of reports) {
    if (!reportIsClean(r)) {
      failed++;
      console.error(formatReport(r));
    }
  }
  if (failed > 0) {
    console.error(`\nA0 FAILED: ${failed} of ${reports.length} frames violate design.md §12.`);
    process.exit(1);
  }

  const outDir = resolve(__dirname, '../../docs/superpowers/evidence');
  mkdirSync(outDir, { recursive: true });
  for (const scale of [1, 2, 4]) {
    const sheet = sheetForScale(built, scale);
    const path = resolve(outDir, `a0-sheet-${scale}x.png`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encodePng(sheet));
    console.log(`wrote ${path} (${sheet.width}×${sheet.height})`);
  }

  // The numbers the A0 decision actually rests on.
  const avg = built.filter((b) => b.build === 'average');
  const slim = built.filter((b) => b.build === 'slim');
  console.log(`\nframes: ${avg.length} average + ${slim.length} slim (slim offset-derived, never redrawn)`);
  console.log(`palette: every frame clean against the ${reports.length ? 'locked 57' : '?'} — validator green`);
  for (let i = 0; i < avg.length; i++) {
    const a = avg[i]!;
    const s = slim[i]!;
    console.log(
      `  ${a.frame.id.replace('average-', '').padEnd(16)} avg torso ${torsoWidth(a.composite)}px / ${opaqueCount(a.composite)}px  →  slim torso ${torsoWidth(s.composite)}px / ${opaqueCount(s.composite)}px`,
    );
  }
  console.log(`\nink used for face/UI only; world outlines are ramp-shadow (design.md §3) — ${INK} appears in eyes`);
}

if (require.main === module) main();
