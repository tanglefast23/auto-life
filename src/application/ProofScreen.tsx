import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Rect } from '@shopify/react-native-skia';
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
      const prior = raw === null ? 0 : Number.parseInt(raw, 10);
      const next = prior + 1;
      step(`writing ${next}…`);
      await kv.setItem('proof-counter', String(next));
      setPersistence(`persistence: prior=${prior} next=${next}`);
    })().catch((err: unknown) => {
      console.error('P0 persistence proof failed:', err);
      setPersistence(`persistence: FAILED (${err instanceof Error ? err.message : String(err)})`);
    }).finally(() => clearTimeout(timeout));
  }, []);

  return (
    <View style={styles.root}>
      <Canvas style={styles.canvas}>
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
