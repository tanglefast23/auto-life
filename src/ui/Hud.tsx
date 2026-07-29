import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { content } from '../sim/content';
import type { SimSnapshot } from '../sim/step';
import type { Speed } from '../application/loop';
import { SPEEDS } from '../application/loop';
import { BAR_COLOR, BAR_ICON, BAR_ORDER, bandFor, type BandName } from './bands';
import { formatClock } from './clock-format';

/**
 * The HUD (SPEC §11.1, P3 T7).
 *
 * §11.1 caps the permanent HUD *forever* at Health block · Funds · Connection ·
 * clock/speed, because a round-2 audit projected 12+ permanent elements by v5 without
 * the rule. Funds and Connection do not exist yet (v2/v3), so P3 ships the Health block,
 * the clock block, and the Practice counter §11.1 places beneath the health block.
 * Nothing else goes here.
 *
 * Plain StyleSheet, not NativeWind: the master's chosen stack omits NativeWind, and a
 * few bars do not justify adding a Tailwind step to the web export path P0 stabilised
 * (recorded as a deviation from SPEC §3 with P4 as owner).
 */

const CREAM_BASE = '#f2e4c2';
const CREAM_LIGHT = '#faf1dc';
const CREAM_SHADOW = '#d9c493';
const INK = '#2e2119';
const RED = '#c8402e';
const GOLD = '#f0a840';

export interface HudProps {
  snapshot: SimSnapshot | null;
  speed: Speed;
  onSpeed: (speed: Speed) => void;
}

/**
 * A bar trough with its band rendered, not just computed.
 *
 * design.md §8: the 40–69 band adds a **cream-shadow edge tick** and the alert band adds
 * a red edge pulse. Adversarial pass 2 caught that the first version computed the band
 * and then threw the tick away — bars sitting in the middle band looked completely
 * normal, so the one warning before a crisis was invisible.
 */
function Bar({
  value,
  color,
  width,
  height,
  band,
  pulseOpacity,
}: {
  value: number;
  color: string;
  width: number;
  height: number;
  band: BandName;
  pulseOpacity?: Animated.Value;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <View style={[styles.trough, { width, height }, band === 'alert' && styles.troughAlert]}>
      <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: color }} />
      {band === 'tick' && <View style={styles.edgeTick} />}
      {band === 'alert' && pulseOpacity !== undefined && (
        <Animated.View style={[styles.alertPulse, { opacity: pulseOpacity }]} />
      )}
    </View>
  );
}

export function Hud({ snapshot, speed, onSpeed }: HudProps) {
  const health = snapshot?.health ?? 0;

  // design.md §8 says the alert state PULSES. One shared driver for every bar, so the
  // animation cost is constant regardless of how many bars are in crisis.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Top-left: Health block (§11.1) */}
      <View style={styles.block}>
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>HEALTH</Text>
          <Text style={styles.healthValue}>{Math.round(health)}</Text>
        </View>
        <Bar value={health} color={INK} width={168} height={10} band="normal" />

        {BAR_ORDER.map((bar) => {
          const value = snapshot?.bars[bar] ?? 0;
          const style = bandFor(bar, value, content.rates);
          const icon = style.alertGlyph ? BAR_ICON[bar].alert : BAR_ICON[bar].normal;
          return (
            <View key={bar} style={styles.subRow}>
              <Text
                style={[styles.icon, style.band === 'alert' && styles.iconAlert]}
                accessibilityLabel={`${BAR_ICON[bar].label} ${Math.round(value)} of 100, ${style.band}`}
              >
                {icon}
              </Text>
              <Bar
                value={value}
                color={BAR_COLOR[bar]}
                width={120}
                height={6}
                band={style.band}
                pulseOpacity={pulse}
              />
              <Text style={styles.subValue}>{Math.round(value)}</Text>
            </View>
          );
        })}

        {/* §11.1 places the Practice counter beneath the health block. */}
        <Text style={styles.practice}>{`practice ${(snapshot?.practicePoints ?? 0).toFixed(0)}`}</Text>
      </View>

      {/* Top-right: clock block + speed controls (§11.1) */}
      <View style={[styles.block, styles.clockBlock]}>
        <Text style={styles.clock} testID="hud-clock">
          {snapshot === null ? 'Day — · — · --:--' : formatClock(snapshot.day, snapshot.minuteOfDay)}
        </Text>
        <View style={styles.speedRow}>
          {SPEEDS.map((s) => (
            <Pressable
              key={s}
              onPress={() => onSpeed(s)}
              accessibilityRole="button"
              accessibilityLabel={s === 0 ? 'Pause' : `Speed ${s} times`}
              accessibilityState={{ selected: speed === s }}
              testID={`speed-${s}`}
              style={[styles.speedBtn, speed === s && styles.speedBtnActive]}
            >
              <Text style={[styles.speedText, speed === s && styles.speedTextActive]}>{s === 0 ? '❚❚' : `${s}×`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  // design.md §3 Track A: thick Ink outline, cream face, cream-shadow bottom lip.
  block: {
    backgroundColor: CREAM_BASE,
    borderWidth: 2,
    borderColor: INK,
    borderBottomWidth: 4,
    borderRadius: 4,
    padding: 8,
    gap: 4,
  },
  clockBlock: { alignItems: 'flex-end' },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', width: 168 },
  healthLabel: { fontFamily: 'monospace', fontSize: 10, color: INK, letterSpacing: 1 },
  healthValue: { fontFamily: 'monospace', fontSize: 16, color: INK, fontVariant: ['tabular-nums'] },
  trough: {
    backgroundColor: CREAM_SHADOW,
    borderWidth: 1,
    borderColor: INK,
    overflow: 'hidden',
  },
  troughAlert: { borderColor: RED },
  // design.md §8: the middle band is a cream-shadow EDGE TICK, not a colour change.
  edgeTick: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: CREAM_SHADOW },
  alertPulse: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 1, borderColor: RED },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontFamily: 'monospace', fontSize: 12, color: INK, width: 14, textAlign: 'center' },
  iconAlert: { color: RED },
  subValue: { fontFamily: 'monospace', fontSize: 10, color: INK, width: 24, textAlign: 'right', fontVariant: ['tabular-nums'] },
  practice: { fontFamily: 'monospace', fontSize: 10, color: GOLD, marginTop: 2 },
  clock: { fontFamily: 'monospace', fontSize: 13, color: INK, fontVariant: ['tabular-nums'] },
  speedRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  speedBtn: {
    minWidth: 34,
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 3,
  },
  speedBtnActive: { backgroundColor: INK },
  speedText: { fontFamily: 'monospace', fontSize: 11, color: INK },
  speedTextActive: { color: CREAM_LIGHT },
});
