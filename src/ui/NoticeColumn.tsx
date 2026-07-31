import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { LAYER, type Rect } from './layout';
import { FONT, TYPE_SCALE, theme } from './theme';

/**
 * The NOTICE region: one stack, not a scatter (docs/07-ui-architecture.md §3.2).
 *
 * Notices used to pick their own corners — the undo toast at `right: QUEUE_W + 10,
 * bottom: 10`, the wrinkle chip at `right: 8` inside the rail's column — which is the
 * shape RimWorld is the cautionary example of: messages top-left, alerts right, clock
 * bottom-right, and a modding scene devoted to consolidating it. One place per kind of
 * information, chosen once.
 *
 * Two rules are enforced here rather than hoped for:
 *
 *  - **Notices never overlap chrome.** They are laid out inside the `NOTICE` rectangle,
 *    which `layout.ts` defines as space `STATUS`, `TEMPORAL` and `RAIL` do not occupy.
 *    Geometry, not z-index — `LAYER.notice` sits *below* `LAYER.chrome` precisely so that
 *    if the geometry ever slipped, a chip would be hidden rather than the queue covered.
 *  - **At most `MAX_VISIBLE` are shown.** An uncapped alert column is how RimWorld's right
 *    edge became a wall. Beyond the cap the stack collapses to a count.
 */

export const MAX_VISIBLE = 3;

export interface NoticeItem {
  /** Stable across renders, so a re-render does not reorder the stack. */
  id: string;
  node: ReactNode;
}

export interface NoticeColumnProps {
  region: Rect | undefined;
  items: readonly NoticeItem[];
}

export function NoticeColumn({ region, items }: NoticeColumnProps) {
  if (items.length === 0) return null;

  const visible = items.slice(0, MAX_VISIBLE);
  const hidden = items.length - visible.length;

  // Bottom-anchored and growing upward: the newest notice keeps the position the eye
  // last looked at, instead of pushing the stack down the screen.
  const placement: ViewStyle =
    region === undefined
      ? { left: 8, bottom: 8 }
      : {
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
        };

  return (
    <View
      pointerEvents="box-none"
      testID="notice-column"
      style={[styles.column, placement]}
    >
      {hidden > 0 && (
        <Text
          accessible
          accessibilityLiveRegion="polite"
          testID="notice-overflow"
          style={styles.overflow}
        >
          {`+${hidden} more`}
        </Text>
      )}
      {visible.map((item) => (
        <View key={item.id} pointerEvents="box-none" style={styles.slot}>
          {item.node}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: LAYER.notice,
  },
  slot: { alignSelf: 'flex-start', maxWidth: '100%' },
  overflow: {
    color: theme.color.ink,
    ...TYPE_SCALE.caption,
    fontFamily: FONT.prose,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.color.creamBase,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: theme.radius.chip,
    overflow: 'hidden',
  },
});
