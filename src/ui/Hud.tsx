import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { content } from '../sim/content';
import type { SimSnapshot } from '../sim/step';
import type { BarId } from '../sim/types';
import type { Speed } from '../application/loop';
import { SPEEDS } from '../application/loop';
import { BAR_COLOR, BAR_ICON, BAR_ORDER, BAR_TIP, bandFor, bandForDefault, type BandName } from './bands';
import { formatClock } from './clock-format';
import { MOTION, resolveMotion } from '../render/motion';
import { practiceLevel } from '../sim/practice-level';
import { fillGoalCopy, goalStrings } from './goal-copy';
import { settingsStrings } from './settings-copy';
import { CHROME, FONT, scaledType, TABULAR, TYPE_SCALE, theme } from './theme';

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
   * The effective "HUD text size" preference (§11.6), already combined with the OS font
   * scale by `GameScreen`. It is the SAME number that reserves the HUD's height, so the
   * type and the box it lives in can never disagree.
   *
   * `allowFontScaling` below covers the OS setting on native and does nothing at all on
   * react-native-web — which is the v1 target — so without this the slider only ever
   * shrank the world and left every glyph exactly where it was (audit finding).
   */
  textScale?: number;
}

/**
 * The scale-dependent half of the HUD's type and geometry.
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
    /** The meta buttons carry the bold face; the step supplies size, not weight. */
    actionBold: { ...scaledType('body', scale), fontFamily: FONT.pixelBold },
    // Bases are the P7 sizes, not the pre-P7 ones: the icon column and value column
    // widened from 14/24 when their text stopped being 8px.
    healthWidth: scaledWidth(168, scale),
    barWidth: scaledWidth(120, scale),
    iconWidth: scaledWidth(16, scale),
    valueWidth: scaledWidth(32, scale),
  } as const;
}

const SCALABLE_TEXT = {
  allowFontScaling: true,
  maxFontSizeMultiplier: 2,
} as const;

/**
 * Fixed widths that hold scaled text. Scaling the type without these clips the glyphs
 * against a 1× box; `crispSize` already snaps the type to the legal 8 px steps, so these
 * round to 4 to stay on Joe's spacing grid.
 */
