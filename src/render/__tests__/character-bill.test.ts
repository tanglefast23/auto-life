import { content } from '../../sim/content';
import { APPEARANCE_PALETTES } from '../appearance';
import { CHARACTER_BILL, POSE_FRAMES, characterFrameShapes, renderCharacterFrame } from '../sprites/character';
import {
  auditBitmap,
  boxiness,
  formatReport,
  opaqueIslands,
  reportIsClean,
  silhouetteSignature,
} from '../../../scripts/art/validate-palette';

/**
 * P6 T4 — design.md §6's v1 character bill.
 *
 * P3 shipped nine frames and let `stand` and `sleep` both borrow others. These assertions
 * make that unreachable: every pose any activity declares must have authored frames, and
 * the atlas builder throws for an unauthored id rather than silently reusing a walk frame.
 */

const PALETTE = APPEARANCE_PALETTES['moss-green']!;
const render = (id: string) => renderCharacterFrame(id, PALETTE);

/** design.md §6's recount. Changing this number requires changing design.md first. */
const V1_FRAME_BILL = 48;

function boundingBox(id: string): { w: number; h: number } {
  const bmp = render(id);
  let minX = bmp.width;
  let minY = bmp.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.data[(y * bmp.width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1 };
}

describe('character bill (design.md §6)', () => {
  it('authors exactly the v1 bill', () => {
    expect(CHARACTER_BILL.length).toBe(V1_FRAME_BILL);
  });

  it('gives walk four frames in each of four directions', () => {
    for (const dir of ['down', 'up', 'left', 'right']) {
      expect(POSE_FRAMES[`walk-${dir}`]).toBe(4);
    }
  });

  it('matches design.md §6 frame counts pose by pose', () => {
    expect({
      sleep: POSE_FRAMES['sleep'], sit: POSE_FRAMES['sit'], eat: POSE_FRAMES['eat'],
      brush: POSE_FRAMES['brush'], shower: POSE_FRAMES['shower'], lift: POSE_FRAMES['lift'],
      run: POSE_FRAMES['run'], stretch: POSE_FRAMES['stretch'], practice: POSE_FRAMES['practice'],
      idle: POSE_FRAMES['idle'], toilet: POSE_FRAMES['toilet'], quickwash: POSE_FRAMES['quickwash'],
      nap: POSE_FRAMES['nap'],
    }).toEqual({
      sleep: 2, sit: 2, eat: 2, brush: 2, shower: 2, lift: 3, run: 4,
      stretch: 2, practice: 3, idle: 2, toilet: 1, quickwash: 1, nap: 2,
    });
  });

  it('authors the four preference idle variants design.md counts', () => {
    // Three come from content/identity.json and goals.json; the fourth is design.md §10's
    // droop state, which occupies the same authoring slot.
    for (const key of ['idle-window-gazing', 'idle-slow-stretching', 'idle-air-guitar', 'stand-droop']) {
      expect(POSE_FRAMES[key]).toBeGreaterThan(0);
    }
  });

  it('has frames for every pose an activity declares', () => {
    const missing = content.activities.activities
      .filter((a) => a.pose !== 'stand' && (POSE_FRAMES[a.pose] ?? 0) === 0)
      .map((a) => `${a.id} -> ${a.pose}`);
    expect(missing).toEqual([]);
  });

  it('spends no frame on `stand` — it aliases walk frame 0, as P3 had it', () => {
    expect(CHARACTER_BILL).not.toContain('stand-down-0');
    expect(silhouetteSignature(render('stand-down-0'))).toBe(silhouetteSignature(render('walk-down-0')));
  });

  it('keeps every frame on-palette, extreme-free and non-empty, in every appearance', () => {
    for (const [id, palette] of Object.entries(APPEARANCE_PALETTES)) {
      for (const frame of CHARACTER_BILL) {
        const report = auditBitmap(`${id}/${frame}`, renderCharacterFrame(frame, palette), 'character');
        if (!reportIsClean(report)) throw new Error(formatReport(report));
      }
    }
  });

  it('makes every non-walk pose distinguishable from standing in flat Ink', () => {
    const stand = silhouetteSignature(render('walk-down-0'));
    const same = ['sleep', 'sit', 'eat', 'brush', 'shower', 'lift', 'run', 'stretch',
      'practice', 'toilet', 'quickwash', 'nap', 'stand-droop']
      .filter((pose) => silhouetteSignature(render(`${pose}-0`)) === stand);
    expect(same).toEqual([]);
  });

  it('gives every frame within a pose a distinct silhouette — a 4-frame cycle is really 4', () => {
    const clashes: string[] = [];
    for (const [key, frames] of Object.entries(POSE_FRAMES)) {
      const seen = new Map<string, string>();
      for (let i = 0; i < frames; i++) {
        const id = `${key}-${i}`;
        const sig = silhouetteSignature(render(id));
        const prev = seen.get(sig);
        if (prev !== undefined) clashes.push(`${id} === ${prev}`);
        seen.set(sig, id);
      }
    }
    // The first walk cycle used lift = [0,1,0,1], which made frames 0 and 2 byte-identical:
    // a four-frame cycle that was really two. At 1x that reads as a slightly stiff walk,
    // which is exactly the kind of thing only a machine notices.
    expect(clashes).toEqual([]);
  });

  it('accepts that up and down share a silhouette — A0 proved it and the face carries direction', () => {
    // evidence/A0.md: "A symmetric chibi cannot express toward/away in outline; this is
    // normal for the genre. It is asserted as a test so it can never drift silently."
    // The consequence A0 recorded is that the face and hair layers are load-bearing, which
    // is why every front-facing frame draws a face.
    for (let i = 0; i < 4; i++) {
      expect(silhouetteSignature(render(`walk-up-${i}`))).toBe(silhouetteSignature(render(`walk-down-${i}`)));
    }
    // Down draws a face; up does not. That is the only difference, and it must exist.
    const down = render('walk-down-0');
    const up = render('walk-up-0');
    expect(Buffer.from(down.data).equals(Buffer.from(up.data))).toBe(false);
  });

  it('keeps the profile facings distinct from the front ones', () => {
    const down = silhouetteSignature(render('walk-down-0'));
    expect(silhouetteSignature(render('walk-left-0'))).not.toBe(down);
    expect(silhouetteSignature(render('walk-right-0'))).not.toBe(down);
  });

  it('closes A0: the seated frame is no longer a squat block', () => {
    // A0 handed forward "seated frame reads as a squat block; wants a real pass". A block
    // scores ~1.0 and is as tall as it is deep; a real seated pose is shorter than standing
    // and carries a visible thigh-then-shin step.
    expect(boxiness(render('sit-0'))).toBeLessThan(0.85);
    expect(boundingBox('sit-0').h).toBeLessThan(boundingBox('walk-down-0').h);
    expect(silhouetteSignature(render('sit-0'))).not.toBe(silhouetteSignature(render('nap-0')));
  });

  it('closes A0: no frame has a detached fragment, in any appearance', () => {
    // "Slim mitten hands read slightly detached at 1x" — structural, so checked
    // structurally rather than by looking at a sheet nobody reopens.
    const detached: string[] = [];
    for (const [name, palette] of Object.entries(APPEARANCE_PALETTES)) {
      for (const frame of CHARACTER_BILL) {
        const islands = opaqueIslands(renderCharacterFrame(frame, palette));
        if (islands.some((n) => n < 6)) detached.push(`${name}/${frame}: ${islands.join(',')}`);
      }
    }
    expect(detached).toEqual([]);
  });

  it('throws for an unauthored frame instead of silently reusing a walk frame', () => {
    expect(() => characterFrameShapes('flying-0', PALETTE)).toThrow(/no authored character frame/);
  });
});
