import atlasIndexJson from '../../../assets/generated/atlas-index.json';
import { advancePhase, characterSprite, type AtlasIndex } from '../scene-layout';
import { solveScale } from '../scale';

/**
 * Regressions for adversarial pass 1 (P3 loop 1 of 4). Each test is a bug that existed.
 */

const index = atlasIndexJson as AtlasIndex;

describe('advancePhase survives hostile frame deltas', () => {
  test('a NaN delta does not poison the phase forever', () => {
    // Was: returned NaN. Every later `phase >= 0.5` is false against NaN, so the walk
    // loop froze on frame 0 for the rest of the session.
    const afterNaN = advancePhase(0.5, Number.NaN, 1);
    expect(Number.isFinite(afterNaN)).toBe(true);
    // And the cycle still advances afterwards.
    expect(advancePhase(afterNaN, 300, 1)).not.toBe(afterNaN);
  });

  test('a NaN phase recovers instead of staying stuck', () => {
    const recovered = advancePhase(Number.NaN, 16, 1);
    expect(Number.isFinite(recovered)).toBe(true);
    expect(recovered).toBeGreaterThanOrEqual(0);
    expect(recovered).toBeLessThan(1);
  });

  test('a backwards timestamp never produces a negative phase', () => {
    // Was: -0.5, outside the documented [0,1) contract.
    const p = advancePhase(0.5, -1000, 1);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1);
  });

  test('non-finite mSpeed does not escape', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -3]) {
      const p = advancePhase(0.25, 16, bad);
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });

  test('the frame selector still works after any hostile input', () => {
    let p = advancePhase(Number.NaN, Number.NaN, Number.NaN);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      p = advancePhase(p, 16, 1.5);
      seen.add(characterSprite(index, 'moss-green', 'walk', 'down', p));
    }
    // Every frame must appear — proof the cycle is genuinely running.
    expect(seen.size).toBe(4);
  });

  test('a stopped sim holds its frame (mSpeed 0 is not a bug)', () => {
    let p = 0.4;
    for (let i = 0; i < 100; i++) p = advancePhase(p, 16, 0);
    expect(p).toBeCloseTo(0.4, 10);
  });
});

describe('solveScale never renders below 1:1 on the desktop path', () => {
  test('a narrow high-DPR window reports tooSmall instead of half-scaling', () => {
    // Was: scale 0.5, tooSmall false — a silently half-size world. Sub-native
    // downscaling is the v1.1 sharp-bilinear path (SPEC §11.5), not this one.
    const s = solveScale({ width: 600, height: 2000, devicePixelRatio: 2 });
    expect(s.scale).toBeGreaterThanOrEqual(1);
    expect(s.tooSmall).toBe(true);
  });

  test('no viewport at any DPR ever yields a sub-1 scale', () => {
    for (const dpr of [1, 1.5, 2, 3]) {
      for (const width of [320, 600, 800, 1024, 1366, 1920, 3440]) {
        for (const height of [200, 480, 768, 900, 1080, 2000]) {
          const s = solveScale({ width, height, devicePixelRatio: dpr });
          expect(s.scale).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  test('tooSmall is true exactly when 1× does not fit the reserved area', () => {
    const fits = solveScale({ width: 1366, height: 768, devicePixelRatio: 1 });
    expect(fits.tooSmall).toBe(false);
    const doesNot = solveScale({ width: 700, height: 768, devicePixelRatio: 1 });
    expect(doesNot.tooSmall).toBe(true);
    expect(doesNot.scale).toBe(1);
  });

  test('the wide-short window still finds a legal fit', () => {
    const s = solveScale({ width: 3440, height: 900, devicePixelRatio: 1 });
    expect(s.tooSmall).toBe(false);
    expect(s.scale).toBe(1);
    expect(s.exact).toBe(true);
  });
});
