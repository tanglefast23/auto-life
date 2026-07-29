import { useEffect, useMemo } from 'react';
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
 * Master §9: Atlas is mandatory from the first sprite renderer. Two Atlas calls, split
 * by change rate — the 350-quad static world is memoized and never re-uploads; the
 * character is one quad.
 *
 * **Nothing here re-renders React per frame.** The character's position and sprite live
 * in Reanimated shared values that a single RAF writes; `useRSXformBuffer` /
 * `useRectBuffer` run their modifiers as UI-thread mappers and call `notifyChange`, so
 * Skia repaints without touching the React tree. The first version bumped React state
 * every frame — roughly 43,200 reconciliations per 1× day, and it kept going while
 * paused (adversarial pass 2).
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

export function WorldScene({ view, alphaRef, scale, effectiveSpeed }: WorldSceneProps) {
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

  // One RAF. It writes shared values only — no setState, so React never re-renders here.
  useEffect(() => {
    let raf = 0;
    let phase = 0;
    let last: number | null = null;
    const frame = (now: number) => {
      const delta = last === null ? 0 : now - last;
      last = now;
      // Game-time tempo: real-time delta × playback speed. Paused ⇒ 0 ⇒ frozen legs.
      phase = advancePhase(phase, delta * effectiveSpeed, view.mSpeed);
      const quad = buildCharacterQuad(view, alphaRef(), phase);
      charX.value = quad.x;
      charY.value = quad.y;
      charSprite.value = CHAR_INDEX_OF[quad.sprite] ?? 0;
      // §11.1: progress ring over the sim. Centred above the head.
      ringProgress.value = view.activityProgress ?? 0;
      ringX.value = quad.x + CHAR_W / 2;
      ringY.value = quad.y - 6;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [view, alphaRef, effectiveSpeed, charX, charY, charSprite, ringProgress, ringX, ringY]);

  if (image === null) return null;
  return (
    <Group transform={[{ scale }]}>
      <Atlas
        image={image}
        sprites={staticScene.sprites}
        transforms={staticScene.transforms}
        sampling={NEAREST}
      />
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
  const ring = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(0, 0, RING_RADIUS);
    return p;
  }, []);
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
