import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { content } from '../sim/content';
import type { SimSnapshot } from '../sim/step';
import type { Speed } from '../application/loop';
import { SPEEDS } from '../application/loop';
import { BAR_COLOR, BAR_ICON, BAR_ORDER, bandFor, bandForDefault, type BandName } from './bands';
import { formatClock } from './clock-format';
import { practiceLevel } from '../sim/practice-level';
import { fillGoalCopy, goalStrings } from './goal-copy';
import { settingsStrings } from './settings-copy';
import { FONT, scaledType, TABULAR, TYPE_SCALE, theme } from './theme';

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

const CREAM_BASE = theme.color.creamBase;
const CREAM_LIGHT = theme.color.creamLight;
const CREAM_SHADOW = theme.color.creamShadow;
const INK = theme.color.ink;
const RED = theme.color.red;
const GOLD = theme.color.gold;

export interface HudProps {
  snapshot: SimSnapshot | null;
  speed: Speed;
  onSpeed: (speed: Speed) => void;
  onOpenPause?: () => void;
  onToggleMute?: () => void;
  muted?: boolean;
  reducedMotion?: boolean;
  nonColorUrgency?: boolean;
  screenReaderVerbosity?: 'brief' | 'full';
  /**
   * The player's HUD text-size preference (0.75–1.5), applied to actual font sizes.
   *
   * P5 added the setting and P6 wrote `scaledType`, but nothing joined them: `GameScreen`
   * multiplied the *reserved height* by this number and left every size alone, so the
   * slider moved the layout and not one glyph. That is the defect this prop closes.
   */
  textScale?: number;
}

/**
 * The scale-dependent half of the HUD's type.
 *
 * Split from `StyleSheet.create` because a StyleSheet is created once at module load and
 * therefore cannot answer to a runtime preference — which is the structural reason the
 * setting was inert. Layout stays in the sheet; anything the slider moves lives here.
 */
function hudType(scale: number) {
  return {
    label: { ...scaledType('caption', scale), letterSpacing: 1 },
    value: { ...scaledType('body', scale), ...TABULAR },
    subValue: { ...scaledType('body', scale), ...TABULAR },
    caption: scaledType('caption', scale),
    icon: scaledType('body', scale),
    action: scaledType('body', scale),
  } as const;
}

const SCALABLE_TEXT = {
  allowFontScaling: true,
  maxFontSizeMultiplier: 2,
} as const;

function accessibleBandName(band: BandName): string {
  return band === 'tick' ? 'warning' : band;
}

