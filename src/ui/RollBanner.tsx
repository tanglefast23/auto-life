import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { GradeView } from '../sim/step';
import { MOTION, ROLL_BEATS, ROLL_SEQUENCE_MS, resolveMotion } from '../render/motion';
import { BAR_COLOR } from './bands';
import { local } from './layout';
import { FONT, TYPE_SCALE, scaledType, theme } from './theme';
import { useMotionRun, squashInterpolation } from './use-motion';
import type { BarId } from '../sim/types';

/**
 * The completion beat: die, grade, delta (docs/08 §11.1).
 *
 * Three things about this surface are deliberate, and each of them is a rule from somewhere
 * else in the codebase rather than a preference:
 *
 *  - **It replays; it never decides.** The check was resolved at the activity's *start* and
 *    applied by the engine a tick ago. This animates a result, exactly as the audio router
 *    announces what the engine did rather than what a forecast predicted. Nothing here can
 *    change an outcome, and nothing here gates the simulation — at 4× speed the banner
 *    collapses to the newest completion rather than queueing, because a backlog of stale
 *    dice is worse than a dropped one.
 *  - **It lives in a region.** `NOTICE` is the rectangle docs/07 assigns to chips and
 *    toasts, and a roll result is a toast. No screen edge, no hand-typed `zIndex`.
 *  - **The letter is the signal.** Colour is redundant reinforcement (SPEC §11.6), which is
 *    what lets the whole thing read for someone who cannot use the band colour at all.
 */

export interface RollBannerProps {
  grade: GradeView;
  gradeLabel: string;
  statLabel: string | null;
  activityLabel: string;
  reducedMotion: boolean;
}

const BAND_COLOR: Record<GradeView['band'], string> = {
  high: theme.color.gold,
  mid: theme.color.ink,
  low: theme.color.red,
};

/** The tumble reads as a die only if the faces change; six frames over 240 ms is the table. */
const TUMBLE_FACES = [13, 6, 19, 2, 11, 8];

