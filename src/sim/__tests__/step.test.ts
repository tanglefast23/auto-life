import { step, type Command } from '../step';
import { newGameState, restoreSimState, type SimState } from '../state';
import { PrngStreams } from '../prng';
import { toDisplay, toFixed } from '../fixed';
import { content } from '../content';

const fresh = (): SimState => newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

const run = (s: SimState, ticks: number, commandsAt: Record<number, Command[]> = {}) => {
  let state = s;
  const allEvents: ReturnType<typeof step>['events'] = [];
  for (let t = 0; t < ticks; t++) {
    const r = step(state, commandsAt[state.clock.absoluteMinute] ?? [], content);
    state = r.next;
    allEvents.push(...r.events);
  }
  return { state, events: allEvents };
};

test('the Day-1 wake window is observable on the very first step', () => {
  const r = step(fresh(), [], content);
  const wakeCards = r.next.queue.filter((c) => c.blockId === 'wake#1');
  expect(wakeCards.map((c) => c.activityId)).toEqual(['toilet', 'brush', 'shower', 'meal']);
});

test('the first morning runs the wake block in order and finishes fed and clean', () => {
  const { state, events } = run(fresh(), 120); // two game-hours
  const completed = events.filter((e) => e.type === 'activityCompleted').map((e) => e.detail);
  expect(completed.slice(0, 4)).toEqual(['toilet', 'brush', 'shower', 'meal']);
  expect(toDisplay(state.bars.hygiene)).toBeGreaterThan(95);
  expect(toDisplay(state.bars.nutrition)).toBeGreaterThan(90);
});

test('a full unattended Day 1 reaches bedtime and sleeps to Day 2 wake with zero urgent events', () => {
  const { state } = run(fresh(), 1440);
  expect(state.clock.absoluteMinute).toBe(420 + 1440);
  expect(state.events.urgentCount).toBe(0);
  expect(toDisplay(state.bars.energy)).toBe(100); // woke at wakeTarget after a full night
});

test('determinism: two identical runs produce byte-identical state at tick 2000', () => {
  const a = run(fresh(), 2000).state;
  const b = run(fresh(), 2000).state;
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

test('JSON round-trip mid-run resumes identically (the forecast/save guarantee)', () => {
  const first = run(fresh(), 700).state;
  const revived = restoreSimState(JSON.parse(JSON.stringify(first)));
  const a = run(first, 500).state;
  const b = run(revived, 500).state;
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

test('player practice: insert after the morning routine, points award with the scattered curve', () => {
  const insertAt = 420 + 150; // mid-morning, routine done
  const { state, events } = run(fresh(), 400, { [insertAt]: [{ type: 'insertPlayer', activityId: 'practice' }] });
  const award = events.find((e) => e.type === 'practiceAwarded');
  expect(award).toBeDefined();
  expect(state.practice.points100).toBeGreaterThan(0);
  // First session, scattered ×1.0, m_out ≈ 1.3-1.5, well-fed likely true post-breakfast:
  expect(state.practice.points100).toBeGreaterThanOrEqual(2500);
  expect(state.practice.points100).toBeLessThanOrEqual(25 * 1.5 * 1.1 * 1.2 * 100);
});

test('stopping the current activity grants pro-rata and suppresses the type for 1h', () => {
  const s0 = fresh();
  // Let the wake block start (toilet 2-3 ticks), then stop during the shower.
  const stopAt = 420 + 25;
  const { state } = run(s0, 60, { [stopAt]: [{ type: 'stopCurrent' }] });
  expect(state.suppression.shower ?? 0).toBeGreaterThan(0);
});

test('single-writer invariant holds across a day (no throw) and bars stay in range', () => {
  const { state } = run(fresh(), 1440);
  for (const bar of ['energy', 'nutrition', 'movement', 'hygiene'] as const) {
    expect(state.bars[bar]).toBeGreaterThanOrEqual(0);
    expect(state.bars[bar]).toBeLessThanOrEqual(toFixed(100));
  }
});
