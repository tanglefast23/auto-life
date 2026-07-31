import { A0_BODY_FRAMES, A0_HAIR, A0_OUTFIT } from '../../src/render/sprites/a0';
import {
  deriveSlim,
  opaqueCount,
  rasterize,
  silhouette,
  SPRITE_H,
  SPRITE_W,
  torsoWidth,
  type BodyFrame,
} from '../../src/render/sprite-spec';
import { PALETTE_57, PALETTE_SET } from '../../src/render/palette';
import { auditBitmap, findForbiddenExtremes, findPaletteViolations } from '../art/validate-palette';
import { createBitmap, encodePng, type Bitmap } from '../art/png';

/**
 * design.md §12 step 4 as a CI gate, plus the A0 claims (master §5 A0 row).
 * The art-side twin of validate-content: a palette violation is mechanical, never
 * a review opinion.
 */

const frameOf = (f: BodyFrame, i = 0): Bitmap =>
  rasterize({ frame: f, frameIndex: i, hair: A0_HAIR, outfit: A0_OUTFIT });

const byId = (id: string): BodyFrame => {
  const f = A0_BODY_FRAMES.find((x) => x.id === id);
  if (!f) throw new Error(`no A0 frame ${id}`);
  return f;
};

/** Count contiguous opaque horizontal runs on one row — how limb separation is measured. */
function runsAt(bmp: Bitmap, y: number): number {
  let runs = 0;
  let inRun = false;
  for (let x = 0; x < bmp.width; x++) {
    const opaque = bmp.data[(y * bmp.width + x) * 4 + 3] !== 0;
    if (opaque && !inRun) runs++;
    inRun = opaque;
  }
  return runs;
}

describe('palette validator', () => {
  test('the locked palette is 57 distinct colours (design.md §2)', () => {
    expect(PALETTE_57.length).toBe(57);
    expect(PALETTE_SET.size).toBe(57);
  });

  test('catches an off-palette pixel', () => {
    const bmp = createBitmap(2, 1);
    bmp.data.set([0x12, 0x34, 0x56, 255], 0);
    const v = findPaletteViolations(bmp);
    expect(v).toHaveLength(1);
    expect(v[0]!.hex).toBe('#123456');
  });

  test('catches partial alpha — §13 forbids anti-aliasing', () => {
    const bmp = createBitmap(1, 1);
    bmp.data.set([0x2e, 0x21, 0x19, 128], 0); // Ink, but half-transparent
    expect(findPaletteViolations(bmp)).toHaveLength(1);
  });

  test('catches pure black but admits HFM shared White (§13)', () => {
    const black = createBitmap(1, 1);
    black.data.set([0, 0, 0, 255], 0);
    const white = createBitmap(1, 1);
    white.data.set([255, 255, 255, 255], 0);
    expect(findForbiddenExtremes(black)).toHaveLength(1);
    expect(findForbiddenExtremes(white)).toHaveLength(0);
  });

  test('passes a fully transparent region', () => {
    expect(findPaletteViolations(createBitmap(4, 4))).toHaveLength(0);
  });
});

describe('A0 sprites', () => {
  test('every frame of both builds is palette-clean and non-empty', () => {
    for (const base of A0_BODY_FRAMES) {
      for (const frame of [base, deriveSlim(base)]) {
        const bmp = frameOf(frame, frame.id.endsWith('-1') ? 1 : 0);
        const report = auditBitmap(frame.id, bmp, 'character');
        expect(report.paletteViolations).toEqual([]);
        expect(report.forbiddenExtremes).toEqual([]);
        expect(report.opaquePixels).toBeGreaterThan(200);
        expect(bmp.width).toBe(SPRITE_W);
        expect(bmp.height).toBe(SPRITE_H);
      }
    }
  });

  test('the A0 bill is complete: walk ×4 directions ×2 frames, plus a seated action', () => {
    const ids = A0_BODY_FRAMES.map((f) => f.id);
    for (const dir of ['down', 'up', 'left', 'right']) {
      expect(ids).toContain(`average-walk-${dir}-0`);
      expect(ids).toContain(`average-walk-${dir}-1`);
    }
    expect(ids).toContain('average-sit-down');
    expect(A0_BODY_FRAMES).toHaveLength(9);
  });

  test('the encoder round-trips to a valid PNG', () => {
    const png = encodePng(frameOf(byId('average-walk-down-0')));
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe('IHDR');
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND');
  });
});

