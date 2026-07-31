import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { theme } from '../../ui/theme';
import {
  MOTION,
  effectFrame,
  motionProgress,
  resolveMotion,
  squashAt,
  type Motion,
} from '../motion';

/**
 * P6 T11 — design.md §10's motion rules and SPEC §11.6's reduced-motion contract.
 *
 * The contract worth testing hardest is the reduced-motion one: "kills pulses and parallax,
 * **keeps state changes**". Getting that wrong in the permissive direction makes the
 * setting a lie, and a per-component branch is how half the animations quietly stop
 * obeying it — which is why there is one table and one resolver.
 */

const ALL = Object.entries(MOTION) as [string, Motion][];

describe('design.md §10 constraints', () => {
  it('slides and squashes cards over 90 ms', () => {
    expect(MOTION.cardSlide.durationMs).toBe(90);
    expect(MOTION.cardRemove.durationMs).toBe(90);
  });

  it('runs the completion poof for four frames', () => {
    expect(MOTION.poof.frames).toBe(4);
  });

  it('spends gold on rewards and nothing else', () => {
    expect(MOTION.sparkle.color).toBe(theme.color.gold);
    expect(MOTION.sparkle.trigger).toBe('reward');
    const otherGold = ALL.filter(([name, m]) => name !== 'sparkle' && m.color === theme.color.gold);
    expect(otherGold).toEqual([]);
  });

  it('spends red on urgency and nothing else', () => {
    const red = ALL.filter(([, m]) => m.color === theme.color.red).map(([n]) => n);
    expect(red).toEqual(['urgentPulse']);
  });

  it('has no screen shake, and cannot grow one', () => {
    expect(Object.keys(MOTION)).not.toContain('shake');
    expect(Object.keys(MOTION).filter((n) => /shake|rumble/i.test(n))).toEqual([]);
  });

  it('gives every motion exactly one trigger', () => {
    for (const [, m] of ALL) expect(typeof m.trigger).toBe('string');
    // One trigger, one motion — the cue router's rule applied to pixels, so a single
    // event cannot fire two competing animations.
    const triggers = ALL.map(([, m]) => m.trigger);
    expect(new Set(triggers).size).toBe(triggers.length);
  });

  it('crossfades the lighting rather than cutting it', () => {
    expect(MOTION.lightingCrossfade.durationMs).toBeGreaterThan(0);
    expect(MOTION.lightingCrossfade.decorative).toBe(false);
  });

  it('makes the sim glance at the queue when it changes (SPEC §11.3)', () => {
    expect(MOTION.queueGlance.trigger).toBe('queue-changed');
  });
});

describe('reduced motion (SPEC §11.6)', () => {
  const reduced = { reducedMotion: true };
  const normal = { reducedMotion: false };

  it('kills every decorative motion', () => {
    for (const [name, m] of ALL) {
      if (!m.decorative) continue;
      const r = resolveMotion(m, reduced);
      expect({ name, durationMs: r.durationMs, frames: r.frames })
        .toEqual({ name, durationMs: 0, frames: 0 });
    }
  });

  it('keeps state changes — they arrive instead of travelling', () => {
    for (const [name, m] of ALL) {
      if (m.decorative) continue;
      const r = resolveMotion(m, reduced);
      expect(r.durationMs).toBe(0);
      // The end state survives: a card still moves, the recap still appears.
      expect({ name, frames: r.frames }).toEqual({ name, frames: m.frames });
      expect(r.squash).toBe(m.squash);
    }
  });

  it('changes nothing when the setting is off', () => {
    for (const [, m] of ALL) expect(resolveMotion(m, normal)).toEqual(m);
  });

  it('finishes instantly once resolved, so nothing waits on a zero-length tween', () => {
    expect(motionProgress(resolveMotion(MOTION.cardSlide, reduced), 0)).toBe(1);
    expect(effectFrame(resolveMotion(MOTION.poof, reduced), 0)).toBeNull();
  });
});

