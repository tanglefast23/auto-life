import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Rect, useCanvasRef } from '@shopify/react-native-skia';
import { kv } from '../persistence/kv';

/**
 * P0 platform proof. Three claims, each able to fail honestly:
 *  1. Skia draws (terracotta rect — blank canvas = CanvasKit failure).
 *  2. The page is cross-origin isolated (SQLite-on-web's precondition).
 *  3. Persistence is real: a counter is READ before it is incremented, so an
 *     in-memory database cannot fake it. First load shows prior=0 next=1;
 *     a hard reload must show prior=1 next=2.
 */
export function ProofScreen() {
  const [persistence, setPersistence] = useState('persistence: pending…');
  const canvasRef = useCanvasRef();
  const isolated = typeof globalThis.crossOriginIsolated === 'boolean'
    ? String(globalThis.crossOriginIsolated)
    : 'n/a (native)';

  useEffect(() => {
    const step = (label: string) => setPersistence(`persistence: ${label}`);
    const timeout = setTimeout(
      () => setPersistence((p) => (p.includes('prior=') ? p : `${p} — TIMED OUT after 15s`)),
      15_000,
    );
    (async () => {
      step('reading…');
      const raw = await kv.getItem('proof-counter');
      // A corrupted stored value must surface, never silently propagate as NaN.
      const parsed = raw === null ? 0 : Number(raw);
      if (!Number.isSafeInteger(parsed)) throw new Error(`stored counter corrupt: ${JSON.stringify(raw)}`);
      const prior = parsed;
      const next = prior + 1;
      step(`writing ${next}…`);
      await kv.setItem('proof-counter', String(next));
      setPersistence(`persistence: prior=${prior} next=${next}`);
    })().catch((err: unknown) => {
      console.error('P0 persistence proof failed:', err);
      setPersistence(`persistence: FAILED (${err instanceof Error ? err.message : String(err)})`);
    }).finally(() => clearTimeout(timeout));
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // Evidence hook (web only): on-demand pixel capture of the live canvas.
    // Skia 2.6.2's makeImageSnapshot(/Async) does not work against the web surface,
    // so this forces a redraw and copies the WebGL buffer in the SAME frame — the
    // one timing at which a non-preserved buffer is readable. (The first committed
    // "proof" PNG was a blank cross-frame toDataURL; this exists so that can't recur.)
    const g = globalThis as Record<string, unknown>;
    g.__captureProofPng = () =>
      new Promise<string>((resolve, reject) => {
        canvasRef.current?.redraw();
        requestAnimationFrame(() => {
          try {
            const src = document.querySelector('canvas');
            if (!src) throw new Error('no canvas element');
            const copy = document.createElement('canvas');
            copy.width = src.width;
            copy.height = src.height;
            const ctx = copy.getContext('2d');
            if (!ctx) throw new Error('no 2d context');
            ctx.drawImage(src, 0, 0);
            resolve(copy.toDataURL('image/png'));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      });
    return () => {
      delete g.__captureProofPng;
    };
  }, [canvasRef]);

  return (
    <View style={styles.root}>
      <Canvas ref={canvasRef} style={styles.canvas}>
        <Rect x={16} y={16} width={96} height={96} color="#bc6b42" />
      </Canvas>
      <Text style={styles.line} testID="isolation-proof">{`crossOriginIsolated: ${isolated}`}</Text>
      <Text style={styles.line} testID="persist-proof">{persistence}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2e4c2', gap: 8 },
  canvas: { width: 128, height: 128 },
  line: { fontFamily: 'monospace', fontSize: 14, color: '#2e2119' },
});
