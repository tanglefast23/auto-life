import { GameLoop, msPerTick } from '../../application/loop';
import { newGameState } from '../../sim/state';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { objectForActivityIn } from '../../sim/content';
import { solveScale, HUD_H } from '../scale';
import { bandFor } from '../../ui/bands';

/**
 * Regressions for adversarial pass 4 (codex, gpt-5.6-sol at max reasoning).
 * Every test below is a defect that existed and was reproduced before being fixed.
 */

const fresh = () => newGameState('baseline', content.rates, 1234, content.perks);

describe('BLOCKER: pause carries normalised progress, not raw milliseconds', () => {
  test('pause then a speed change does not run unseen ticks', () => {
    // Was: 400ms banked at 1x survived a pause as RAW ms; against 4x's 125ms tick that
    // is three ticks, so the very next advance(0) ran three ticks the player never saw.
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(1);
    loop.advance(400);
    expect(loop.stats.ticksRun).toBe(0);
    loop.setSpeed(0);
    loop.setSpeed(4);
    const before = loop.stats.ticksRun;
    loop.advance(0);
    expect(loop.stats.ticksRun).toBe(before);
  });

  test('alpha is continuous across pause and resume', () => {
    // Was: 0.8 -> 0 (pause) -> 1 (resume at 4x).
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(1);
    loop.advance(400);
    expect(loop.alpha).toBeCloseTo(0.8, 6);
    loop.setSpeed(0);
    expect(loop.alpha).toBeCloseTo(0.8, 6);
    loop.setSpeed(4);
    expect(loop.alpha).toBeCloseTo(0.8, 6);
  });

  test('system pause carries progress the same way', () => {
    const loop = new GameLoop(fresh(), content);
    loop.setSpeed(2);
    loop.advance(msPerTick(2) * 0.6);
    const held = loop.alpha;
    loop.setSystemPaused(true);
    expect(loop.alpha).toBeCloseTo(held, 6);
    loop.setSystemPaused(false);
    expect(loop.alpha).toBeCloseTo(held, 6);
    const before = loop.stats.ticksRun;
    loop.advance(0);
    expect(loop.stats.ticksRun).toBe(before);
  });

  test('a pause/resume cycle never invents or loses a tick over a long run', () => {
    const steady = new GameLoop(fresh(), content);
    steady.setSpeed(1);
    for (let i = 0; i < 200; i++) steady.advance(500);

    const churned = new GameLoop(fresh(), content);
    churned.setSpeed(1);
    for (let i = 0; i < 200; i++) {
      churned.advance(250);
      churned.setSpeed(0);
      churned.setSpeed(1);
      churned.advance(250);
    }
    expect(churned.stats.ticksRun).toBe(steady.stats.ticksRun);
    expect(JSON.stringify(churned.peekState())).toBe(JSON.stringify(steady.peekState()));
  });
});

