import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { PALETTE_57 } from '../../render/palette';
import {
  BUBBLE_TINT,
  CHROME,
  crispSize,
  FONT,
  isPixelStep,
  MIN_READABLE,
  PIXEL_EM,
  PROSE,
  scaledType,
  TABULAR,
  TYPE_SCALE,
  theme,
  type TypeStep,
} from '../theme';

/**
 * P6 T7 — the caps design.md §4 and Joe's global rules set, enforced mechanically.
 *
 * Before P6 the UI carried sixteen distinct font sizes against a cap of four, three weights
 * against a cap of two, and palette hex literals copy-pasted across fourteen files. Review
 * had not caught any of it in five phases, which is the argument for a test.
 */

const repoRoot = resolve(__dirname, '../../..');

function sourceFiles(dir: string): string[] {
  const full = resolve(repoRoot, dir);
  return readdirSync(full).flatMap((entry) => {
    const path = resolve(full, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' ? [] : sourceFiles(`${dir}/${entry}`);
    }
    return /\.tsx?$/.test(entry) ? [`${dir}/${entry}`] : [];
  });
}

const UI_SOURCES = [...sourceFiles('src/ui'), ...sourceFiles('src/application')].filter(
  (f) => !f.endsWith('theme.ts'),
);

describe('theme colours (design.md §2)', () => {
  it('uses only §2 palette colours', () => {
    const offenders = Object.entries(theme.color).filter(([, hex]) => !PALETTE_57.includes(hex));
    expect(offenders).toEqual([]);
  });

  it('re-exports the palette rather than restating it, so UI and world cannot drift', () => {
    // Every token must be identical to a palette entry by value, not merely similar.
    for (const hex of Object.values(theme.color)) {
      expect(PALETTE_57).toContain(hex);
    }
  });

  it('keeps red for URGENT and destructive, and gold for rewards only', () => {
    expect(CHROME.destructiveButton.backgroundColor).toBe(theme.color.red);
    expect(CHROME.rewardButton.backgroundColor).toBe(theme.color.gold);
    expect(CHROME.neutralButton.backgroundColor).not.toBe(theme.color.red);
    expect(CHROME.neutralButton.backgroundColor).not.toBe(theme.color.gold);
    expect(CHROME.panel.backgroundColor).not.toBe(theme.color.gold);
  });

  it('never tints a bubble red (design.md §8)', () => {
    expect(Object.values(BUBBLE_TINT)).not.toContain(theme.color.red);
  });
});

describe('typography (design.md §4)', () => {
  it('ships at most four sizes', () => {
    const sizes = new Set<number>(Object.values(TYPE_SCALE).map((t) => t.fontSize as number));
    sizes.add(PROSE.fontSize as number);
    expect(sizes.size).toBeLessThanOrEqual(4);
  });

  it('ships at most two weights, carried by family and never by synthetic bold', () => {
    // HFM §2.5: synthetic bold on a one-weight bitmap face smears the grid. Silkscreen
    // ships 400Regular and 700Bold, so weight is a different file, not a transform.
    //
    // P7 counts *pixel* families rather than all families. Before P7 the two were the
    // same set, so family-count was a sound proxy for the §4 weight cap; now that
    // `caption` is sans, counting families would read the cap as broken when what
    // actually changed is that §4's separately-licensed prose face entered the scale.
    // The cap being enforced is two weights, not two files.
    const pixelFamilies = new Set(
      (Object.keys(TYPE_SCALE) as TypeStep[])
        .filter(isPixelStep)
        .map((step) => TYPE_SCALE[step].fontFamily),
    );
    expect(pixelFamilies.size).toBeLessThanOrEqual(2);
    for (const spec of Object.values(TYPE_SCALE)) {
      expect(spec.fontWeight).toBe('normal');
    }
    expect(FONT.pixel).not.toBe(FONT.pixelBold);
  });

  it('keeps every pixel-font size on Silkscreen’s 8px em, so nothing anti-aliases', () => {
    for (const step of Object.keys(TYPE_SCALE) as TypeStep[]) {
      if (!isPixelStep(step)) continue;
      expect(TYPE_SCALE[step].fontSize % PIXEL_EM).toBe(0);
    }
  });

  it('puts no player-facing step below the readable floor', () => {
    // The P7 audit's headline finding: queue names, predicted times, need values and the
    // Practice counter all computed at 8px. 8px is *legal Silkscreen*, which is why five
    // phases of review passed it — the em grid says crisp, and crisp was all anyone checked.
    for (const spec of Object.values(TYPE_SCALE)) {
      expect(spec.fontSize).toBeGreaterThanOrEqual(MIN_READABLE);
    }
    expect(PROSE.fontSize as number).toBeGreaterThanOrEqual(MIN_READABLE);
  });

  it('keeps the sub-16px tier on the sans face, because 12px Silkscreen anti-aliases', () => {
    for (const step of Object.keys(TYPE_SCALE) as TypeStep[]) {
      if (TYPE_SCALE[step].fontSize >= PIXEL_EM * 2) continue;
      expect(isPixelStep(step)).toBe(false);
    }
  });

  it('retired the 8px micro step entirely', () => {
    expect(Object.keys(TYPE_SCALE)).not.toContain('micro');
  });

  it('uses a readable sans for prose, per design.md §4', () => {
    expect(PROSE.fontFamily).toBe(FONT.prose);
    expect(PROSE.fontFamily).not.toBe(FONT.pixel);
  });

  it('offers tabular numerals for the numbers Joe’s rules require them on', () => {
    expect(TABULAR.fontVariant).toContain('tabular-nums');
  });
});

