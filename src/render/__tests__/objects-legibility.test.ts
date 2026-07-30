import { content } from '../../sim/content';
import { OBJECT_SPRITES, renderObject } from '../sprites/objects';
import {
  auditBitmap,
  boxiness,
  formatReport,
  reportIsClean,
  silhouetteSignature,
} from '../../../scripts/art/validate-palette';

/**
 * P6 T2 — the gate that answers "I just see a square and I don't know what that object is".
 *
 * P3 drew all fifteen objects with one `box()` call, so they differed only in ramp colour.
 * These assertions make that state unreachable: a plain rectangle scores `boxiness` 1.0
 * and two colour-only variants share a silhouette signature, so neither can pass.
 */

const TILE = 32;

/** The ceiling. A filled rectangle is exactly 1.0; anything at or above this reads as a box. */
const MAX_BOXINESS = 0.92;

describe('object sprites (design.md §6 silhouette-first, §11 bill, §12 checklist)', () => {
  it('authors a sprite for every object in content, and nothing extra', () => {
    const authored = new Set(Object.keys(OBJECT_SPRITES));
    const inContent = content.objects.objects.map((o) => o.id);
    for (const id of inContent) expect(authored.has(id)).toBe(true);
    expect(authored.size).toBe(inContent.length);
  });

  it('sizes every sprite to its declared footprint', () => {
    for (const o of content.objects.objects) {
      const xs = o.footprint.map(([x]) => x);
      const ys = o.footprint.map(([, y]) => y);
      const bmp = renderObject(o.id);
      expect({ id: o.id, w: bmp.width, h: bmp.height }).toEqual({
        id: o.id,
        w: (Math.max(...xs) - Math.min(...xs) + 1) * TILE,
        h: (Math.max(...ys) - Math.min(...ys) + 1) * TILE,
      });
    }
  });

  it('passes the full palette, extremes, and Track-B outline-role audit', () => {
    for (const o of content.objects.objects) {
      for (const state of ['idle', 'active'] as const) {
        if (state === 'active' && OBJECT_SPRITES[o.id]!.active === undefined) continue;
        const report = auditBitmap(`${o.id}.${state}`, renderObject(o.id, state), 'world');
        if (!reportIsClean(report)) throw new Error(formatReport(report));
      }
    }
  });

  // The regression that matters. A flat `box()` scores exactly 1.0.
  it('is never a plain filled rectangle', () => {
    const scores = content.objects.objects.map((o) => ({
      id: o.id,
      boxiness: Number(boxiness(renderObject(o.id)).toFixed(3)),
    }));
    const boxes = scores.filter((s) => s.boxiness >= MAX_BOXINESS);
    expect(boxes).toEqual([]);
  });

  it('keeps active states non-rectangular too', () => {
    const boxes = content.objects.objects
      .filter((o) => OBJECT_SPRITES[o.id]!.active !== undefined)
      .map((o) => ({ id: o.id, boxiness: Number(boxiness(renderObject(o.id, 'active')).toFixed(3)) }))
      .filter((s) => s.boxiness >= MAX_BOXINESS);
    expect(boxes).toEqual([]);
  });

  it('gives every object a silhouette no other object shares', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const o of content.objects.objects) {
      const sig = silhouetteSignature(renderObject(o.id));
      const other = seen.get(sig);
      if (other !== undefined) clashes.push(`${o.id} === ${other}`);
      seen.set(sig, o.id);
    }
    expect(clashes).toEqual([]);
  });

  it('makes each active state visibly different from its own idle state', () => {
    const identical: string[] = [];
    for (const o of content.objects.objects) {
      if (OBJECT_SPRITES[o.id]!.active === undefined) continue;
      const idle = silhouetteSignature(renderObject(o.id, 'idle'));
      const active = silhouetteSignature(renderObject(o.id, 'active'));
      // Sink and rug change fill rather than outline, so compare pixels for those.
      const samePixels =
        Buffer.from(renderObject(o.id, 'idle').data).equals(Buffer.from(renderObject(o.id, 'active').data));
      if (idle === active && samePixels) identical.push(o.id);
    }
    expect(identical).toEqual([]);
  });

  it('authors an active state for exactly the objects that host an activity (SPEC §10)', () => {
    const withActive = content.objects.objects
      .filter((o) => OBJECT_SPRITES[o.id]!.active !== undefined)
      .map((o) => o.id)
      .sort();
    const hostingActivities = content.objects.objects
      .filter((o) => o.activities.length > 0)
      .map((o) => o.id)
      .sort();
    // counter, tv and wardrobe host nothing, so authoring an active frame for them would
    // be art the atlas packs and the game can never show.
    expect(withActive).toEqual(hostingActivities);
  });

  it('leaves no object drawn as a single solid colour', () => {
    const flat = content.objects.objects
      .map((o) => ({ id: o.id, colours: auditBitmap(o.id, renderObject(o.id)).distinctColours }))
      .filter((s) => s.colours < 2);
    expect(flat).toEqual([]);
  });
});
