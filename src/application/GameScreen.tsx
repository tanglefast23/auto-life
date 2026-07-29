import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useGameStore } from './game-store';
import { WorldScene } from '../render/WorldScene';
import { solveScale, HUD_H, QUEUE_H } from '../render/scale';
import { Hud } from '../ui/Hud';

/**
 * P3's screen: the composition root's view (master §4).
 *
 * Drives the loop from a single requestAnimationFrame, hard-pauses on backgrounding
 * (SPEC §5, C1), and lays the world out per §11.5's desktop scaling rule.
 *
 * There is deliberately no queue, no input beyond pause/speed, and no persistence —
 * all P4/P5 (see the P3 plan's "what P3 deliberately does not do").
 */
export function GameScreen() {
  const snapshot = useGameStore((s) => s.snapshot);
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const setSystemPaused = useGameStore((s) => s.setSystemPaused);
  const loop = useGameStore((s) => s.loop);
  const alpha = useGameStore((s) => s.alpha);

  const { width, height } = useWindowDimensions();
  const dpr = typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1;
  const fit = useMemo(() => solveScale({ width, height, devicePixelRatio: dpr }), [width, height, dpr]);

  // The one clock in the app. Everything else is handed elapsed milliseconds.
  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    const frame = (now: number) => {
      const delta = last === null ? 0 : now - last;
      last = now;
      loop.advance(delta);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [loop]);

  // SPEC §5 / C1: no time passes while the tab is hidden.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onVisibility = () => setSystemPaused(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [setSystemPaused]);

  const view = snapshot?.render ?? null;

  return (
    <View style={styles.root}>
      <View style={[styles.stage, { height: fit.available.height, marginTop: HUD_H, marginBottom: QUEUE_H }]}>
        <Canvas style={{ width: fit.width, height: fit.height }}>
          {view !== null && <WorldScene view={view} alphaRef={alpha} scale={fit.scale} />}
        </Canvas>
      </View>
      <Hud snapshot={snapshot} speed={speed} onSpeed={setSpeed} />
      <ScaleReadout fit={fit} dpr={dpr} />
    </View>
  );
}

/**
 * P3 evidence readout (master §5 asks for "desktop frame/scaling evidence recorded").
 * Shows the scale actually chosen and the measured frame rate, so the evidence is read
 * off the running build rather than asserted. Removed when the queue strip lands in P4.
 */
function ScaleReadout({ fit, dpr }: { fit: ReturnType<typeof solveScale>; dpr: number }) {
  const ticksRun = useGameStore((s) => s.ticksRun);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let raf = 0;
    let start = 0;
    const count = (now: number) => {
      if (start === 0) start = now;
      frames += 1;
      if (now - start >= 1000) {
        setFps(Math.round((frames * 1000) / (now - start)));
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(count);
    };
    raf = requestAnimationFrame(count);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <View style={styles.readout} pointerEvents="none">
      <Text style={styles.readoutText}>
        {`scale ${fit.scale}× · dpr ${dpr} · ${fit.physicalPerArtPixel} phys px/art px · ${fit.exact ? 'exact' : 'INEXACT'}${fit.tooSmall ? ' · TOO SMALL' : ''}`}
      </Text>
      <Text style={styles.readoutText}>{`${fps} fps · ${ticksRun} ticks`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2e2119', alignItems: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center' },
  readout: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#f2e4c2',
    borderWidth: 2,
    borderColor: '#2e2119',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  readoutText: { fontFamily: 'monospace', fontSize: 10, color: '#2e2119' },
});
