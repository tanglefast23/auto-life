import {
  DROPPED_PERIOD_MULTIPLE,
  FRAME_BUDGET_MS,
  PASS_DROPPED_FRACTION,
  displayPeriodMs,
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
 *
 * The bar was re-derived after a later audit: the first version compared vsync-paced deltas
 * against an exact 16.666…ms, which no 60 Hz display can beat, so the DoD run this file
 * exists to adjudicate could only ever pass on a 120 Hz machine. The two tests that pin the
 * present rule are "a flawless 60 Hz sample passes" and "a 30 fps sample cannot pass itself".
 */

describe('the bar SPEC §18 sets', () => {
  it('uses the 60 fps budget as the ceiling on the derived period', () => {
    expect(FRAME_BUDGET_MS).toBeCloseTo(1000 / 60, 6);
  });

  it('passes a clean sample', () => {
    const summary = summarizeFrames(Array.from({ length: 600 }, () => 16));
    expect(meetsFrameBar(summary)).toBe(true);
  });

  it('passes a flawless 60 Hz panel, whose deltas centre just OVER 1000/60', () => {
    // The regression this whole rewrite exists for. Vsync on a 60 Hz panel lands at
    // ~16.67ms and on a 59.94 Hz panel at ~16.68 — both above 16.666…, so the old bar
    // scored a perfect run as ~100% dropped frames and a p95 miss.
    const vsync = Array.from({ length: 600 }, (_, i) => 16.67 + (i % 3) * 0.01);
    const summary = summarizeFrames(vsync);
    expect(summary.dropped).toBe(0);
    expect(meetsFrameBar(summary)).toBe(true);
  });

  it('passes a flawless 120 Hz panel too, judged against its own period', () => {
    const summary = summarizeFrames(Array.from({ length: 600 }, () => 8.34));
    expect(summary.periodMs).toBeCloseTo(8.34, 6);
    expect(meetsFrameBar(summary)).toBe(true);
  });

  it('cannot be gamed by a slow app redefining what a frame is', () => {
    // A steady 30 fps has a 33ms median. Deriving the period from the sample WITHOUT the
    // 60 fps cap would adopt 33ms as "one frame" and grade the app against itself.
    const summary = summarizeFrames(Array.from({ length: 600 }, () => 33.3));
    expect(summary.periodMs).toBeCloseTo(FRAME_BUDGET_MS, 6);
    expect(meetsFrameBar(summary)).toBe(false);
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
  it('reports p50, p95, worst, dropped and the period it judged against', () => {
    const deltas = Array.from({ length: 100 }, (_, i) => (i < 95 ? 16 : 40));
    expect(summarizeFrames(deltas)).toEqual({
      samples: 100,
      p50: 16,
      p95: 16,
      worst: 40,
      dropped: 5,
      periodMs: 16,
    });
  });

  it('counts a frame as dropped only once it has missed enough of a vsync to be seen', () => {
    // A missed vsync arrives at 2× the period, so the line sits at the midpoint. Jitter
    // inside one period is not a drop: 16.7 and 16.8 on a 16.67ms panel are the display
    // working, and the previous rule scored them as two dropped frames out of three.
    const jitter = summarizeFrames([16.6, 16.7, 16.8]);
    expect(jitter.periodMs).toBeCloseTo(16.666, 2);
    expect(jitter.dropped).toBe(0);
    // One frame at 2× the period is a real drop and still counts as one.
    expect(summarizeFrames([16.6, 16.7, 33.4]).dropped).toBe(1);
  });

  it('derives the period from the median, capped at the 60 fps budget', () => {
    expect(displayPeriodMs(8.34)).toBeCloseTo(8.34, 6);
    expect(displayPeriodMs(16.7)).toBeCloseTo(FRAME_BUDGET_MS, 6);
    expect(displayPeriodMs(33.3)).toBeCloseTo(FRAME_BUDGET_MS, 6);
    // A broken clock must not produce a zero period and call every frame a drop.
    expect(displayPeriodMs(0)).toBeCloseTo(FRAME_BUDGET_MS, 6);
    expect(displayPeriodMs(Number.NaN)).toBeCloseTo(FRAME_BUDGET_MS, 6);
    expect(DROPPED_PERIOD_MULTIPLE).toBe(1.5);
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
    expect(summarizeFrames([])).toEqual({
      samples: 0,
      p50: 0,
      p95: 0,
      worst: 0,
      dropped: 0,
      periodMs: 0,
    });
  });

  it('handles a single sample without running off the percentile index', () => {
    const summary = summarizeFrames([20]);
    expect(summary).toEqual({
      samples: 1,
      p50: 20,
      p95: 20,
      worst: 20,
      dropped: 0,
      periodMs: FRAME_BUDGET_MS,
    });
    // 20ms is jitter rather than a missed vsync, so it is not a dropped frame — but it is
    // still over budget, and the p95 half of the bar is what catches it.
    expect(meetsFrameBar(summary)).toBe(false);
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
