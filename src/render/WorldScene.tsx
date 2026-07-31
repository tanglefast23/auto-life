import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Atlas,
  FilterMode,
  Group,
  MipmapMode,
  Path,
  Rect,
  rect,
  RoundedRect,
  Skia,
  useImage,
  useRSXformBuffer,
  useRectBuffer,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { content } from '../sim/content';
import { resolvePaletteId } from './appearance';
import { lightingAt, type Lighting } from './lighting';
import { effectFrame, MOTION, motionProgress, resolveMotion } from './motion';
import type { RenderView } from '../sim/render-view';
import atlasIndexJson from '../../assets/generated/atlas-index.json';
import {
  advancePhase,
  dwelledPose,
  buildCharacterQuad,
  buildDecorationQuads,
  buildStaticQuads,
  CHAR_H,
  CHAR_W,
  characterSprite,
  DECORATION_PLACEMENTS,
  floorMaterialAt,
  HERO_DRAW_SCALE,
  heroDrawOrigin,
  lookup,
  snapToPhysicalPixel,
  TILE,
  type AtlasIndex,
} from './scene-layout';
import type { FloorMaterial } from '../sim/content-schemas';
import type { Bubble } from './bubbles';
import { BUBBLE_TINT, theme } from '../ui/theme';

const index = atlasIndexJson as AtlasIndex;

/**
 * The Skia scene (P3 T6).
 *
 * Master §9: Atlas is mandatory from the first sprite renderer. Calls are split by
 * change rate — the 350-quad static world is memoized and never re-uploads, run
 * decorations update only when granted, and the character is one quad.
 *
 * **Nothing here re-renders React per frame.** The character's position and sprite live
 * in Reanimated shared values that a single RAF writes; `useRSXformBuffer` /
 * `useRectBuffer` run their modifiers as UI-thread mappers and call `notifyChange`, so
 * Skia repaints without touching the React tree. The first version bumped React state
 * every frame — roughly 43,200 reconciliations per 1× day, and it kept going while
 * paused (adversarial pass 2).
 *
 * Scope of that claim, stated precisely because an earlier version of this comment
 * overclaimed (pass 4): the **paint** is off the JS thread, and React is not involved
 * per frame. The per-frame *maths* still runs in a JS `requestAnimationFrame` callback,
 * so a JS stall stutters movement. Moving the maths into a Reanimated frame worklet is
 * a real improvement and is deliberately not attempted here — it would put
 * `buildCharacterQuad` and the interpolator on the UI thread, which is P6's performance
 * pass, not a placeholder-art phase's job.
 *
 * `sampling` is pinned to nearest-neighbour with no mipmaps. Skia's default is linear,
 * which blurs every pixel edge the moment the §11.5 scale is not 1 — design.md §13
 * rejects anti-aliased pixel art outright.
 */

const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

/**
 * Every character sprite for one appearance, flattened so a worklet can index it by
 * number without touching an object.
 *
 * Built from the atlas index's own pose table rather than a hard-coded pose list, so an
 * added frame needs no edit here — and enumerating at module scope means a missing frame
 * throws at startup and in the mounted tests, never mid-frame in a player's session.
 */
function characterLookup(paletteId: string): { rects: number[][]; indexOf: Record<string, number> } {
  const names = new Set<string>();
  for (const [key, frames] of Object.entries(index.poses)) {
    for (let i = 0; i < frames; i++) names.add(`char.${paletteId}.${key}-${i}`);
  }
  // `stand` aliases walk frame 0, so its four facings are reachable names too.
  for (const facing of ['up', 'down', 'left', 'right'] as const) {
    names.add(`char.${paletteId}.walk-${facing}-0`);
  }
  const sorted = [...names].sort();
  return {
    rects: sorted.map((n) => {
      const r = lookup(index, n);
      return [r.x, r.y, r.w, r.h];
    }),
    indexOf: Object.fromEntries(sorted.map((n, i) => [n, i])),
  };
}

