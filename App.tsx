import { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Silkscreen_400Regular, Silkscreen_700Bold, useFonts } from '@expo-google-fonts/silkscreen';
import { ApplicationRoot } from './src/application/ApplicationRoot';
import { shouldProbe, startFrameProbe } from './src/application/perf-probe';
import {
  FixedSeedSource,
  playtestSeedFromSearch,
  type SeedSource,
} from './src/application/new-career';

function playtestSeedSource(): SeedSource | undefined {
  if (typeof globalThis.location === 'undefined') return undefined;
  const seed = playtestSeedFromSearch(globalThis.location.search);
  return seed === null ? undefined : new FixedSeedSource(seed);
}

export default function App() {
  const seedSource = useMemo(playtestSeedSource, []);

  /**
   * design.md §4's house face, loaded as **two real files** (P6 T7).
   *
   * Both weights ship rather than one plus synthetic bold: HFM's handover
   * (docs/lessons-from-hero-football-manager.md §2.5) records synthetic bold smearing a
   * bitmap face's pixel grid, and design.md §13 lists anti-aliased pixel type as an
   * instant reject.
   *
   * The shell renders regardless of `loaded`. A font that has not arrived yet falls back
   * to the platform face for a frame, which is a cosmetic wobble — blocking the whole app
   * on it would be the same mistake as blocking it on CanvasKit (HFM §1.4).
   */
  const [, fontError] = useFonts({ Silkscreen_400Regular, Silkscreen_700Bold });
  if (fontError) {
    // Loud, because a silent fallback to a system face is precisely what HFM shipped by
    // accident across half its UI before anyone noticed.
    console.error('Silkscreen failed to load; falling back to the platform face:', fontError);
  }

  /**
   * `?perfProbe=1` samples 600 RAF deltas and publishes the summary for a headless run to
   * read. Armed here rather than inside the renderer so it measures the whole frame, and
   * off by default so a player never pays for it (P6 T12).
   */
  useEffect(() => {
    if (typeof globalThis.location === 'undefined') return;
    if (!shouldProbe(new URLSearchParams(globalThis.location.search))) return;
    const probe = startFrameProbe();
    return () => void probe.stop();
  }, []);

  return (
    <>
      <ApplicationRoot seedSource={seedSource} />
      <StatusBar style="auto" />
    </>
  );
}
