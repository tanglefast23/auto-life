import { StyleSheet, Text, View } from 'react-native';
import type { CharacterView } from '../sim/step';
import { characterString, perkCopy, statBlurb, statLabel } from './character-copy';
import { FONT, TYPE_SCALE, theme } from './theme';

/**
 * Who the sim is, as four numbers and two traits (docs/08 §11.3).
 *
 * The completion beat is the payoff; this is the thing it is a payoff *for*. The system's
 * promise is "you watch C+ become B", and a grade banner alone never shows the trend — so
 * the stat that just earned XP has a slim bar under it, and the two rolled traits sit
 * beside it with the cost of each stated, because every perk is a trade.
 *
 * It is **not** in the HUD. SPEC §11.1 caps that hierarchy, and four more rows there is
 * exactly the overhang docs/07 §1.1 was written to stop.
 */

export interface CharacterPanelProps {
  character: CharacterView;
}

export function CharacterPanel({ character }: CharacterPanelProps) {
  return (
    <View testID="character-panel" style={styles.root}>
      <Text style={styles.heading}>{characterString('character:panel.title')}</Text>
      {character.stats.map((stat) => (
        <View key={stat.id} testID={`character-stat:${stat.id}`} style={styles.statRow}>
          <View style={styles.statHeader}>
            <Text style={styles.statName}>{statLabel(stat.id)}</Text>
            <Text style={styles.statLevel}>
              {`${characterString('character:panel.level')} ${stat.level}`}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.statBlurb}>
            {statBlurb(stat.id)}
          </Text>
          <View style={styles.track}>
            <View
              testID={`character-xp:${stat.id}`}
              style={[styles.fill, { width: `${Math.round(stat.progress * 100)}%` }]}
            />
          </View>
        </View>
      ))}

      <Text style={styles.heading}>{characterString('character:panel.perksTitle')}</Text>
      {character.perkIds.map((perkId) => {
        const perk = perkCopy(perkId);
        return (
          <View key={perkId} testID={`character-perk:${perkId}`} style={styles.perkRow}>
            <Text style={styles.perkName}>{perk.label}</Text>
            <Text style={styles.perkBlurb}>{perk.blurb}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  heading: {
    ...TYPE_SCALE.caption,
    fontFamily: FONT.prose,
    color: theme.color.ink,
    textTransform: 'uppercase',
  },
  statRow: { gap: 2 },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  statName: { ...TYPE_SCALE.body, fontFamily: FONT.prose, color: theme.color.ink },
  // A level is data, so it keeps the pixel face — at the body step, per the P7 pairing rule.
  statLevel: { ...TYPE_SCALE.body, fontFamily: FONT.pixel, color: theme.color.ink },
  statBlurb: { ...TYPE_SCALE.caption, fontFamily: FONT.prose, color: theme.color.grey },
  /** The XP bar reads as progress, so unlike the need rings it fills rather than empties. */
  track: {
    height: 6,
    backgroundColor: theme.color.creamShadow,
    borderWidth: 1,
    borderColor: theme.color.ink,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: theme.color.leaf },
  perkRow: { gap: 2 },
  perkName: { ...TYPE_SCALE.body, fontFamily: FONT.prose, color: theme.color.ink },
  perkBlurb: { ...TYPE_SCALE.caption, fontFamily: FONT.prose, color: theme.color.grey },
});