export function RollBanner({
  grade,
  gradeLabel,
  statLabel,
  activityLabel,
  reducedMotion,
}: RollBannerProps) {
  const dieMotion = resolveMotion(MOTION.dieTumble, { reducedMotion });
  const stampDriver = useMotionRun(MOTION.gradeStamp, reducedMotion, grade.cardId);
  const [elapsed, setElapsed] = useState(reducedMotion ? ROLL_SEQUENCE_MS : 0);

  // One ticker, only while the sequence is running — an idle banner must not pay for a
  // clock, the same rule the queue's completion poof follows.
  useEffect(() => {
    if (reducedMotion) {
      setElapsed(ROLL_SEQUENCE_MS);
      return;
    }
    setElapsed(0);
    const startedAt = Date.now();
    const id = setInterval(() => {
      const now = Date.now() - startedAt;
      setElapsed(now);
      if (now >= ROLL_SEQUENCE_MS) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [grade.cardId, reducedMotion]);

  const tumbling = dieMotion.durationMs > 0 && elapsed < dieMotion.durationMs;
  const face = tumbling
    ? TUMBLE_FACES[Math.min(TUMBLE_FACES.length - 1, Math.floor((elapsed / dieMotion.durationMs) * TUMBLE_FACES.length))]!
    : grade.natural;
  const showGrade = elapsed >= ROLL_BEATS.grade;
  const showDelta = elapsed >= ROLL_BEATS.bar;

  const deltas = Object.entries(grade.deltas) as Array<[BarId, number]>;
  const sign = (v: number) => (v > 0 ? `+${round1(v)}` : String(round1(v)));

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      // The whole beat as one sentence, because a screen reader should not have to
      // reconstruct it from three separately announced fragments.
      accessibilityLabel={[
        `${activityLabel} complete.`,
        grade.shape === 'plain' ? `Rolled ${grade.natural}.` : `Rolled ${grade.natural} with ${grade.shape}.`,
        `${spokenGrade(gradeLabel)}.`,
        ...deltas.map(([bar, value]) => `${bar} ${value > 0 ? 'plus' : 'minus'} ${Math.abs(round1(value))}.`),
        grade.practicePoints !== null && grade.practicePoints !== 0
          ? `Practice ${grade.practicePoints > 0 ? 'plus' : 'minus'} ${Math.abs(round1(grade.practicePoints))}.`
          : null,
      ]
        .filter((part): part is string => part !== null)
        .join(' ')}
      testID="roll-banner"
      style={styles.root}
    >
      <View style={styles.dieRow}>
        <View style={styles.die} testID="roll-die">
          <Text style={styles.dieFace}>{face}</Text>
        </View>
        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.activity}>
            {activityLabel}
          </Text>
          <Text numberOfLines={1} style={styles.modifier} testID="roll-modifier">
            {statLabel === null ? '' : `${statLabel} `}
            {grade.modifier >= 0 ? `+${grade.modifier}` : String(grade.modifier)}
            {grade.shape === 'plain' ? '' : grade.shape === 'advantage' ? ' adv' : ' dis'}
          </Text>
        </View>
        {showGrade && (
          <Animated.Text
            testID="roll-grade"
            style={[
              styles.grade,
              { color: BAND_COLOR[grade.band] },
              { transform: [{ scale: squashInterpolation(MOTION.gradeStamp, stampDriver, reducedMotion) }] },
            ]}
          >
            {gradeLabel}
          </Animated.Text>
        )}
      </View>
      {showDelta && (deltas.length > 0 || grade.practicePoints) ? (
        <View style={styles.deltaRow} testID="roll-deltas">
          {deltas.map(([bar, value]) => (
            <Text key={bar} style={[styles.delta, { color: BAR_COLOR[bar] }]}>
              {sign(value)}
            </Text>
          ))}
          {grade.practicePoints !== null && grade.practicePoints !== 0 && (
            <Text style={[styles.delta, styles.practiceDelta]}>{`${sign(grade.practicePoints)} pts`}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** "A-" read aloud is "A minus"; the bare glyph is announced as a dash or skipped. */
function spokenGrade(label: string): string {
  return label.replace('+', ' plus').replace('-', ' minus');
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.color.creamBase,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: theme.radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    overflow: 'hidden',
  },
  dieRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  die: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.color.creamLight,
    zIndex: local(1),
  },
  dieFace: {
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixel,
    color: theme.color.ink,
  },
  meta: { flex: 1, minWidth: 0 },
  activity: {
    ...TYPE_SCALE.caption,
    fontFamily: FONT.prose,
    color: theme.color.ink,
  },
  modifier: {
    ...TYPE_SCALE.caption,
    fontFamily: FONT.prose,
    color: theme.color.grey,
  },
  grade: {
    ...scaledType('body', 1),
    fontFamily: FONT.pixel,
    zIndex: local(2),
  },
  deltaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  /**
   * The delivered numbers, on the pixel face at the BODY step.
   *
   * Joe's rules put numeric data on a monospace face, and P7 retired the sub-16px pixel
   * step as unreadable — `theme.test.ts` enforces the pairing, so the number gets the
   * larger step rather than the smaller face.
   */
  delta: {
    ...TYPE_SCALE.body,
    fontFamily: FONT.pixel,
  },
  practiceDelta: { color: theme.color.gold },
});

/**
 * Keep the newest grade on screen for one sequence, and fire the bar beat once.
 *
 * **Collapse to newest, never queue.** At 2× and 4× — and during the morning block, where
 * three completions land inside a few minutes — results arrive faster than 800 ms. Queueing
 * them would show the player a die for something that finished a minute ago while the next
 * thing is already running. A dropped banner is a smaller lie than a stale one.
 *
 * Under reduced motion the banner still appears and still holds for the sequence: SPEC
 * §11.6 drops tweens, not information.
 */
export function useLatestGrade(
  grade: GradeView | null,
  reducedMotion: boolean,
  onBarPop?: () => void,
): GradeView | null {
  const [live, setLive] = useState<GradeView | null>(null);

  useEffect(() => {
    if (grade === null) return;
    setLive(grade);
    const popAt = reducedMotion ? 0 : ROLL_BEATS.bar;
    const pop = setTimeout(() => onBarPop?.(), popAt);
    const clear = setTimeout(() => {
      // Only retire THIS grade: a newer one that arrived mid-sequence owns the slot now.
      setLive((current) => (current?.cardId === grade.cardId ? null : current));
    }, ROLL_SEQUENCE_MS);
    return () => {
      clearTimeout(pop);
      clearTimeout(clear);
    };
  }, [grade, reducedMotion, onBarPop]);

  return live;
}
