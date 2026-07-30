import { HUD_H, QUEUE_W, solveScale, WORLD_H, WORLD_W } from '../scale';

/**
 * P3 T8 — SPEC §11.5's three verified desktop cases, plus the degradation path.
 * These are the numbers the SPEC claims were verified; asserting them here is what
 * stops the claim drifting.
 */

describe('SPEC §11.5 verified desktop cases', () => {
  test('MacBook Air 13 at DPR 2 gets the 1.5× half-step (3 physical px per art px)', () => {
    // 1470×956 logical is the MBA 13" default "looks like" resolution.
    const s = solveScale({ width: 1470, height: 956, devicePixelRatio: 2 });
    expect(s.scale).toBe(1.5);
    expect(s.physicalPerArtPixel).toBe(3);
    expect(s.exact).toBe(true);
    expect(s.tooSmall).toBe(false);
    // And it genuinely fits the reserved area.
    expect(s.width).toBeLessThanOrEqual(s.available.width);
    expect(s.height).toBeLessThanOrEqual(s.available.height);
  });

  test('1366×768 at DPR 1 runs 1× — no half-steps exist at DPR 1', () => {
    const s = solveScale({ width: 1366, height: 768, devicePixelRatio: 1 });
    expect(s.scale).toBe(1);
    expect(s.physicalPerArtPixel).toBe(1);
    expect(s.exact).toBe(true);
    expect(s.tooSmall).toBe(false);
  });

  test('UI is reserved before the world gets any space', () => {
    const s = solveScale({ width: 1920, height: 1080, devicePixelRatio: 1 });
    expect(s.available.height).toBe(1080 - HUD_H);
    expect(s.available.width).toBe(1920 - QUEUE_W);
  });

  test('larger accessible HUD text reserves its real height before scaling the world', () => {
    const s = solveScale({
      width: 1366,
      height: 900,
      devicePixelRatio: 1,
      hudHeight: HUD_H * 1.5,
    });
    expect(s.available.height).toBe(900 - HUD_H * 1.5);
    expect(s.available.width).toBe(1366 - QUEUE_W);
  });
});

describe('the pixel grid is never resampled on desktop', () => {
  test('every solution at an integer DPR is exact', () => {
    for (const dpr of [1, 2, 3]) {
      for (const width of [1280, 1366, 1440, 1600, 1920, 2560]) {
        for (const height of [720, 768, 800, 900, 1080, 1440]) {
          const s = solveScale({ width, height, devicePixelRatio: dpr });
          expect(s.exact).toBe(true);
          expect(Number.isInteger(s.physicalPerArtPixel)).toBe(true);
        }
      }
    }
  });

  test('the chosen scale is the largest that fits — one step up would overflow', () => {
    const vp = { width: 1470, height: 956, devicePixelRatio: 2 };
    const s = solveScale(vp);
    const nextStep = s.scale + 1 / vp.devicePixelRatio;
    const overflows = WORLD_W * nextStep > s.available.width || WORLD_H * nextStep > s.available.height;
    expect(overflows).toBe(true);
  });

  test('a large display scales up rather than leaving the world tiny', () => {
    const s = solveScale({ width: 3840, height: 2160, devicePixelRatio: 2 });
    expect(s.scale).toBeGreaterThanOrEqual(4);
    expect(s.exact).toBe(true);
  });
});

describe('degradation, not crashes', () => {
  test('a window too small for 1× reports tooSmall instead of throwing', () => {
    const s = solveScale({ width: 400, height: 300, devicePixelRatio: 1 });
    expect(s.tooSmall).toBe(true);
    expect(s.scale).toBeGreaterThan(0);
    expect(Number.isFinite(s.width)).toBe(true);
  });

  test('a viewport narrower than the reserved rail yields zero available width, not negative', () => {
    const s = solveScale({ width: QUEUE_W - 10, height: 800, devicePixelRatio: 1 });
    expect(s.available.width).toBe(0);
    expect(s.tooSmall).toBe(true);
  });

  test('fractional scaling fits a cramped viewport only when enabled', () => {
    const viewport = {
      width: QUEUE_W + 600,
      height: HUD_H + 350,
      devicePixelRatio: 2,
    };
    const exactOnly = solveScale(viewport);
    const fractional = solveScale({
      ...viewport,
      fractionalScaling: true,
    });
    expect(exactOnly).toMatchObject({ scale: 1, tooSmall: true });
    expect(fractional.tooSmall).toBe(false);
    expect(fractional.exact).toBe(false);
    expect(fractional.width).toBeLessThanOrEqual(viewport.width);
    expect(fractional.height).toBeLessThanOrEqual(350);
  });

  test('a nonsense devicePixelRatio falls back to 1 rather than producing NaN', () => {
    for (const dpr of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s = solveScale({ width: 1920, height: 1080, devicePixelRatio: dpr });
      expect(Number.isFinite(s.scale)).toBe(true);
      expect(s.scale).toBeGreaterThan(0);
      expect(Number.isFinite(s.physicalPerArtPixel)).toBe(true);
    }
  });

  test('a fractional DPR still returns something usable (fractional path is v1.1)', () => {
    const s = solveScale({ width: 1920, height: 1080, devicePixelRatio: 1.5 });
    expect(Number.isFinite(s.scale)).toBe(true);
    expect(s.scale).toBeGreaterThan(0);
    // Not asserted exact: SPEC §11.5 sends non-integer DPR to the v1.1 sharp-bilinear path.
  });
});