describe('MAJOR: the progress ring can actually complete', () => {
  test('activityProgress reaches 1 on the completion tick', () => {
    // Was: 0 -> 0.33 -> 0.67 -> null. The ring vanished at 67% instead of closing,
    // because post-step `current` is already null when an activity completes.
    const loop = new GameLoop(fresh(), content);
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      const p = loop.runOneTick().render.activityProgress;
      if (p !== null) seen.push(p);
    }
    expect(seen.length).toBeGreaterThan(3);
    expect(Math.max(...seen)).toBe(1);
  });

  test('progress is always within [0,1]', () => {
    const loop = new GameLoop(fresh(), content);
    for (let i = 0; i < 300; i++) {
      const p = loop.runOneTick().render.activityProgress;
      if (p === null) continue;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('MAJOR: facing', () => {
  test('idle holds the last facing instead of snapping to down', () => {
    // The RenderView contract already promised "holds last value when still" while the
    // code returned 'down' unconditionally, so finishing the toilet facing up snapped
    // the sprite 180 degrees during every one-tick gap between activities.
    const loop = new GameLoop(fresh(), content);
    let lastCompletedFacing: string | null = null;
    for (let i = 0; i < 60; i++) {
      const s = loop.runOneTick();
      const st = loop.peekState();
      if (st.current === null && st.lastCompletion !== null) {
        try {
          lastCompletedFacing = objectForActivityIn(content, st.lastCompletion.activityId).facing;
        } catch {
          continue;
        }
        expect(s.render.facing).toBe(lastCompletedFacing);
        return;
      }
    }
    expect(lastCompletedFacing).not.toBeNull();
  });

  test('facing never disagrees with the direction the sprite is being drawn', () => {
    // Was: facing used path.length while the interpolator used path.length - 1, so on a
    // multi-corner journey the sprite faced down while sliding left.
    const loop = new GameLoop(fresh(), content);
    for (let i = 0; i < 80; i++) {
      const s = loop.runOneTick();
      const t = s.render.travel;
      if (t === null || t.path.length < 2) continue;
      const span = t.path.length - 1;
      const prog = (Math.min(t.totalTicks, t.elapsedTicks) / Math.max(1, t.totalTicks)) * span;
      const idx = Math.min(span, Math.floor(prog));
      const here = t.path[idx]!;
      const next = t.path[Math.min(span, idx + 1)]!;
      const dx = next.x - here.x;
      const dy = next.y - here.y;
      if (dx === 0 && dy === 0) continue;
      const expected = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      expect(s.render.facing).toBe(expected);
    }
  });
});

describe('MAJOR: published snapshots are immutable', () => {
  test('assigning to a snapshot bar does not corrupt it', () => {
    // Was: snapshot.bars.energy = -999 stuck, poisoning every HUD consumer until the
    // next tick published.
    const loop = new GameLoop(fresh(), content);
    const s = loop.runOneTick();
    const real = s.bars.energy;
    // Assignment to a frozen object throws only in strict mode and is a silent no-op
    // otherwise. Either is fine — the claim being defended is that the value cannot be
    // corrupted, so assert that directly rather than asserting a throw the module mode
    // may not produce.
    (s.bars as Record<string, number>).energy = -999;
    expect(s.bars.energy).toBe(real);
    expect(Object.isFrozen(s.bars)).toBe(true);
    expect(Object.isFrozen(s)).toBe(true);
  });

  test('the render block and its travel path are frozen too', () => {
    const loop = new GameLoop(fresh(), content);
    let s = loop.runOneTick();
    for (let i = 0; i < 6 && s.render.travel === null; i++) s = loop.runOneTick();
    expect(Object.isFrozen(s.render)).toBe(true);
    expect(Object.isFrozen(s.render.position)).toBe(true);
    if (s.render.travel !== null) {
      expect(Object.isFrozen(s.render.travel)).toBe(true);
      expect(Object.isFrozen(s.render.travel.path)).toBe(true);
    }
  });
});

describe('MAJOR: the HUD reservation matches the HUD that exists', () => {
  test('the reserved height is large enough for the seven-row health block', () => {
    // Was 48px against a panel that is far taller, so the HUD overlaid the top of the
    // world — including the starting character — while tooSmall still read false.
    expect(HUD_H).toBeGreaterThanOrEqual(140);
  });

  test('a small-but-valid desktop viewport no longer claims to fit', () => {
    const s = solveScale({ width: 800, height: 568, devicePixelRatio: 1 });
    expect(s.tooSmall).toBe(true);
  });

  test('a normal desktop viewport still fits with the larger reservation', () => {
    const s = solveScale({ width: 1470, height: 956, devicePixelRatio: 2 });
    expect(s.tooSmall).toBe(false);
    expect(s.height).toBeLessThanOrEqual(s.available.height);
  });
});

describe('MAJOR: the Health bar uses the configured bands', () => {
  test('a Day-1 Health around 60 lands in the warning band, not normal', () => {
    // Was: the main Health bar was pinned to band="normal", so the 40-69 edge tick
    // could never appear on the one bar the player looks at first.
    expect(bandFor('nutrition', 59.74, content.rates).band).toBe('tick');
    expect(bandFor('nutrition', 75, content.rates).band).toBe('normal');
    expect(bandFor('nutrition', 20, content.rates).band).toBe('alert');
  });
});
