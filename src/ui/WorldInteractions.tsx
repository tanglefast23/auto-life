import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WORLD_H, WORLD_W } from '../render/scale';
import { objectPresentation } from '../render/object-presentation';
import { activityByIdIn, content } from '../sim/content';
import type { ObjectsConfig } from '../sim/content-schemas';
import { activityCopy } from './queue-presenter';
import { CHROME, FONT, TYPE_SCALE, theme } from './theme';
import { LAYER, local } from './layout';

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

const CREAM_LIGHT = theme.color.creamLight;
const CREAM_BASE = theme.color.creamBase;
const INK = theme.color.ink;
const BLUE = theme.color.water;

/**
 * Maps the furniture's visible bounds into the screen-space overlay used by React
 * Native. This intentionally follows the art rather than the smaller navigation
 * footprint, so the whole enlarged couch, bed, mat, or appliance is clickable.
 */
export function objectHitTarget(
  object: Pick<ObjectDef, 'id' | 'footprint'>,
  scale: number,
): WorldHitTarget {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const visual = objectPresentation(object);
  const rawLeft = visual.x * safeScale;
  const rawTop = visual.y * safeScale;
  const rawWidth = visual.width * safeScale;
  const rawHeight = visual.height * safeScale;
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
    zIndex: local(2),
  },
  hotspotVisible: {
    borderColor: BLUE,
    backgroundColor: 'rgba(90, 143, 214, 0.18)',
  },
  hotspotPressed: {
    backgroundColor: 'rgba(90, 143, 214, 0.32)',
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
    ...TYPE_SCALE.caption,
    textAlign: 'center',
  },
  choicePanel: {
    ...CHROME.panel,
    position: 'absolute',
    width: PANEL_WIDTH,
    padding: 8,
    gap: 4,
    zIndex: LAYER.worldOverlay,
  },
  choiceHeading: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceTitle: {
    color: INK,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeButton: {
    ...CHROME.secondaryButton,
    width: 44,
    height: 44,
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  closeText: {
    color: INK,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
    lineHeight: 20,
  },
  choiceOption: {
    ...CHROME.neutralButton,
    minHeight: OPTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  choiceGlyph: {
    width: 20,
    color: CREAM_LIGHT,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
    textAlign: 'center',
  },
  choiceText: {
    color: CREAM_LIGHT,
    fontFamily: FONT.pixel,
    fontSize: TYPE_SCALE.body.fontSize,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