describe('accessibility scaling stays crisp', () => {
  it('snaps every scale the settings slider can produce onto the em grid', () => {
    // P5's hudTextScale is a continuous 0.75..1.5. 16 x 1.25 = 20, which is not a multiple
    // of 8 and would anti-alias — accessibility and design.md §13 in direct conflict.
    for (let scale = 0.75; scale <= 1.5001; scale += 0.05) {
      for (const spec of Object.values(TYPE_SCALE)) {
        expect(crispSize(spec.fontSize, scale) % PIXEL_EM).toBe(0);
      }
    }
  });

  it('still grows the text at the top of the range', () => {
    expect(crispSize(16, 1.5)).toBeGreaterThan(16);
    expect(crispSize(16, 1)).toBe(16);
  });

  it('never collapses below one em', () => {
    expect(crispSize(8, 0.75)).toBe(PIXEL_EM);
    expect(crispSize(8, 0.1)).toBe(PIXEL_EM);
  });

  it('fails soft on a hostile scale rather than producing NaN', () => {
    expect(crispSize(16, Number.NaN)).toBe(16);
    expect(crispSize(16, 0)).toBe(16);
    expect(crispSize(16, -2)).toBe(16);
  });
});

describe('scaledType — the function the HUD setting actually moves (P7)', () => {
  const SLIDER: number[] = [];
  for (let s = 0.75; s <= 1.5001; s += 0.05) SLIDER.push(Number(s.toFixed(2)));

  it('holds every step at or above the readable floor across the whole slider', () => {
    // The regression this guards: scaling *down* is how a 12px caption becomes 9px and
    // the game quietly returns to the state the P7 audit failed it for.
    for (const scale of SLIDER) {
      for (const step of Object.keys(TYPE_SCALE) as TypeStep[]) {
        expect({ step, scale, size: scaledType(step, scale).fontSize }).toEqual({
          step,
          scale,
          size: expect.any(Number),
        });
        expect(scaledType(step, scale).fontSize as number).toBeGreaterThanOrEqual(MIN_READABLE);
      }
    }
  });

  it('keeps pixel steps on the em grid and lets the sans step move freely', () => {
    for (const scale of SLIDER) {
      for (const step of Object.keys(TYPE_SCALE) as TypeStep[]) {
        const size = scaledType(step, scale).fontSize as number;
        if (isPixelStep(step)) expect(size % PIXEL_EM).toBe(0);
      }
    }
    // The sans step genuinely responds rather than snapping back onto 8s: if it were
    // routed through crispSize it would read 16 at both 1.25 and 1.5.
    expect(scaledType('caption', 1.5).fontSize).toBeGreaterThan(
      scaledType('caption', 1).fontSize as number,
    );
  });

  it('grows the caption’s line height with its size so prose never collides', () => {
    const big = scaledType('caption', 1.5);
    expect(big.lineHeight as number).toBeGreaterThan(TYPE_SCALE.caption.lineHeight);
    expect(big.lineHeight as number).toBeGreaterThan(big.fontSize as number);
  });

  it('fails soft on a hostile scale', () => {
    for (const step of Object.keys(TYPE_SCALE) as TypeStep[]) {
      expect(scaledType(step, Number.NaN).fontSize).toBe(TYPE_SCALE[step].fontSize);
      expect(scaledType(step, 0).fontSize).toBe(TYPE_SCALE[step].fontSize);
    }
  });
});