function scaledWidth(base: number, scale: number): number {
  const wanted = base * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  return Math.round(wanted / 4) * 4;
}

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
  // One recipe per Track-A step, so a size change lands on every HUD string at once
  // instead of fourteen places drifting apart again (design.md §4 caps the scale at four).
  const type = useMemo(() => hudType(textScale), [textScale]);
  // One tip at a time: four stacked panels would cover the sim, and the rows are 6px
  // apart, so a hover moving down the block would otherwise leave a trail open.
  const [openTip, setOpenTip] = useState<BarId | null>(null);
  const health = snapshot?.health ?? 0;
  const healthBand = bandForDefault(health, content.rates).band;
  const practicePoints = snapshot?.practicePoints ?? 0;
  const currentPracticeLevel = practiceLevel(
    Math.round(practicePoints * 100),
    content.practice.levels,
  );

  // design.md §8 says the alert state PULSES. One shared driver for every bar, so the
  // animation cost is constant regardless of how many bars are in crisis.
  //
  // Timed by `MOTION.urgentPulse`, not by a local number. This ran at a hand-written 500 ms
  // while `QueueStrip` ran the same §11.6 urgency signal off the table's 700 ms — the same
  // crisis pulsing at two tempos on two surfaces — and it re-derived the reduced-motion
  // rule with its own `if`, which is exactly how half a set of animations quietly stops
  // obeying the setting. `motion.test.ts` could not catch either, because a file that never
  // names `MOTION` is invisible to a gate that looks for `MOTION.`.
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseMs = resolveMotion(MOTION.urgentPulse, { reducedMotion }).durationMs;
  useEffect(() => {
    if (pulseMs === 0) {
      pulse.setValue(1);
      return;
    }
    // react-native-web has no RCTAnimation module, so useNativeDriver:true logged a
    // warning on every mount and silently fell back to JS anyway (adversarial pass 3).
    // Desktop web is the v1 target; ask for the native driver only where it exists.
    const useNativeDriver = Platform.OS !== 'web';
    const step = (toValue: number) =>
      Animated.timing(pulse, { toValue, duration: pulseMs, easing: Easing.inOut(Easing.ease), useNativeDriver });
    const loop = Animated.loop(Animated.sequence([step(0.25), step(1)]));
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseMs]);
  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Top-left: Health block (§11.1) */}
      <View style={styles.block}>
        <View style={[styles.healthRow, { width: type.healthWidth }]}>
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
          width={type.healthWidth}
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
            // The row that owns the open tip is lifted as a whole. The tip's own zIndex
            // only orders it inside this wrapper, so without this the Practice counter
            // and the row below — both later siblings — painted straight through it.
            <View key={bar} style={openTip === bar ? styles.barRowRaised : undefined}>
            <Pressable
              onPress={() => setOpenTip((open) => (open === bar ? null : bar))}
              onHoverIn={() => setOpenTip(bar)}
              onHoverOut={() => setOpenTip((open) => (open === bar ? null : open))}
              // The row already carries the bar's value in its own accessibility label,
              // and a screen reader gets the description from `accessibilityHint` — so the
              // press target must not announce itself as a second, nameless control.
              accessibilityRole="button"
              accessibilityLabel={`${BAR_ICON[bar].label} details`}
              accessibilityHint={BAR_TIP[bar]}
              testID={`hud-bar-tip-toggle:${bar}`}
              style={styles.subRow}
            >
              <Text
                {...SCALABLE_TEXT}
                accessible
                style={[
                  styles.icon,
                  type.icon,
                  { width: type.iconWidth },
                  style.band === 'alert' && styles.iconAlert,
                ]}
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
                width={type.barWidth}
                height={6}
                band={style.band}
                pulseOpacity={pulse}
              />
              <Text
                {...SCALABLE_TEXT}
                style={[styles.subValue, type.subValue, { width: type.valueWidth }]}
              >
                {Math.round(value)}
              </Text>
            </Pressable>
            {openTip === bar && (
              <View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no"
                testID={`hud-bar-tip:${bar}`}
                style={styles.tip}
              >
                <Text {...SCALABLE_TEXT} style={[styles.tipLabel, type.label]}>
                  {BAR_ICON[bar].label.toUpperCase()}
                </Text>
                <Text {...SCALABLE_TEXT} style={[type.caption, styles.tipText]}>
                  {BAR_TIP[bar]}
                </Text>
              </View>
            )}
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
              <Text
                {...SCALABLE_TEXT}
                style={[
                  styles.speedText,
                  type.action,
                  speed === s && styles.speedTextActive,
                ]}
              >
                {s === 0 ? '❚❚' : `${s}×`}
              </Text>
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
            <Text {...SCALABLE_TEXT} style={[styles.metaButtonText, type.actionBold]}>
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
            <Text {...SCALABLE_TEXT} style={[styles.metaButtonText, type.actionBold]}>
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
    /**
     * Above the first-session chips, below anything focused.
     *
     * `FirstSessionUI` puts its ambient chips at 30/31 and its focused surfaces — recap
     * 45, event 50, intention 55, life decision 100 — above that. The HUD carried no
     * zIndex at all, so the goal chip painted straight over it, and a bar tip opening
     * downward landed underneath the chip during exactly the first session a player needs
     * it. 35 clears the ambient row without ever covering a panel that wants full
     * attention. Raising the tip alone could not fix this: the two live in sibling
     * stacking contexts, so DOM order decided and the chips render later.
     */
    zIndex: 35,
  },
  // design.md §3 Track A: thick Ink outline, cream face, cream-shadow bottom lip.
  block: {
    ...CHROME.panel,
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
  barRowRaised: { zIndex: 30 },
  /**
   * Anchored under its own row rather than floating over the scene: the HUD block is
   * already the top-left panel, and a tip that escaped it would sit on the sim. `absolute`
   * keeps the four rows from reflowing as one opens and closes.
   */
  tip: {
    ...CHROME.card,
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    // The row's own width, not a copy of it: `healthWidth` grows with the text-size
    // preference, and a hardcoded 168 let the bar underneath peek out past the tip.
    width: '100%',
    zIndex: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  tipLabel: { color: INK },
  tipText: { color: INK, textAlign: 'left' },
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
    ...CHROME.secondaryButton,
    minWidth: 44,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  speedBtnActive: {
    ...CHROME.selectedControl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  speedText: { color: INK },
  speedTextActive: { color: CREAM_LIGHT },
  metaButton: {
    ...CHROME.secondaryButton,
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 0,
    width: 44,
  },
  metaButtonText: { color: INK, fontFamily: FONT.pixelBold },
});
