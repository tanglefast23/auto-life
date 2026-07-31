import { step } from '../step';
import { newGameState, type SimState } from '../state';
import { PrngStreams } from '../prng';
import { toDisplay, toFixed } from '../fixed';
import { content, objectForActivity } from '../content';
import { dayNumber } from '../clock';
import { DEFAULT_SIM_RULES } from '../rules';
import { STOP_SUPPRESSION_MIN, type QueueCard } from '../queue';

/**
 * SPEC §7.4, Stop current: "pro-rata credit, next card starts."
 *
 * It did neither cleanly. Stage 3 was held for the whole tick after any stop, so the
 * next card idled a game minute — and the reason the hold existed was worse than the
 * symptom: the rolling planner ignored §7.4's one-hour stop suppression and re-proposed
 * the stopped activity on the same minute, so without the hold, Stop restarted the very
 * thing it stopped. Both halves are pinned here.
 */

const fresh = (): SimState =>
  newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize());

const card = (over: Partial<QueueCard> & { id: string; activityId: string }): QueueCard => ({
  owner: 'AUTO',
  urgent: false,
  source: 'player',
  enqueuedTick: 0,
  ...over,
});

const at = (activityId: string): { x: number; y: number } => {
  const [x, y] = objectForActivity(activityId).interactPoint;
  return { x, y };
};

const consumeAnchors = (s: SimState): void => {
  const d = dayNumber(s.clock.absoluteMinute);
  for (const a of content.anchors.anchors) s.anchorsConsumedOnDay[a.id] = d;
};

const healthyBars = () => ({
  energy: toFixed(80),
  nutrition: toFixed(80),
  movement: toFixed(80),
  hygiene: toFixed(80),
});

test('stopping the current card starts the next one on the same tick', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = healthyBars();
  s.position = at('read');
  s.queue = [
    card({ id: 'a', activityId: 'read', owner: 'PINNED' }),
    card({ id: 'b', activityId: 'read', owner: 'PINNED' }),
  ];

  const started = step(s, [], content).next;
  expect(started.current?.cardId).toBe('a');

  const stopped = step(started, [{ type: 'stopCurrent' }], content).next;
  expect(stopped.queue.find((c) => c.id === 'a')).toBeUndefined();
  // The handoff, not one dead minute: card b owns the slot on the stop tick itself.
  expect(stopped.current?.cardId).toBe('b');
});

test('a stopped card keeps the credit it earned and takes no more', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = { ...healthyBars(), nutrition: toFixed(40) };
  s.position = at('snack');
  s.queue = [card({ id: 'sn', activityId: 'snack', owner: 'PINNED' })];

  let running = step(s, [], content).next;
  for (let i = 0; i < 3; i += 1) running = step(running, [], content).next;
  const earned = toDisplay(running.bars.nutrition);
  expect(earned).toBeGreaterThan(40);

  const stopped = step(running, [{ type: 'stopCurrent' }], content).next;
  // Pro-rata: what the snack filled is kept, and the partial unit never completes.
  expect(toDisplay(stopped.bars.nutrition)).toBeGreaterThanOrEqual(earned - 1);
  expect(stopped.lastCompletion?.activityId).not.toBe('snack');
});

test('the rolling plan honours the stop suppression instead of re-proposing the card', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = { ...healthyBars(), nutrition: toFixed(40) };
  s.position = at('snack');

  let running = step(s, [], content, DEFAULT_SIM_RULES).next;
  for (let i = 0; i < 3; i += 1) {
    running = step(running, [], content, DEFAULT_SIM_RULES).next;
  }
  expect(
    running.current?.type === 'activity' && running.current.dto.activityId,
  ).toBe('snack');
  const stoppedAt = running.clock.absoluteMinute;

  const stopped = step(running, [{ type: 'stopCurrent' }], content, DEFAULT_SIM_RULES).next;
  expect(stopped.suppression.snack).toBe(stoppedAt + STOP_SUPPRESSION_MIN);
  expect(stopped.queue.some((c) => c.activityId === 'snack')).toBe(false);

  // Still absent a tick later — the old planner re-added it immediately and the guard
  // only hid that for one minute.
  const later = step(stopped, [], content, DEFAULT_SIM_RULES).next;
  expect(later.queue.some((c) => c.activityId === 'snack')).toBe(false);
  expect(
    later.current?.type === 'activity' && later.current.dto.activityId,
  ).not.toBe('snack');
});

test('suppression expires and the plan may propose the activity again', () => {
  const s = fresh();
  consumeAnchors(s);
  s.clock.absoluteMinute = 420 + 200;
  s.bars = { ...healthyBars(), nutrition: toFixed(40) };
  s.position = at('snack');
  // A tick refills the tail twice — once for the displayed minute and once after the
  // clock advances — so the window has to outlast the whole first tick to hold it out.
  s.suppression = { snack: s.clock.absoluteMinute + 2 };

  const held = step(s, [], content, DEFAULT_SIM_RULES).next;
  expect(held.queue.some((c) => c.activityId === 'snack')).toBe(false);

  const afterExpiry = step(held, [], content, DEFAULT_SIM_RULES).next;
  expect(afterExpiry.queue.some((c) => c.activityId === 'snack')).toBe(true);
});
