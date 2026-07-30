import { useEffect, useMemo, useRef } from 'react';
import {
  Atlas,
  FilterMode,
  Group,
  MipmapMode,
  Path,
  rect,
  Skia,
  useImage,
  useRSXformBuffer,
  useRectBuffer,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { content } from '../sim/content';
import type { RenderView } from '../sim/render-view';
import atlasIndexJson from '../../assets/generated/atlas-index.json';
import {
  advancePhase,
  buildCharacterQuad,
  buildDecorationQuads,
  buildStaticQuads,
  CHAR_H,
  CHAR_W,
  characterSprite,
  lookup,
  TILE,
  type AtlasIndex,
} from './scene-layout';

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

/** Every character sprite, flattened so a worklet can index it without object access. */
const CHAR_SPRITES: readonly string[] = (() => {
  const names = new Set<string>();
  for (const pose of ['walk', 'stand', 'sit', 'sleep'] as const) {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      names.add(characterSprite(pose, facing, 0));
      names.add(characterSprite(pose, facing, 0.75));
    }
  }
  return [...names].sort();
})();

/** Flat [x, y, w, h] per sprite index — plain numbers, worklet-safe. */
const CHAR_RECTS: readonly number[][] = CHAR_SPRITES.map((n) => {
  const r = lookup(index, n);
  return [r.x, r.y, r.w, r.h];
});
const CHAR_INDEX_OF: Record<string, number> = Object.fromEntries(CHAR_SPRITES.map((n, i) => [n, i]));

export interface WorldSceneProps {
  view: RenderView;
  /** Run-scoped game rewards; kept out of SimState and painted dynamically. */
  decorationIds?: readonly string[];
  /** Progress through the current tick, 0..1. Read fresh each frame. */
  alphaRef: () => number;
  scale: number;
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
  alphaRef,
  scale,
  effectiveSpeed,
}: WorldSceneProps) {
  const image = useImage(require('../../assets/generated/atlas.png'));

  // Static world: memoized, so this runs once per session.
  const staticScene = useMemo(() => {
    const quads = buildStaticQuads(content.homeMap, content.objects);
    return {
      sprites: quads.map((q) => {
        const r = lookup(index, q.sprite);
        return rect(r.x, r.y, r.w, r.h);
      }),
      transforms: quads.map((q) => Skia.RSXform(1, 0, q.x, q.y)),
    };
  }, []);
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

  const charX = useSharedValue(view.position.x * TILE);
  const charY = useSharedValue(view.position.y * TILE - (CHAR_H - TILE));
  const charSprite = useSharedValue(0);
  const ringProgress = useSharedValue(0);
  const ringX = useSharedValue(0);
  const ringY = useSharedValue(0);

  const charTransforms = useRSXformBuffer(1, (val) => {
    'worklet';
    val.set(1, 0, charX.value, charY.value);
  });

  const charRects = useRectBuffer(1, (val) => {
    'worklet';
    const r = CHAR_RECTS[charSprite.value] ?? CHAR_RECTS[0]!;
    val.setXYWH(r[0]!, r[1]!, r[2]!, r[3]!);
  });

  // ONE RAF for the component's lifetime.
  //
  // The first version listed `view` in its deps. `view` is a fresh object every tick, so
  // the effect tore down and remounted 2–8 times a second, resetting `phase` and the
  // frame timestamp each time — the walk cycle never actually ran, it just restarted
  // (adversarial pass 4). The watched-day test could not catch this: it never mounts
  // React. Latest inputs are read through a ref instead.
  const latest = useRef({ view, alphaRef, effectiveSpeed });
  latest.current = { view, alphaRef, effectiveSpeed };

  useEffect(() => {
    let raf = 0;
    let phase = 0;
    let last: number | null = null;
    const frame = (now: number) => {
      const { view: v, alphaRef: getAlpha, effectiveSpeed: speed } = latest.current;
      const delta = last === null ? 0 : now - last;
      last = now;
      // Game-time tempo: real-time delta × playback speed. Paused ⇒ 0 ⇒ frozen legs.
      phase = advancePhase(phase, delta * speed, v.mSpeed);
      const quad = buildCharacterQuad(v, getAlpha(), phase);
      charX.value = quad.x;
      charY.value = quad.y;
      charSprite.value = CHAR_INDEX_OF[quad.sprite] ?? 0;
      // §11.1: progress ring over the sim. Centred above the head.
      ringProgress.value = v.activityProgress ?? 0;
      ringX.value = quad.x + CHAR_W / 2;
      ringY.value = quad.y - 6;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [charX, charY, charSprite, ringProgress, ringX, ringY]);

  if (image === null) return null;
  return (
    <Group transform={[{ scale }]}>
      <Atlas
        image={image}
        sprites={staticScene.sprites}
        transforms={staticScene.transforms}
        sampling={NEAREST}
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
        color="#f0a840"
        style="stroke"
        strokeWidth={2}
        opacity={progress}
      />
    </Group>
  );
}

export const WORLD_TILE = TILE;
export const WORLD_CHAR = { w: CHAR_W, h: CHAR_H };
