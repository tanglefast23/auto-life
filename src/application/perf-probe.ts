/**
 * The frame probe (SPEC §18, P6 T12).
 *
 * SPEC §18's Definition of Done says "60 fps on desktop web". Before P6 that was never
 * measured, and an audit pointed out the plan had no threshold either — two honest people
 * could disagree about whether a build passed. So the bar is numeric and stated here:
 * **p95 ≤ 16.7 ms with ≤1% dropped frames over a 600-frame sample**.
 *
 * HFM's handover §1.5 is the reason this ships *before* any optimisation: its 3× jumping
 * looked like excessive React work, measurement found interpolation retargeting was the
 * real cause, and the large React refactor that had been proposed turned out to be
 * unnecessary. Measure, then change, then measure again.
 *
 * Pure arithmetic, so the summary is unit-testable without a browser.
 */

/** One frame at 60 fps. */
export const FRAME_BUDGET_MS = 1000 / 60;

/** How many frames a counted sample takes. Ten seconds at 60 fps. */
export const SAMPLE_FRAMES = 600;

/** SPEC §18's bar, as numbers rather than adjectives. */
export const PASS_P95_MS = FRAME_BUDGET_MS;
export const PASS_DROPPED_FRACTION = 0.01;

export interface FrameSummary {
  samples: number;
  p50: number;
  p95: number;
  worst: number;
  /** Frames that exceeded the 60 fps budget. */
  dropped: number;
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[idx]!;
}

/**
 * Summarise raw frame deltas.
 *
 * Non-finite and negative deltas are **discarded, not clamped**. `scene-layout.ts` carries
 * guards for exactly these because both were observed in this app: a non-finite first-frame
 * delta, and a timestamp source stepping backward. Clamping a bogus delta to zero would
 * quietly improve the p50 and make the measurement flatter — the wrong direction for a
 * number that exists to be honest.
 */
export function summarizeFrames(deltas: readonly number[]): FrameSummary {
  const clean = deltas.filter((d) => Number.isFinite(d) && d >= 0);
  if (clean.length === 0) return { samples: 0, p50: 0, p95: 0, worst: 0, dropped: 0 };
  const sorted = [...clean].sort((a, b) => a - b);
  return {
    samples: clean.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    worst: sorted[sorted.length - 1]!,
    dropped: clean.filter((d) => d > FRAME_BUDGET_MS).length,
  };
}

/** Whether a summary meets SPEC §18's bar. */
export function meetsFrameBar(summary: FrameSummary): boolean {
  if (summary.samples === 0) return false;
  return (
    summary.p95 <= PASS_P95_MS && summary.dropped / summary.samples <= PASS_DROPPED_FRACTION
  );
}

/** `?perfProbe=1` arms the probe. Off by default, so a player never pays for it. */
export function shouldProbe(search: URLSearchParams): boolean {
  return search.get('perfProbe') === '1';
}

export interface ProbeHandle {
  stop(): FrameSummary;
}

/**
 * Sample `frames` consecutive RAF deltas and publish the summary.
 *
 * The probe deliberately does no work of its own beyond reading a timestamp: a sampler
 * that allocates per frame measures itself.
 */
export function startFrameProbe(
  frames = SAMPLE_FRAMES,
  onDone?: (summary: FrameSummary) => void,
): ProbeHandle {
  const deltas: number[] = [];
  let last: number | null = null;
  let raf = 0;
  let stopped = false;

  const tick = (now: number): void => {
    if (stopped) return;
    if (last !== null) deltas.push(now - last);
    last = now;
    if (deltas.length >= frames) {
      const summary = summarizeFrames(deltas);
      publish(summary);
      onDone?.(summary);
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop(): FrameSummary {
      stopped = true;
      cancelAnimationFrame(raf);
      const summary = summarizeFrames(deltas);
      publish(summary);
      return summary;
    },
  };
}

/** Where a headless run reads the result from. */
export const PROBE_GLOBAL = '__autoLifePerf';

function publish(summary: FrameSummary): void {
  (globalThis as Record<string, unknown>)[PROBE_GLOBAL] = {
    ...summary,
    meetsBar: meetsFrameBar(summary),
    budgetMs: FRAME_BUDGET_MS,
  };
}
