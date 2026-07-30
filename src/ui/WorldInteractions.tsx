import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WORLD_H, WORLD_W } from '../render/scale';
import { TILE } from '../render/scene-layout';
import { activityByIdIn, content } from '../sim/content';
import type { ObjectsConfig } from '../sim/content-schemas';
import { activityCopy } from './queue-presenter';

type ObjectDef = ObjectsConfig['objects'][number];

export interface WorldHitTarget {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WorldInteractionsProps {
  scale: number;
  onChooseActivity: (activityId: string) => void;
}

export interface WorldInteractionsHandle {
  closeChoice: () => boolean;
}

const MIN_TARGET_PX = 44;
const PANEL_WIDTH = 208;
const PANEL_MARGIN = 8;
const OPTION_HEIGHT = 44;

const CREAM_LIGHT = '#faf1dc';
const CREAM_BASE = '#f2e4c2';
const CREAM_SHADOW = '#d9c493';
const INK = '#2e2119';
const GOLD = '#f0a840';

/**
 * Maps one authored world footprint into the screen-space overlay used by React
 * Native. A one-tile object grows around its centre to the §11.2 44 px minimum;
 * larger footprints keep their exact bounds.
 */
export function objectHitTarget(
  object: Pick<ObjectDef, 'footprint'>,
  scale: number,
): WorldHitTarget {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const xs = object.footprint.map(([x]) => x);
  const ys = object.footprint.map(([, y]) => y);
  const rawLeft = Math.min(...xs) * TILE * safeScale;
  const rawTop = Math.min(...ys) * TILE * safeScale;
  const rawWidth = (Math.max(...xs) - Math.min(...xs) + 1) * TILE * safeScale;
  const rawHeight = (Math.max(...ys) - Math.min(...ys) + 1) * TILE * safeScale;
  const width = Math.max(MIN_TARGET_PX, rawWidth);
  const height = Math.max(MIN_TARGET_PX, rawHeight);
  return {
    left: rawLeft - (width - rawWidth) / 2,
    top: rawTop - (height - rawHeight) / 2,
    width,
    height,
  };
}

function objectLabel(object: ObjectDef): string {
  return object.id.replace(/(^|[-_])(\w)/g, (_all, _separator, letter: string) =>
    ` ${letter.toUpperCase()}`,
  ).trim();
}

function activityListLabel(object: ObjectDef): string {
  return object.activities.map((id) => activityCopy(id).label).join(' or ');
}

function choicePosition(
  object: ObjectDef,
  scale: number,
): { left: number; top: number } {
  const target = objectHitTarget(object, scale);
  const worldWidth = WORLD_W * scale;
  const worldHeight = WORLD_H * scale;
  const panelHeight = 42 + object.activities.length * OPTION_HEIGHT + 8;
  const centredLeft = target.left + target.width / 2 - PANEL_WIDTH / 2;
  const left = Math.max(
    PANEL_MARGIN,
    Math.min(worldWidth - PANEL_WIDTH - PANEL_MARGIN, centredLeft),
  );
  const below = target.top + target.height + 6;
  const top =
    below + panelHeight <= worldHeight - PANEL_MARGIN
      ? below
      : Math.max(PANEL_MARGIN, target.top - panelHeight - 6);
  return { left, top };
}

export const WorldInteractions = forwardRef<
  WorldInteractionsHandle,
  WorldInteractionsProps
>(function WorldInteractions({ scale, onChooseActivity }, ref) {
  const [choiceObjectId, setChoiceObjectId] = useState<string | null>(null);
  const interactiveObjects = useMemo(
    () =>
      content.objects.objects.flatMap((object) => {
        const activities = object.activities.filter(
          (activityId) =>
            activityByIdIn(content, activityId).playerSelectable !== false,
        );
        return activities.length === 0 ? [] : [{ ...object, activities }];
      }),
    [],
  );
  const choiceObject =
    choiceObjectId === null
      ? null
      : interactiveObjects.find((object) => object.id === choiceObjectId) ?? null;

  useImperativeHandle(
    ref,
    () => ({
      closeChoice: () => {
        if (choiceObjectId === null) return false;
        setChoiceObjectId(null);
        return true;
      },
    }),
    [choiceObjectId],
  );

  const chooseObject = (object: ObjectDef) => {
    if (object.activities.length === 1) {
      onChooseActivity(object.activities[0]!);
      setChoiceObjectId(null);
      return;
    }
    setChoiceObjectId(object.id);
  };

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      testID="world-interactions"
    >
      {interactiveObjects.map((object) => (
        <ObjectHotspot
          key={object.id}
          object={object}
          scale={scale}
          selected={choiceObjectId === object.id}
          onPress={() => chooseObject(object)}
        />
      ))}

      {choiceObject !== null && (
        <View
          accessible
          accessibilityLabel={`Choose what to do at the ${objectLabel(choiceObject)}`}
          style={[
            styles.choicePanel,
            choicePosition(choiceObject, scale),
          ]}
          testID="world-object-choice"
        >
          <View style={styles.choiceHeading}>
            <Text style={styles.choiceTitle}>
              {objectLabel(choiceObject)}
            </Text>
            <Pressable
              accessibilityLabel="Close activity choices"
              accessibilityRole="button"
              onPress={() => setChoiceObjectId(null)}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.buttonPressed,
              ]}
              testID="world-object-choice:close"
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {choiceObject.activities.map((activityId) => {
            const copy = activityCopy(activityId);
            return (
              <Pressable
                key={activityId}
                accessibilityLabel={`Add ${copy.label} to the queue`}
                accessibilityRole="button"
                onPress={() => {
                  onChooseActivity(activityId);
                  setChoiceObjectId(null);
                }}
                style={({ pressed }) => [
                  styles.choiceOption,
                  pressed && styles.buttonPressed,
                ]}
                testID={`world-object-choice:${activityId}`}
              >
                <Text style={styles.choiceGlyph}>{copy.glyph}</Text>
                <Text style={styles.choiceText}>{copy.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
});

function ObjectHotspot({
  object,
  scale,
  selected,
  onPress,
}: {
  object: ObjectDef;
  scale: number;
  selected: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const showCue = hovered || focused || selected;
  const activities = activityListLabel(object);
  const accessibilityLabel =
    object.activities.length === 1
      ? `${objectLabel(object)}, add ${activities} to the queue`
      : `${objectLabel(object)}, choose ${activities}`;

  return (
    <Pressable
      accessibilityHint={
        object.activities.length === 1
          ? 'Adds this activity to the end of your plan'
          : 'Opens the activities available here'
      }
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
      focusable
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hotspot,
        objectHitTarget(object, scale),
        showCue && styles.hotspotVisible,
        (pressed || selected) && styles.hotspotPressed,
      ]}
      testID={`world-object:${object.id}`}
    >
      {showCue && (
        <Text pointerEvents="none" style={styles.hotspotLabel}>
          {object.activities.length === 1
            ? activityCopy(object.activities[0]!).label
            : 'Choose'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hotspot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 3,
    zIndex: 2,
  },
  hotspotVisible: {
    borderColor: GOLD,
    backgroundColor: 'rgba(240, 168, 64, 0.18)',
  },
  hotspotPressed: {
    backgroundColor: 'rgba(240, 168, 64, 0.32)',
  },
  hotspotLabel: {
    position: 'absolute',
    bottom: -17,
    minWidth: 52,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 2,
    backgroundColor: CREAM_BASE,
    color: INK,
    fontFamily: 'monospace',
    fontSize: 9,
    textAlign: 'center',
  },
  choicePanel: {
    position: 'absolute',
    width: PANEL_WIDTH,
    padding: 8,
    gap: 4,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    borderRadius: 4,
    backgroundColor: CREAM_BASE,
    zIndex: 20,
  },
  choiceHeading: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceTitle: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  closeText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 18,
    lineHeight: 20,
  },
  choiceOption: {
    minHeight: OPTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 3,
    backgroundColor: CREAM_LIGHT,
  },
  buttonPressed: {
    backgroundColor: CREAM_SHADOW,
  },
  choiceGlyph: {
    width: 20,
    color: GOLD,
    fontFamily: 'monospace',
    fontSize: 16,
    textAlign: 'center',
  },
  choiceText: {
    color: INK,
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