describe('A0 claim 1: one authored hair overlay rides every frame via the head anchor', () => {
  test('hair moves with the head anchor and is never authored per frame', () => {
    // The seated frame drops the head 6px. If the anchor system works, the SAME hair
    // shapes land 6px lower with zero extra authoring.
    const walk = byId('average-walk-down-0');
    const sit = byId('average-sit-down');
    expect(sit.anchors.head.y - walk.anchors.head.y).toBe(6);

    const topmostHairRow = (f: BodyFrame): number => {
      const withHair = rasterize({ frame: f, hair: A0_HAIR });
      const bare = rasterize({ frame: f });
      for (let y = 0; y < SPRITE_H; y++) {
        for (let x = 0; x < SPRITE_W; x++) {
          const i = (y * SPRITE_W + x) * 4;
          if (withHair.data[i + 3] !== 0 && bare.data[i + 3] === 0) return y;
        }
      }
      return -1;
    };
    expect(topmostHairRow(sit) - topmostHairRow(walk)).toBe(6);
  });

  test('hair is a single overlay, not a per-frame asset', () => {
    // The whole v6 cost claim: 10 hair styles cost 10 sprites, not 10 × 48 frames.
    expect(A0_HAIR.anchor).toBe('head');
    expect(A0_HAIR.shapes.length).toBeGreaterThan(0);
  });

  test('the outfit covers every direction and bobs with the walk loop', () => {
    for (const dir of ['down', 'up', 'left', 'right'] as const) {
      expect(A0_OUTFIT.perDir[dir].length).toBeGreaterThan(0);
    }
    const f = byId('average-walk-down-0');
    expect(opaqueCount(frameOf(f, 0))).not.toBe(0);
    // Frame 1 rides 1px lower, so the composites differ without a second authored set.
    const a = frameOf(f, 0);
    const b = frameOf(f, 1);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(false);
  });
});

describe('A0 claim 2: slim is offset-derived, never redrawn', () => {
  const frontIds = ['average-walk-down-0', 'average-walk-up-0'];

  test('slim narrows the torso on front-facing frames', () => {
    for (const id of frontIds) {
      const avg = frameOf(byId(id));
      const slim = frameOf(deriveSlim(byId(id)));
      expect(torsoWidth(slim)).toBeLessThan(torsoWidth(avg));
    }
  });

  test('slim never breaks a limb into disconnected columns', () => {
    // Regression for A0 finding 1: narrowing 3px arms produced dotted limbs.
    // Every arm row must stay a single contiguous mass with the torso.
    for (const id of frontIds) {
      for (const frame of [byId(id), deriveSlim(byId(id))]) {
        expect(runsAt(frameOf(frame), 28)).toBe(1);
      }
    }
  });

  test('slim never merges the stance', () => {
    // Regression for A0 finding 3: pulling both legs inward collided them.
    for (const id of frontIds) {
      for (const frame of [byId(id), deriveSlim(byId(id))]) {
        expect(runsAt(frameOf(frame), 42)).toBe(2);
      }
    }
  });

  test('slim leaves the head untouched — a narrower body, not a narrower skull', () => {
    const headRow = 10;
    for (const id of frontIds) {
      const avg = frameOf(byId(id));
      const slim = frameOf(deriveSlim(byId(id)));
      const widthAt = (b: Bitmap, y: number) => {
        let n = 0;
        for (let x = 0; x < b.width; x++) if (b.data[(y * b.width + x) * 4 + 3] !== 0) n++;
        return n;
      };
      expect(widthAt(slim, headRow)).toBe(widthAt(avg, headRow));
    }
  });
});

describe('A0 claim 3: silhouettes read in flat Ink (design.md §6)', () => {
  test('every silhouette is substantial and matches its composite mass', () => {
    for (const base of A0_BODY_FRAMES) {
      const bmp = frameOf(base);
      const sil = silhouette(bmp);
      expect(opaqueCount(sil)).toBe(opaqueCount(bmp));
      expect(opaqueCount(sil)).toBeGreaterThan(200);
    }
  });

  test('profile facings are distinguishable from front facings in silhouette', () => {
    const front = torsoWidth(frameOf(byId('average-walk-down-0')));
    const left = torsoWidth(frameOf(byId('average-walk-left-0')));
    const right = torsoWidth(frameOf(byId('average-walk-right-0')));
    expect(left).toBeLessThan(front);
    expect(right).toBeLessThan(front);
  });

  test('ACCEPTED LIMITATION: up and down share a silhouette — facing rides the face layer', () => {
    // Recorded, not fixed. A symmetric chibi cannot distinguish toward/away by outline;
    // that is normal for the genre. The consequence is a P3 constraint, not an art bug:
    // the face/hair layers are load-bearing for direction and cannot be cut from the Atlas.
    const down = silhouette(rasterize({ frame: byId('average-walk-down-0') }));
    const up = silhouette(rasterize({ frame: byId('average-walk-up-0') }));
    expect(Buffer.from(down.data).equals(Buffer.from(up.data))).toBe(true);

    // ...and the composites DO differ, because the face layer carries it.
    const downFull = frameOf(byId('average-walk-down-0'));
    const upFull = frameOf(byId('average-walk-up-0'));
    expect(Buffer.from(downFull.data).equals(Buffer.from(upFull.data))).toBe(false);
  });

  test('the seated action is distinguishable from every walk frame', () => {
    const sit = frameOf(byId('average-sit-down'));
    for (const f of A0_BODY_FRAMES.filter((x) => x.id.includes('walk'))) {
      expect(Buffer.from(sit.data).equals(Buffer.from(frameOf(f).data))).toBe(false);
    }
    // Sitting is shorter: its lowest opaque row is above the standing feet.
    const lowest = (b: Bitmap) => {
      for (let y = b.height - 1; y >= 0; y--) {
        for (let x = 0; x < b.width; x++) if (b.data[(y * b.width + x) * 4 + 3] !== 0) return y;
      }
      return -1;
    };
    expect(lowest(sit)).toBeLessThan(lowest(frameOf(byId('average-walk-down-0'))));
  });
});