describe('every motion reaches a surface', () => {
  /**
   * The gate this file was missing.
   *
   * P6 shipped the table with full coverage and wired exactly one entry — `motion.test.ts`
   * passed throughout, because it asserts what the table *contains*, not that anything
   * draws it. A tested table with no consumer is indistinguishable from a finished feature
   * when you are reading test output, which is precisely why this walks source instead.
   */
  const repoRoot = resolve(__dirname, '../../..');

  function sourceFiles(dir: string): string[] {
    return readdirSync(resolve(repoRoot, dir)).flatMap((entry) => {
      const path = resolve(repoRoot, dir, entry);
      if (statSync(path).isDirectory()) {
        return entry === '__tests__' ? [] : sourceFiles(`${dir}/${entry}`);
      }
      return /\.tsx?$/.test(entry) ? [`${dir}/${entry}`] : [];
    });
  }

  const CONSUMERS = [
    ...sourceFiles('src/render'),
    ...sourceFiles('src/ui'),
    ...sourceFiles('src/application'),
  ].filter((file) => !file.endsWith('src/render/motion.ts'));

  const corpus = CONSUMERS.map((file) => readFileSync(resolve(repoRoot, file), 'utf8')).join('\n');

  it('is consumed by something that can actually draw it', () => {
    const orphans = Object.keys(MOTION).filter(
      (name) => !new RegExp(`MOTION\\.${name}\\b`).test(corpus),
    );
    expect(orphans).toEqual([]);
  });

  it('routes every animating consumer through resolveMotion, so §11.6 stays in one place', () => {
    // A surface that reached for its own `if (reducedMotion)` would be re-deriving the
    // accessibility contract, which is how half of a set of animations quietly stops
    // obeying it. "Animating" is the test, not "mentions a motion": a pure selector that
    // hands a motion to a resolver is doing the right thing, and `card-motion.ts` is one.
    const offenders = CONSUMERS.filter((file) => {
      const text = readFileSync(resolve(repoRoot, file), 'utf8');
      const animates = /Animated\.|useSharedValue|useDerivedValue/.test(text);
      const resolves = /resolveMotion|useMotionRun|squashInterpolation|useQueueGhosts/.test(text);
      return /\bMOTION\.\w+/.test(text) && animates && !resolves;
    });
    expect(offenders).toEqual([]);
  });
});

describe('motion arithmetic', () => {
  it('runs progress from 0 to 1 and clamps beyond', () => {
    expect(motionProgress(MOTION.cardSlide, 0)).toBe(0);
    expect(motionProgress(MOTION.cardSlide, 45)).toBeCloseTo(0.5, 5);
    expect(motionProgress(MOTION.cardSlide, 90)).toBe(1);
    expect(motionProgress(MOTION.cardSlide, 9000)).toBe(1);
    expect(motionProgress(MOTION.cardSlide, -5)).toBe(0);
  });

  it('returns a squash that overshoots and settles back to exactly 1', () => {
    // A squash that does not return to 1 leaves the card permanently the wrong size,
    // which is the failure mode of every hand-rolled spring.
    expect(squashAt(MOTION.cardSlide, 0)).toBeCloseTo(1, 6);
    expect(squashAt(MOTION.cardSlide, 45)).toBeGreaterThan(1);
    expect(squashAt(MOTION.cardSlide, 90)).toBeCloseTo(1, 6);
  });

  it('squashes a removal inward rather than outward', () => {
    expect(squashAt(MOTION.cardRemove, 45)).toBeLessThan(1);
  });

  it('returns 1 for motions with no squash', () => {
    expect(squashAt(MOTION.recapSlide, 50)).toBe(1);
  });

  it('walks a multi-frame effect and then reports it finished', () => {
    expect(effectFrame(MOTION.poof, 0)).toBe(0);
    expect(effectFrame(MOTION.poof, 100)).toBe(2);
    expect(effectFrame(MOTION.poof, 160)).toBeNull();
    expect(effectFrame(MOTION.recapSlide, 10)).toBeNull(); // zero-frame motion
  });

  it('fails soft on hostile elapsed values instead of producing NaN', () => {
    expect(motionProgress(MOTION.cardSlide, Number.NaN)).toBe(1);
    expect(Number.isFinite(squashAt(MOTION.cardSlide, Number.NaN))).toBe(true);
  });
});