function briefValueLabel(
  label: string,
  value: number,
  band: BandName,
): string {
  const base = `${label} ${Math.round(value)}`;
  return band === 'normal'
    ? base
    : `${base}, ${accessibleBandName(band)}`;
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

export function Hud({
  snapshot,
  speed,
  onSpeed,
  onOpenPause,
  onToggleMute,
  muted = false,
  reducedMotion = false,
  nonColorUrgency = true,
  screenReaderVerbosity = 'brief',
  textScale = 1,
}: HudProps) {
  const type = useMemo(() => hudType(textScale), [textScale]);
  const health = snapshot?.health ?? 0;
  const healthBand = bandForDefault(health, content.rates).band;
  const practicePoints = snapshot?.practicePoints ?? 0;
  const currentPracticeLevel = practiceLevel(
    Math.round(practicePoints * 100),
    content.practice.levels,
  );

  // design.md §8 says the alert state PULSES. One shared driver for every bar, so the
  // animation cost is constant regardless of how many bars are in crisis.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }
    // react-native-web has no RCTAnimation module, so useNativeDriver:true logged a
    // warning on every mount and silently fell back to JS anyway (adversarial pass 3).
    // Desktop web is the v1 target; ask for the native driver only where it exists.
    const useNativeDriver = Platform.OS !== 'web';
    const step = (toValue: number) =>
      Animated.timing(pulse, { toValue, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver });
    const loop = Animated.loop(Animated.sequence([step(0.25), step(1)]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);
  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Top-left: Health block (§11.1) */}
      <View style={styles.block}>
        <View style={styles.healthRow}>
          <Text {...SCALABLE_TEXT} style={[styles.healthLabel, type.label]}>HEALTH</Text>
          <Text
            {...SCALABLE_TEXT}
            accessible
            accessibilityLabel={
              screenReaderVerbosity === 'full'
                ? `Health ${Math.round(health)} of 100, ${accessibleBandName(healthBand)}`
                : briefValueLabel('Health', health, healthBand)
            }
            testID="hud-health-value"
            style={[styles.healthValue, type.value]}
          >
            {Math.round(health)}
          </Text>
        </View>
        {/* Health is a composite with no BarId, so it names the default bands directly.
            It was pinned to "normal" (a Day-1 Health of ~60 never showed the 40–69
            warning), then briefly borrowed Nutrition's — which would break silently the
            day Nutrition gains an override of its own. */}
        <Bar
          value={health}
          color={INK}
          width={168}
          height={10}
          band={healthBand}
          pulseOpacity={pulse}
        />

        {BAR_ORDER.map((bar) => {
          const value = snapshot?.bars[bar] ?? 0;
          const style = bandFor(bar, value, content.rates);
          const icon =
            nonColorUrgency && style.alertGlyph
              ? BAR_ICON[bar].alert
              : BAR_ICON[bar].normal;
          return (
            <View key={bar} style={styles.subRow}>
              <Text
                {...SCALABLE_TEXT}
                accessible
                style={[styles.icon, type.icon, style.band === 'alert' && styles.iconAlert]}
                accessibilityLabel={
                  screenReaderVerbosity === 'full'
                    ? `${BAR_ICON[bar].label} ${Math.round(value)} of 100, ${accessibleBandName(style.band)}`
                    : briefValueLabel(
                        BAR_ICON[bar].label,
                        value,
                        style.band,
                      )
                }
                testID={`hud-bar:${bar}`}
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
              <Text {...SCALABLE_TEXT} style={[styles.subValue, type.subValue]}>{Math.round(value)}</Text>
            </View>
          );
        })}

        {/* §11.1 places the Practice counter beneath the health block. */}
        <Text
          {...SCALABLE_TEXT}
          accessible
          accessibilityLabel={fillGoalCopy(
            goalStrings.ui.practiceAccessibility,
            {
              level: currentPracticeLevel,
              points: practicePoints.toFixed(0),
            },
          )}
          testID="hud-practice"
          style={[styles.practice, type.caption]}
        >
          {fillGoalCopy(goalStrings.ui.practiceSummary, {
            level: currentPracticeLevel,
            points: practicePoints.toFixed(0),
          })}
        </Text>
      </View>

      {/* Top-right: clock block + speed controls (§11.1) */}
      <View
        style={[styles.block, styles.clockBlock]}
        testID="hud-clock-block"
      >
        <Text
          {...SCALABLE_TEXT}
          accessible
          accessibilityLabel={snapshot === null ? 'Game clock unavailable' : formatClock(snapshot.day, snapshot.minuteOfDay)}
          style={[styles.clock, type.value]}
          testID="hud-clock"
        >
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
              <Text {...SCALABLE_TEXT} style={[styles.speedText, type.action, speed === s && styles.speedTextActive]}>{s === 0 ? '❚❚' : `${s}×`}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.metaRow} testID="hud-meta-controls">
          <Pressable
            accessibilityLabel={settingsStrings.pause.open}
            accessibilityRole="button"
            onPress={onOpenPause}
            style={styles.metaButton}
            testID="open-pause-menu"
          >
            {/* `type` first: the sheet's pixelBold must win over the step's regular face. */}
            <Text {...SCALABLE_TEXT} style={[type.action, styles.metaButtonText]}>
              ⚙
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={
              muted
                ? settingsStrings.settings.audio.unmuted
                : settingsStrings.settings.audio.mute
            }
            accessibilityRole="button"
            onPress={onToggleMute}
            style={styles.metaButton}
            testID="toggle-mute"
          >
            {/* `type` first: the sheet's pixelBold must win over the step's regular face. */}
            <Text {...SCALABLE_TEXT} style={[type.action, styles.metaButtonText]}>
              {muted ? '🔇' : '♪'}
            </Text>
          </Pressable>
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
  // Size and family for every entry below come from `hudType(textScale)`, so the
  // preference has exactly one owner. Colour and geometry stay here.
  healthLabel: { color: INK },
  healthValue: { color: INK },
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
  icon: { color: INK, width: 16, textAlign: 'center' },
  iconAlert: { color: RED },
  // 32, not the old 24: at 8px a three-digit value was 12px wide, at 16px it is 24px and
  // grows further with the scale preference. 24 would have clipped "100" the moment the
  // type became readable.
  subValue: { color: INK, width: 32, textAlign: 'right' },
  practice: { color: GOLD, marginTop: 4 },
  clock: { color: INK },
  speedRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  metaRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  speedBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM_LIGHT,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 3,
  },
  speedBtnActive: { backgroundColor: INK },
  speedText: { color: INK },
  speedTextActive: { color: CREAM_LIGHT },
  metaButton: {
    alignItems: 'center',
    backgroundColor: CREAM_LIGHT,
    borderColor: INK,
    borderRadius: 3,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  metaButtonText: { color: INK, fontFamily: FONT.pixelBold },
});
