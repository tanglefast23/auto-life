import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SessionState } from '../game/session';
import { storyletString } from './storylet-copy';
import { formatTimeOfDay } from './clock-format';
import { CHROME, FONT, TYPE_SCALE, theme } from './theme';
import { GUTTER, LAYER, type Rect } from './layout';

/**
 * The journal: what has already happened, on demand (P8 UI pass).
 *
 * Two tabs, because the session already keeps two distinct records and neither was
 * readable anywhere in the game:
 *
 *  - **Entries** — `session.journal.entries`, the storylet moments written as they fire.
 *    They were being generated and stored and then never shown to anyone.
 *  - **Days** — `session.calendarLedger.days`, the per-day tally. The morning recap shows
 *    exactly one day and then dismisses; this is where the week lives.
 *
 * It opens **over the information column** and closes back to it, rather than floating: it
 * is the same rectangle, so opening the journal never changes the shape of the screen.
 */

export type JournalTab = 'entries' | 'days';

export interface JournalPanelProps {
  session: SessionState;
  region: Rect | undefined;
  onClose: () => void;
}

/**
 * A saved entry outlives the storylet that wrote it.
 *
 * `storyletString` throws on an id it does not recognise, which is right for authored copy
 * checked at build time and wrong for a *record of the past*: a save from before a storylet
 * was renamed would take the whole panel down with it. The journal degrades to the raw id
 * instead — legible enough to report, and impossible to crash on.
 */
function entryText(stringId: string): string {
  try {
    return storyletString(stringId);
  } catch {
    return stringId.replace(/^storylets:/, '').replace(/[.]/g, ' ');
  }
}

export function JournalPanel({ session, region, onClose }: JournalPanelProps) {
  const [tab, setTab] = useState<JournalTab>('entries');

  const entries = [...session.journal.entries].reverse();
  const days = [...session.calendarLedger.days].reverse();

  const box =
    region === undefined
      ? {}
      : {
          left: region.x + GUTTER,
          top: region.y,
          width: Math.max(0, region.width - GUTTER * 2),
          height: region.height,
        };

  return (
    <View style={[styles.root, box]} testID="journal-panel">
      <View style={styles.header}>
        <Text style={styles.title}>JOURNAL</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close journal"
          onPress={onClose}
          testID="journal-close"
          style={styles.close}
        >
          <Text style={styles.closeMark}>×</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['entries', 'days'] as const).map((name) => (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === name }}
            accessibilityLabel={name === 'entries' ? 'Moments' : 'Days'}
            onPress={() => setTab(name)}
            testID={`journal-tab:${name}`}
            style={[styles.tab, tab === name && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === name && styles.tabTextActive]}>
              {name === 'entries' ? 'MOMENTS' : 'DAYS'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        testID="journal-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {tab === 'entries' &&
          (entries.length === 0 ? (
            <Text style={styles.empty} testID="journal-empty:entries">
              Nothing written down yet.
            </Text>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={styles.entry} testID={`journal-entry:${entry.id}`}>
                <Text style={styles.entryWhen}>
                  {`Day ${entry.day} · ${formatTimeOfDay(entry.minuteOfDay)}`}
                </Text>
                <Text style={styles.entryBody}>{entryText(entry.stringId)}</Text>
              </View>
            ))
          ))}

        {tab === 'days' &&
          (days.length === 0 ? (
            <Text style={styles.empty} testID="journal-empty:days">
              No days closed out yet.
            </Text>
          ) : (
            days.map((day) => (
              <View key={day.day} style={styles.entry} testID={`journal-day:${day.day}`}>
                <Text style={styles.entryWhen}>{`Day ${day.day}`}</Text>
                <Text style={styles.entryBody}>
                  {[
                    `${day.practiceSessions} practice`,
                    `${day.urgentEvents} urgent`,
                    day.resolvedWrinkleId === null ? null : 'wrinkle resolved',
                  ]
                    .filter((part): part is string => part !== null)
                    .join(' · ')}
                </Text>
              </View>
            ))
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...CHROME.panel,
    position: 'absolute',
    padding: 8,
    gap: 6,
    overflow: 'hidden',
    // Above the column it covers, below anything modal — it is a reader, not a decision.
    zIndex: LAYER.focus,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    color: theme.color.ink,
    ...TYPE_SCALE.caption,
    fontFamily: FONT.prose,
    letterSpacing: 1,
  },
  close: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  closeMark: { color: theme.color.ink, ...TYPE_SCALE.body, fontFamily: FONT.pixelBold },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: {
    flex: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.creamShadow,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: theme.radius.chip,
  },
  tabActive: { backgroundColor: theme.color.water },
  tabText: {
    color: theme.color.ink,
    ...TYPE_SCALE.caption,
    fontFamily: FONT.prose,
    letterSpacing: 1,
  },
  tabTextActive: { color: theme.color.creamLight },
  scroll: { flex: 1 },
  scrollContent: { gap: 6, paddingBottom: 4 },
  entry: {
    backgroundColor: theme.color.creamLight,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 4,
    padding: 6,
    gap: 2,
  },
  entryWhen: {
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
    fontFamily: FONT.prose,
  },
  entryBody: { color: theme.color.ink, ...TYPE_SCALE.caption, fontFamily: FONT.prose },
  empty: {
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
    fontFamily: FONT.prose,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
