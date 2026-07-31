import {
  FRAME_BUDGET_MS,
  PASS_DROPPED_FRACTION,
  meetsFrameBar,
  shouldProbe,
  summarizeFrames,
} from '../perf-probe';

/**
 * P6 T12 — the frame probe.
 *
 * SPEC §18 says "60 fps on desktop web" and, before P6, nothing measured it. An audit also
 * pointed out the plan gave no threshold, so two honest people could disagree about a pass.
 * The bar is now numeric, and these tests pin the arithmetic that decides it.
 */

describe('the bar SPEC §18 sets', () => {
  it('uses the 60 fps budget', () => {
    expect(FRAME_BUDGET_MS).toBeCloseTo(1000 / 60, 6);
  });

  it('passes a clean sample', () => {
    const summary = summarizeFrames(Array.from({ length: 600 }, () => 16));
    expect(meetsFrameBar(summary)).toBe(true);
  });

  it('fails a sample that misses p95 even when the median is fine', () => {
    // 90% at 12ms, 10% at 40ms: the median looks excellent and the experience does not.
    const deltas = Array.from({ length: 600 }, (_, i) => (i % 10 === 0 ? 40 : 12));
    const summary = summarizeFrames(deltas);
    expect(summary.p50).toBeLessThan(FRAME_BUDGET_MS);
    expect(meetsFrameBar(summary)).toBe(false);
  });

  it('fails a sample that drops more than one percent of frames', () => {
    const deltas = Array.from({ length: 1000 }, (_, i) => (i < 20 ? 30 : 16));
    const summary = summarizeFrames(deltas);
    expect(summary.dropped / summary.samples).toBeGreaterThan(PASS_DROPPED_FRACTION);
    expect(meetsFrameBar(summary)).toBe(false);
  });

  it('never passes an empty sample — no data is not a pass', () => {
    expect(meetsFrameBar(summarizeFrames([]))).toBe(false);
  });
});

describe('summarizeFrames', () => {
  it('reports p50, p95, worst and dropped', () => {
    const deltas = Array.from({ length: 100 }, (_, i) => (i < 95 ? 16 : 40));
    expect(summarizeFrames(deltas)).toEqual({
      samples: 100,
      p50: 16,
      p95: 16,
      worst: 40,
      dropped: 5,
    });
  });

  it('counts a frame as dropped only when it exceeds the budget', () => {
    // The budget is 1000/60 = 16.666…ms, not 16.7. Both 16.7 and 16.8 are over it, and
    // this assertion originally said 1 because it rounded the budget in its own head —
    // the sort of off-by-a-third-of-a-millisecond that makes a pass/fail line arguable.
    expect(FRAME_BUDGET_MS).toBeGreaterThan(16.6);
    expect(FRAME_BUDGET_MS).toBeLessThan(16.7);
    expect(summarizeFrames([16.6, 16.7, 16.8]).dropped).toBe(2);
    expect(summarizeFrames([16.0, 16.6]).dropped).toBe(0);
  });

  it('discards hostile deltas rather than clamping them', () => {
    // `scene-layout.ts` carries guards for exactly these because both were observed here:
    // a non-finite first-frame delta and a timestamp source stepping backward. Clamping a
    // bogus delta to zero would quietly improve the p50 — the wrong direction for a number
    // whose only job is to be honest.
    const summary = summarizeFrames([16, Number.NaN, -5, Number.POSITIVE_INFINITY, 16]);
    expect(summary.samples).toBe(2);
    expect(summary.p50).toBe(16);
    expect(Number.isFinite(summary.worst)).toBe(true);
  });

  it('returns an all-zero summary for no samples rather than NaN', () => {
    expect(summarizeFrames([])).toEqual({ samples: 0, p50: 0, p95: 0, worst: 0, dropped: 0 });
  });

  it('handles a single sample without running off the percentile index', () => {
    expect(summarizeFrames([20])).toEqual({ samples: 1, p50: 20, p95: 20, worst: 20, dropped: 1 });
  });
});

describe('probe arming', () => {
  it('is off unless explicitly requested, so a player never pays for it', () => {
    expect(shouldProbe(new URLSearchParams(''))).toBe(false);
    expect(shouldProbe(new URLSearchParams('playtestSeed=1234'))).toBe(false);
    expect(shouldProbe(new URLSearchParams('perfProbe=0'))).toBe(false);
    expect(shouldProbe(new URLSearchParams('perfProbe=1'))).toBe(true);
  });
});