describe('layout (Joe’s global rules, SPEC §11.2)', () => {
  it('keeps every spacing token on the 4px grid', () => {
    for (const v of Object.values(theme.space)) expect(v % 4).toBe(0);
  });

  it('keeps every pressable recipe at or above the 44px hit target', () => {
    for (const [name, recipe] of Object.entries(CHROME)) {
      const min = (recipe as { minHeight?: number }).minHeight;
      if (min === undefined) continue;
      expect({ name, min }).toEqual({ name, min: expect.any(Number) });
      expect(min).toBeGreaterThanOrEqual(theme.minTarget);
    }
  });

  it('outlines every chrome recipe in Ink — Track A, the inverse of the world rule', () => {
    for (const recipe of Object.values(CHROME)) {
      expect((recipe as { borderColor?: string }).borderColor).toBe(theme.color.ink);
    }
  });
});

describe('the UI reads the theme rather than restating it', () => {
  it('declares no palette hex literal outside the theme', () => {
    // AppShell alone carried 36 before P6. A literal here is how the UI drifts off-palette
    // without the art validator — which only sees generated PNGs — ever noticing.
    const offenders: string[] = [];
    for (const file of UI_SOURCES) {
      readFileSync(resolve(repoRoot, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/['"]#[0-9a-fA-F]{6}['"]/.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('declares no font size outside the theme', () => {
    const offenders: string[] = [];
    for (const file of UI_SOURCES) {
      readFileSync(resolve(repoRoot, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/fontSize:\s*\d/.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('never pairs the pixel face with the sub-16px step', () => {
    // The failure this catches is silent and specific: `...TYPE_SCALE.caption` followed by
    // `fontFamily: FONT.pixel` yields 12px Silkscreen, which anti-aliases — design.md §13's
    // instant reject — while every size assertion in this file still passes. The caption
    // step is legible *because* it changes face; re-pinning the face undoes it invisibly.
    const offenders: string[] = [];
    for (const file of UI_SOURCES) {
      const src = readFileSync(resolve(repoRoot, file), 'utf8');
      // Walk each style object and check the two declarations against each other.
      for (const block of src.split(/\n\s{2}[a-zA-Z][a-zA-Z0-9_]*:\s*\{/)) {
        const head = block.split(/\n\s{2}\}/)[0] ?? '';
        if (!/\.\.\.TYPE_SCALE\.caption/.test(head)) continue;
        if (/fontFamily:\s*FONT\.pixel/.test(head)) {
          offenders.push(`${file}: caption step re-pinned to the pixel face`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('leaves no line height below its own step’s size', () => {
    // Migrating 8px text to 12/16px left 14 line heights of 10–15px behind, each tuned for
    // the old size and each one clipping its new text. They override the step because they
    // are declared *after* the spread.
    const offenders: string[] = [];
    for (const file of UI_SOURCES) {
      const src = readFileSync(resolve(repoRoot, file), 'utf8');
      for (const block of src.split(/\n\s{2}[a-zA-Z][a-zA-Z0-9_]*:\s*\{/)) {
        const head = block.split(/\n\s{2}\}/)[0] ?? '';
        const step = head.match(/\.\.\.TYPE_SCALE\.(\w+)/)?.[1];
        const lh = head.match(/lineHeight:\s*(\d+)/)?.[1];
        if (step === undefined || lh === undefined) continue;
        const size = TYPE_SCALE[step as TypeStep]?.fontSize;
        if (size !== undefined && Number(lh) < size) {
          offenders.push(`${file}: lineHeight ${lh} under ${step} (${size}px)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('leaves no monospace fallback behind', () => {
    const offenders: string[] = [];
    for (const file of UI_SOURCES) {
      if (/fontFamily:\s*'monospace'/.test(readFileSync(resolve(repoRoot, file), 'utf8'))) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