export interface WorldSceneProps {
  view: RenderView;
  /** Run-scoped game rewards; kept out of SimState and painted dynamically. */
  decorationIds?: readonly string[];
  /** Which baked appearance to draw (P6 T5). Unknown ids fall back rather than crash. */
  paletteId?: string;
  /** Active idle variant — an identity preference or Goal 4's air-guitar reward. */
  idleVariantId?: string | null;
  /** Minute of the game day, so the room can swap to its evening tile set (design.md §7). */
  minuteOfDay?: number;
  /** SPEC §11.6 — kills pulses and parallax, keeps state changes. */
  reducedMotion?: boolean;
  /**
   * Changes exactly when the queue's cards change, so SPEC §11.3's glance fires on
   * steering and on nothing else. `forecastRevision` was the obvious candidate and is the
   * wrong one: it also bumps on every new game hour, which would be a glance a minute at
   * 1× for no player action at all.
   */
  queueSignature?: string;
  /**
   * SPEC §11.1's world bubble, already decided by `bubbleFor()`.
   *
   * The scene draws it; it does not choose it. Priority is a pure rule with its own tests,
   * and duplicating any of it here would be a second opinion about what the sim is thinking.
   */
  bubble?: Bubble | null;
  /**
   * One walk-cycle contact, with the floor under the sim at that moment.
   *
   * Lives here because the walk phase does: the cycle is advanced by this component's frame
   * callback, so a footstep timed anywhere else would be guessing at where the feet are.
   */
  onFootstep?: (material: FloorMaterial) => void;
  /** Progress through the current tick, 0..1. Read fresh each frame. */
  alphaRef: () => number;
  scale: number;
  /** Actual screen pixels occupied by one art pixel at the chosen exact scale. */
  physicalPerArtPixel?: number;
  /**
   * Effective playback speed (0 while paused). The walk cycle is scaled by it, so at 4×
   * the legs move with the body instead of the sim sliding on frozen strides, and a
   * paused sim stops cycling (adversarial pass 2).
   */
  effectiveSpeed: number;
}

