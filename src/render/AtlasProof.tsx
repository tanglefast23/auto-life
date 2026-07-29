import { Atlas, rect, Skia, useImage, type SkRSXform } from '@shopify/react-native-skia';
import atlasIndex from '../../assets/generated/atlas-index.json';

/**
 * P3 T2 — the Atlas-on-exported-web proof.
 *
 * P0's lesson: "the API exists" and "it works in the exported build" are different
 * claims. `expo-sqlite`'s web driver declared support and then hung, which is why
 * `persistence/kv` exists at all. `drawAtlas` is a different CanvasKit path from the
 * `Rect` P0 proved, so it gets its own proof before the whole scene is built on it.
 *
 * Draws every tile sprite plus three character frames from ONE texture in ONE Atlas
 * call. A blank canvas, a single sprite, or garbled sub-rects each fail differently
 * and visibly.
 */

const SPRITES = atlasIndex.sprites as Record<string, { x: number; y: number; w: number; h: number }>;

const PROOF_NAMES = [
  'tile.bedroom',
  'tile.bathroom',
  'tile.living',
  'tile.kitchen',
  'tile.hall',
  'tile.wall',
  'char.walk-down-0',
  'char.walk-left-0',
  'char.sit-down',
];

export const ATLAS_PROOF_SPRITE_COUNT = PROOF_NAMES.length;

export function AtlasProof({ scale = 2 }: { scale?: number }) {
  const image = useImage(require('../../assets/generated/atlas.png'));

  const sprites = PROOF_NAMES.map((n) => {
    const s = SPRITES[n];
    if (!s) throw new Error(`atlas index has no sprite "${n}" — regenerate with npm run art:atlas`);
    return rect(s.x, s.y, s.w, s.h);
  });

  // RSXform(scos, ssin, tx, ty): scos = scale·cos θ, ssin = scale·sin θ. No rotation here.
  let cursorX = 4;
  const transforms: SkRSXform[] = PROOF_NAMES.map((n) => {
    const s = SPRITES[n]!;
    const x = cursorX;
    cursorX += s.w * scale + 4;
    return Skia.RSXform(scale, 0, x, 4);
  });

  if (image === null) return null;
  return <Atlas image={image} sprites={sprites} transforms={transforms} />;
}
