import { useEffect, useMemo, useRef, useState } from 'react';
import { Atlas, Group, rect, Skia, useImage, type SkRSXform } from '@shopify/react-native-skia';
import { content } from '../sim/content';
import type { RenderView } from '../sim/render-view';
import atlasIndexJson from '../../assets/generated/atlas-index.json';
import {
  advancePhase,
  buildCharacterQuad,
  buildStaticQuads,
  CHAR_H,
  CHAR_W,
  lookup,
  TILE,
  type AtlasIndex,
} from './scene-layout';

const index = atlasIndexJson as AtlasIndex;

/**
 * The Skia scene (P3 T6).
 *
 * Master §9: Atlas is mandatory from the first sprite renderer — never one component
 * per sprite. The 24×14 tilemap plus 14 objects is 350 quads; as components that would
 * be 350 React nodes reconciled per change.
 *
 * Two Atlas calls, split by how often they change:
 *  - the static world (tiles + objects) is built once and memoized — it cannot change
 *    during a run, so it never re-uploads;
 *  - the character is one quad whose transform is rebuilt per animation frame.
 *
 * Sub-tick motion never passes through React state. The animation frame reads position
 * straight off the loop, so React re-renders at snapshot rate (≤8/s at 4×) while the
 * sim glides at display rate.
 */

export interface WorldSceneProps {
  view: RenderView;
  /** Progress through the current tick, 0..1. Read fresh each frame. */
  alphaRef: () => number;
  scale: number;
}

export function WorldScene({ view, alphaRef, scale }: WorldSceneProps) {
  const image = useImage(require('../../assets/generated/atlas.png'));

  // Static world: memoized on content identity, so this runs once per session.
  const staticScene = useMemo(() => {
    const quads = buildStaticQuads(content.homeMap, content.objects);
    const sprites = quads.map((q) => {
      const r = lookup(index, q.sprite);
      return rect(r.x, r.y, r.w, r.h);
    });
    const transforms = quads.map((q) => Skia.RSXform(1, 0, q.x, q.y));
    return { sprites, transforms };
  }, []);

  // The character's sprite RECT changes only when the frame changes (a few times per
  // second), so it can live in React state without churn. Its POSITION changes every
  // frame and is handled below without React.
  const [charSprite, setCharSprite] = useState(() => buildCharacterQuad(view, 0, 0).sprite);
  const charTransform = useRef<SkRSXform>(Skia.RSXform(1, 0, 0, 0));
  const [, forceFrame] = useState(0);
  const phase = useRef(0);
  const lastFrameMs = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (nowMs: number) => {
      const prev = lastFrameMs.current;
      lastFrameMs.current = nowMs;
      const deltaMs = prev === null ? 0 : Math.min(100, nowMs - prev);

      phase.current = advancePhase(phase.current, deltaMs, view.mSpeed);
      const quad = buildCharacterQuad(view, alphaRef(), phase.current);
      charTransform.current.set(1, 0, quad.x, quad.y);
      if (quad.sprite !== charSprite) setCharSprite(quad.sprite);
      // One cheap state bump per frame drives the redraw; the heavy static Atlas is
      // memoized and unaffected by it.
      forceFrame((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view, alphaRef, charSprite]);

  const charRect = useMemo(() => {
    const r = lookup(index, charSprite);
    return [rect(r.x, r.y, r.w, r.h)];
  }, [charSprite]);

  if (image === null) return null;
  return (
    <Group transform={[{ scale }]}>
      <Atlas image={image} sprites={staticScene.sprites} transforms={staticScene.transforms} />
      <Atlas image={image} sprites={charRect} transforms={[charTransform.current]} />
    </Group>
  );
}

export const WORLD_TILE = TILE;
export const WORLD_CHAR = { w: CHAR_W, h: CHAR_H };