export function WorldScene({
  view,
  decorationIds = [],
  paletteId,
  idleVariantId = null,
  minuteOfDay = 12 * 60,
  reducedMotion = false,
  queueSignature = '',
  bubble = null,
  onFootstep,
  alphaRef,
  scale,
  physicalPerArtPixel = scale,
  effectiveSpeed,
}: WorldSceneProps) {
  const image = useImage(require('../../assets/generated/atlas.png'));
  const appearance = resolvePaletteId(paletteId);
  const lighting = lightingAt(minuteOfDay);

  // Static world: memoized per lighting state. There are exactly two, so this rebuilds
  // once at the 19:00 boundary rather than per frame, and the 350-quad buffer stays
  // stable within a state — which is what keeps the Atlas upload off the frame path.
  const staticScene = useMemo(() => {
    const quads = buildStaticQuads(content.homeMap, content.objects, lighting);
    return {
      sprites: quads.map((q) => {
        const r = lookup(index, q.sprite);
        return rect(r.x, r.y, r.w, r.h);
      }),
      transforms: quads.map((q) => Skia.RSXform(1, 0, q.x, q.y)),
    };
  }, [lighting]);

  /**
   * design.md §7's 19:00 crossfade. Both tile sets are memoized, so the change is an
   * opacity ramp over two already-uploaded buffers rather than a rebuild — and reduced
   * motion collapses it to an instant swap while keeping the end state (SPEC §11.6).
   */
  const previousScene = useMemo(() => {
    const other = lighting === 'day' ? 'evening' : 'day';
    const quads = buildStaticQuads(content.homeMap, content.objects, other);
    return {
      sprites: quads.map((q) => {
        const r = lookup(index, q.sprite);
        return rect(r.x, r.y, r.w, r.h);
      }),
      transforms: quads.map((q) => Skia.RSXform(1, 0, q.x, q.y)),
    };
  }, [lighting]);

  // Rebuilt only when the career's appearance changes, i.e. once on load.
  const chars = useMemo(() => characterLookup(appearance), [appearance]);
  const decorationScene = useMemo(() => {
    const quads = buildDecorationQuads(decorationIds);
    return {
      sprites: quads.map((quad) => {
        const sprite = lookup(index, quad.sprite);
        return rect(sprite.x, sprite.y, sprite.w, sprite.h);
      }),
      transforms: quads.map((quad) =>
        Skia.RSXform(1, 0, quad.x, quad.y),
      ),
    };
  }, [decorationIds]);

  const initialHeroOrigin = heroDrawOrigin(view.position.x, view.position.y);
  const charX = useSharedValue(initialHeroOrigin.x);
  const charY = useSharedValue(initialHeroOrigin.y);
  const charSprite = useSharedValue(0);
  const ringProgress = useSharedValue(0);
  const ringX = useSharedValue(0);
  const ringY = useSharedValue(0);
  // Offset to the sim's right shoulder rather than straight up, so the bubble and §11.1's
  // progress ring can both be over her at once without stacking on the same pixels.
  const bubbleX = useSharedValue(0);
  const bubbleY = useSharedValue(0);

  const charTransforms = useRSXformBuffer(1, (val) => {
    'worklet';
    val.set(HERO_DRAW_SCALE, 0, charX.value, charY.value);
  });

  const charRectTable = chars.rects;
  const charRects = useRectBuffer(1, (val) => {
    'worklet';
    const r = charRectTable[charSprite.value] ?? charRectTable[0]!;
    val.setXYWH(r[0]!, r[1]!, r[2]!, r[3]!);
  });

  const fade = useSharedValue(1);
  /**
   * The lighting state the last crossfade actually ran *from* — not merely "has this
   * effect run before".
   *
   * The effect re-runs on `reducedMotion` as well as on `lighting`, and `previousScene` is
   * unconditionally the *opposite* lighting state. A boolean first-run flag could not tell
   * those two triggers apart, so turning reduced motion back off at noon re-entered the
   * fade with no lighting change at all and the player watched the evening room dissolve
   * over four seconds. GameScreen stays mounted under the pause overlay, so the settings
   * panel is exactly where this was reachable.
   */
  const lastLighting = useRef<Lighting | null>(null);
  // The outgoing room is only *mounted* while the fade runs. Leaving it mounted would
  // double the 350-quad static buffer for every frame of the day to serve a transition
  // that happens twice — the sort of always-on cost a perf pass then has to hunt for.
  const [crossfading, setCrossfading] = useState(false);
  useEffect(() => {
    const previous = lastLighting.current;
    lastLighting.current = lighting;
    const motion = resolveMotion(MOTION.lightingCrossfade, { reducedMotion });
    if (previous === null || previous === lighting || motion.durationMs === 0) {
      fade.value = 1;
      setCrossfading(false);
      return;
    }
    fade.value = 0;
    setCrossfading(true);
    const started = Date.now();
    const id = setInterval(() => {
      const t = motionProgress(motion, Date.now() - started);
      fade.value = t;
      if (t >= 1) {
        clearInterval(id);
        setCrossfading(false);
      }
    }, 32);
    return () => clearInterval(id);
  }, [lighting, reducedMotion, fade]);

  /**
   * SPEC §11.3's glance. The queue rail is pinned to the right of the world, so "looks at
   * the queue" is literally a right-facing frame — no new art, and it reads at 1×.
   *
   * The flag lives in a ref because the RAF reads it: routing it through React state
   * would re-render the scene twice per glance, and this component's whole design is that
   * React is not involved per frame.
   */
  const glancing = useRef(false);
  const firstQueue = useRef(true);
  useEffect(() => {
    if (firstQueue.current) {
      firstQueue.current = false;
      return;
    }
    const motion = resolveMotion(MOTION.queueGlance, { reducedMotion });
    if (motion.durationMs <= 0) {
      glancing.current = false;
      return;
    }
    glancing.current = true;
    const id = setTimeout(() => {
      glancing.current = false;
    }, motion.durationMs);
    return () => {
      clearTimeout(id);
      glancing.current = false;
    };
  }, [queueSignature, reducedMotion]);

  /**
   * design.md §10's gold sparkle — "strictly for rewards", and this is the only place in
   * the game that draws one. Fired when a decoration is granted, at the decoration's own
   * placement, so the reward is visible where it landed rather than announced in a panel.
   */
  const [sparkle, setSparkle] = useState<{ x: number; y: number; startedAt: number } | null>(null);
  const knownDecorations = useRef<readonly string[] | null>(null);
  useEffect(() => {
    const known = knownDecorations.current;
    knownDecorations.current = decorationIds;
    // A restored save arrives with every decoration it ever earned. Sparkling all of them
    // on load would spend the one reward signal on a reload.
    if (known === null) return;
    const granted = decorationIds.find((id) => !known.includes(id));
    if (granted === undefined) return;
    const motion = resolveMotion(MOTION.sparkle, { reducedMotion });
    if (motion.durationMs <= 0) return;
    const placement = DECORATION_PLACEMENTS[granted];
    if (placement === undefined) return;
    setSparkle({ x: placement.x + TILE / 2, y: placement.y, startedAt: Date.now() });
    const id = setTimeout(() => setSparkle(null), motion.durationMs);
    return () => clearTimeout(id);
  }, [decorationIds, reducedMotion]);

  // ONE RAF for the component's lifetime.
  //
  // The first version listed `view` in its deps. `view` is a fresh object every tick, so
  // the effect tore down and remounted 2–8 times a second, resetting `phase` and the
  // frame timestamp each time — the walk cycle never actually ran, it just restarted
  // (adversarial pass 4). The watched-day test could not catch this: it never mounts
  // React. Latest inputs are read through a ref instead.
  const latest = useRef({
    view,
    alphaRef,
    effectiveSpeed,
    physicalPerArtPixel,
    appearance,
    idleVariantId,
    onFootstep,
    indexOf: chars.indexOf,
  });
  latest.current = {
    view,
    alphaRef,
    effectiveSpeed,
    physicalPerArtPixel,
    appearance,
    idleVariantId,
    onFootstep,
    indexOf: chars.indexOf,
  };

  useEffect(() => {
    let raf = 0;
    let phase = 0;
    let last: number | null = null;
    // How long the read-model has reported idle without interruption.
    let idleHeldMs = 0;
    // Which half of the walk cycle the last frame was in. A cycle is two strides, so a
    // change here is one foot landing — the same signal the sprite swap reads, which is
    // what keeps the sound on the frame the player sees the foot touch down.
    let contact: number | null = null;
    const frame = (now: number) => {
      const {
        view: v,
        alphaRef: getAlpha,
        effectiveSpeed: speed,
        physicalPerArtPixel: pixelGrid,
        appearance: paletteKey,
        idleVariantId: variant,
        onFootstep: footstep,
        indexOf,
      } = latest.current;
      const delta = last === null ? 0 : now - last;
      last = now;
      // Game-time tempo: real-time delta × playback speed. Paused ⇒ 0 ⇒ frozen legs.
      phase = advancePhase(phase, delta * speed, v.mSpeed);
      // Real elapsed time, deliberately NOT scaled by `speed`: the guard exists so a human
      // can see the pose, and an eye does not run at 4×.
      idleHeldMs = v.pose === 'idle' ? idleHeldMs + delta : 0;
      const drawnPose = dwelledPose(v.pose, idleHeldMs);
      if (v.pose === 'walk' && footstep !== undefined) {
        const half = Math.floor(phase * 2);
        // `contact === null` is the first walking frame, which is a footfall the player
        // both sees and expects; only a *repeat* of the same half is silent.
        if (half !== contact) {
          contact = half;
          footstep(floorMaterialAt(content.homeMap, v.position.x, v.position.y));
        }
      } else {
        contact = null;
      }
      const quad = buildCharacterQuad(
        index,
        paletteKey,
        // Only allocate a substitute view on the frames the guard actually changes, so a
        // walking or working sim pays nothing for it.
        drawnPose === v.pose ? v : { ...v, pose: drawnPose },
        getAlpha(),
        phase,
        variant,
        glancing.current ? 'right' : null,
      );
      const drawX = snapToPhysicalPixel(quad.x, pixelGrid);
      const drawY = snapToPhysicalPixel(quad.y, pixelGrid);
      charX.value = drawX;
      charY.value = drawY;
      charSprite.value = indexOf[quad.sprite] ?? 0;
      // §11.1: progress ring over the sim. Centred above the head.
      ringProgress.value = v.activityProgress ?? 0;
      ringX.value = drawX + (CHAR_W * HERO_DRAW_SCALE) / 2;
      ringY.value = drawY - 6;
      bubbleX.value = drawX + CHAR_W * HERO_DRAW_SCALE - 2;
      bubbleY.value = drawY;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [charX, charY, charSprite, ringProgress, ringX, ringY, bubbleX, bubbleY]);

  if (image === null) return null;
  return (
    <Group transform={[{ scale }]}>
      {crossfading && (
        <Atlas
          image={image}
          sprites={previousScene.sprites}
          transforms={previousScene.transforms}
          sampling={NEAREST}
        />
      )}
      <Atlas
        image={image}
        sprites={staticScene.sprites}
        transforms={staticScene.transforms}
        sampling={NEAREST}
        opacity={fade}
      />
      {decorationScene.sprites.length > 0 && (
        <Atlas
          image={image}
          sprites={decorationScene.sprites}
          transforms={decorationScene.transforms}
          sampling={NEAREST}
        />
      )}
      <Atlas image={image} sprites={charRects} transforms={charTransforms} sampling={NEAREST} />
      <ProgressRing progress={ringProgress} cx={ringX} cy={ringY} />
      {bubble !== null && (
        <ThoughtBubble bubble={bubble} image={image} cx={bubbleX} cy={bubbleY} />
      )}
      {sparkle !== null && <RewardSparkle {...sparkle} />}
    </Group>
  );
}

/**
 * SPEC §11.1's world thought bubble — "need <40, preferences, hints" — over the sim's head.
 *
 * `bubbles.ts` shipped with full unit coverage and no consumer at all: `bubbleFor()` was
 * referenced only by its own test and `BUBBLE_TINT` only by the theme test, so the one
 * §11.1 surface that teaches a player *why* she walked to the shower existed solely as a
 * passing test file. This is the surface.
 *
 * design.md §8's recipe, exactly: cream round, Ink tail, a 12-px icon, and a tint that is
 * plum, leaf or gold — never red. The tint rings the bubble rather than filling it, because
 * a 12-px icon on a saturated ground is the one way to make an alert glyph *less* legible
 * than the bar it is reporting.
 */
const BUBBLE_W = 22;
const BUBBLE_H = 20;
const BUBBLE_ICON = 12;
const BUBBLE_TAIL = 4;

function ThoughtBubble({
  bubble,
  image,
  cx,
  cy,
}: {
  bubble: Bubble;
  image: ReturnType<typeof useImage>;
  cx: SharedValue<number>;
  cy: SharedValue<number>;
}) {
  const icon = useMemo(() => {
    // An icon the atlas does not carry must not take the frame down for a decoration.
    try {
      const r = lookup(index, bubble.icon);
      return rect(r.x, r.y, r.w, r.h);
    } catch {
      return null;
    }
  }, [bubble.icon]);
  const transform = useDerivedValue(() => [
    { translateX: cx.value },
    { translateY: cy.value },
  ]);
  const tail = useMemo(() => {
    const path = Skia.Path.Make();
    path.moveTo(-BUBBLE_TAIL, 0);
    path.lineTo(BUBBLE_TAIL, 0);
    path.lineTo(0, BUBBLE_TAIL);
    path.close();
    return path;
  }, []);
  if (icon === null) return null;
  return (
    <Group transform={transform}>
      <RoundedRect
        x={-BUBBLE_W / 2}
        y={-BUBBLE_H}
        width={BUBBLE_W}
        height={BUBBLE_H}
        r={4}
        color={theme.color.creamLight}
      />
      <RoundedRect
        x={-BUBBLE_W / 2}
        y={-BUBBLE_H}
        width={BUBBLE_W}
        height={BUBBLE_H}
        r={4}
        color={BUBBLE_TINT[bubble.tint]}
        style="stroke"
        strokeWidth={2}
      />
      <Path path={tail} color={theme.color.ink} />
      <Atlas
        image={image}
        sprites={[icon]}
        transforms={[
          Skia.RSXform(
            BUBBLE_ICON / icon.width,
            0,
            -BUBBLE_ICON / 2,
            -BUBBLE_H + (BUBBLE_H - BUBBLE_ICON) / 2,
          ),
        ]}
        sampling={NEAREST}
      />
    </Group>
  );
}

/**
 * design.md §10's gold sparkle, the only gold motion in the game.
 *
 * Four squares pushing outward on **integer** steps: the spread is `1 + frame`, so every
 * edge still lands on a whole art pixel and design.md §13's ban on anti-aliased pixel art
 * survives a growing effect. The step comes from `effectFrame`, so the six frames the
 * table declares are the six frames drawn.
 */
const SPARKLE_PUFF = 4;

function RewardSparkle({ x, y, startedAt }: { x: number; y: number; startedAt: number }) {
  const step = useSharedValue(0);
  useEffect(() => {
    const id = setInterval(() => {
      step.value = effectFrame(MOTION.sparkle, Date.now() - startedAt) ?? MOTION.sparkle.frames;
    }, 32);
    return () => clearInterval(id);
  }, [startedAt, step]);
  const transform = useDerivedValue(() => [
    { translateX: x },
    { translateY: y },
    { scale: 1 + step.value },
  ]);
  const opacity = useDerivedValue(() =>
    Math.max(0, 1 - step.value / MOTION.sparkle.frames),
  );
  return (
    <Group transform={transform} opacity={opacity}>
      {[
        [-SPARKLE_PUFF, -SPARKLE_PUFF],
        [SPARKLE_PUFF, -SPARKLE_PUFF],
        [-SPARKLE_PUFF, SPARKLE_PUFF],
        [SPARKLE_PUFF, SPARKLE_PUFF],
      ].map(([dx, dy]) => (
        <Rect
          key={`${dx},${dy}`}
          x={dx!}
          y={dy!}
          width={2}
          height={2}
          color={MOTION.sparkle.color}
        />
      ))}
    </Group>
  );
}

/**
 * SPEC §11.1's "progress ring over the sim".
 *
 * A real swept arc: a unit circle path trimmed by `end`, which Skia accepts as a shared
 * value, so the sweep animates on the UI thread. Gold, because design.md §2 reserves
 * lantern gold for progress and reward moments. `opacity` hides it entirely at zero, so
 * an idle sim carries no ring.
 *
 * (The first attempt used a Circle with `opacity={progress}` — a fade, not a sweep, and
 * not what §11.1 asks for.)
 */
const RING_RADIUS = 5;

function ProgressRing({
  progress,
  cx,
  cy,
}: {
  progress: SharedValue<number>;
  cx: SharedValue<number>;
  cy: SharedValue<number>;
}) {
  // Path is built once at the origin; a Group transform moves it to the sim each frame.
  // Skia.Path.Circle, not Path.Make().addCircle() — the latter is deprecated in 2.6.2
  // and warned on every mount (found by reading the console in adversarial pass 3).
  const ring = useMemo(() => Skia.Path.Circle(0, 0, RING_RADIUS), []);
  const transform = useDerivedValue(() => [{ translateX: cx.value }, { translateY: cy.value }]);
  return (
    <Group transform={transform}>
      <Path
        path={ring}
        start={0}
        end={progress}
        color={theme.color.gold}
        style="stroke"
        strokeWidth={2}
        opacity={progress}
      />
    </Group>
  );
}

export const WORLD_TILE = TILE;
export const WORLD_CHAR = { w: CHAR_W, h: CHAR_H };
