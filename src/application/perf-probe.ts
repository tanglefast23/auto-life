/**
 * The frame probe (SPEC §18, P6 T12).
 *
 * SPEC §18's Definition of Done says "60 fps on desktop web". Before P6 that was never
 * measured, and an audit pointed out the plan had no threshold either — two honest people
 * could disagree about whether a build passed. So the bar is numeric and stated here:
 * **p95 within 5% of the display's own frame period, with ≤1% dropped frames over a
 * 600-frame sample**.
 *
 * That phrasing is deliberate, and it is the second version of this file's bar.
 *
 * The first version counted a frame dropped at `delta > 1000/60` and required
 * `p95 ≤ 1000/60`. Both compare a **vsync-paced cadence** against an **exact** 16.666…ms,
 * and on a real 60 Hz panel vsync deltas centre on ~16.67 ms (16.68 on a 59.94 Hz panel) —
 * so a flawless run failed both conditions and roughly half its frames counted as dropped.
 * The recorded T12 PASS (p50 8.34 ms) is only producible on a ~120 Hz display, which means
 * that run measured the dev machine's ProMotion refresh rate rather than this app, and the
 * confirming run SPEC §18 owes on a 60 Hz MacBook Air could never have passed however fast
 * the app was. A measurement instrument that cannot return PASS on the target hardware is
 * worse than no measurement, because it reads as a real result.
 *
 * So the period is derived from the sample instead of assumed — **and capped at the 60 fps
 * budget**, which is the half of this that matters. Without the cap, an app rendering at a
 * steady 30 fps would report a 33 ms median, adopt 33 ms as "one frame", and pass itself:
 * a self-grading bar. With the cap, a 60 Hz panel is judged against 16.67 ms, a 120 Hz
 * panel against 8.33 ms, and a 30 fps app fails on both.
 *
 * A consequence worth stating rather than discovering later: a build holding a steady 60 fps
 * on a 120 Hz display passes, because SPEC §18 asks for 60 fps and that is 60 fps. If the
 * bar should instead be "never miss this display's vsync", it is the cap that changes.
 *
 * HFM's handover §1.5 is the reason this ships *before* any optimisation: its 3× jumping
 * looked like excessive React work, measurement found interpolation retargeting was the
 * real cause, and the large React refactor that had been proposed turned out to be
 * unnecessary. Measure, then change, then measure again.
 *
 * Pure arithmetic, so the summary is unit-testable without a browser.
 */

/** One frame at 60 fps — the ceiling on the derived period, not the comparison itself. */
export const FRAME_BUDGET_MS = 1000 / 60;

/** How many frames a counted sample takes. Ten seconds at 60 fps. */
export const SAMPLE_FRAMES = 600;

/**
 * How far past the period a frame must land before it counts as dropped.
 *
 * A missed vsync arrives at 2× the period, so the threshold sits at the midpoint: jitter
 * inside one period is not a drop, and a genuinely missed frame always is.
 */
export const DROPPED_PERIOD_MULTIPLE = 1.5;

/** Jitter allowance for p95 against the display's own period. */
export const PASS_P95_PERIOD_MULTIPLE = 1.05;

export const PASS_DROPPED_FRACTION = 0.01;

export interface FrameSummary {
  samples: number;
  p50: number;
  p95: number;
  worst: number;
  /** Frames that missed enough of a vsync to be visible. */
  dropped: number;
  /**
   * The frame period this sample is judged against: the sample's own median, capped at the
   * 60 fps budget. Published so a run's evidence records which display it measured.
   */
  periodMs: number;
}

/**
 * The display's frame period, inferred from the sample.
 *
 * The median rather than the mean, because a handful of long frames is exactly what this
 * function must stay robust to — averaging them in would inflate the period and forgive
 * the stalls it exists to catch.
 */
export function displayPeriodMs(medianDelta: number): number {
  if (!Number.isFinite(medianDelta) || medianDelta <= 0) return FRAME_BUDGET_MS;
  return Math.min(FRAME_BUDGET_MS, medianDelta);
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
  if (clean.length === 0) {
    return { samples: 0, p50: 0, p95: 0, worst: 0, dropped: 0, periodMs: 0 };
  }
  const sorted = [...clean].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const periodMs = displayPeriodMs(p50);
  return {
    samples: clean.length,
    p50,
    p95: percentile(sorted, 0.95),
    worst: sorted[sorted.length - 1]!,
    dropped: clean.filter((d) => d > periodMs * DROPPED_PERIOD_MULTIPLE).length,
    periodMs,
  };
}

/** Whether a summary meets SPEC §18's bar. */
export function meetsFrameBar(summary: FrameSummary): boolean {
  if (summary.samples === 0) return false;
  return (
    summary.p95 <= summary.periodMs * PASS_P95_PERIOD_MULTIPLE &&
    summary.dropped / summary.samples <= PASS_DROPPED_FRACTION
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
