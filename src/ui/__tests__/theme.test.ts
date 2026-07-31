import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { PALETTE_57 } from '../../render/palette';
import { BUBBLE_TINT, CHROME, crispSize, FONT, PIXEL_EM, PROSE, TABULAR, TYPE_SCALE, theme } from '../theme';

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
    const families = new Set(Object.values(TYPE_SCALE).map((t) => t.fontFamily));
    expect(families.size).toBeLessThanOrEqual(2);
    for (const spec of Object.values(TYPE_SCALE)) {
      expect(spec.fontWeight).toBe('normal');
    }
    expect(FONT.pixel).not.toBe(FONT.pixelBold);
  });

  it('keeps every pixel-font size on Silkscreen’s 8px em, so nothing anti-aliases', () => {
    for (const spec of Object.values(TYPE_SCALE)) {
      expect(spec.fontSize % PIXEL_EM).toBe(0);
    }
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
