import { dayNumber } from '../clock';
import { content, type ContentRegistry } from '../content';
import { toFixed } from '../fixed';
import { PrngStreams } from '../prng';
import type { QueueCard } from '../queue';
import { newGameState, type SimState } from '../state';
import { step, type Command } from '../step';

const ROOT_SEED = 1234;

function fresh(): SimState {
  return newGameState(
    'baseline',
    content.rates,
    ROOT_SEED,
    content.perks,
  );
}

function autoReactive(
  id: string,
  activityId: string,
): QueueCard {
  return {
    id,
    activityId,
    owner: 'AUTO',
    urgent: false,
    source: 'reactive',
    enqueuedTick: 0,
  };
}

function consumeOtherAnchors(
  state: SimState,
  exceptId: string,
  registry: ContentRegistry = content,
): void {
  const today = dayNumber(state.clock.absoluteMinute);
  for (const anchor of registry.anchors.anchors) {
    if (anchor.id !== exceptId) state.anchorsConsumedOnDay[anchor.id] = today;
  }
}

test.each<{
  label: string;
  command: Command;
}>([
  {
    label: 'object click',
    command: { type: 'objectClick', activityId: 'shower' },
  },
  {
    label: 'move',
    command: { type: 'moveCard', cardId: 'reactive-shower', toIndex: 0 },
  },
])(
  '$label pins a reactive card without making the planner clone it',
  ({ command }) => {
    const state = fresh();
    state.clock.absoluteMinute = 600;
    state.bars.hygiene = toFixed(35);
    consumeOtherAnchors(state, '__none__');
    state.queue = [autoReactive('reactive-shower', 'shower')];

    const result = step(state, [command], content);
    const showers = result.next.queue.filter(
      (card) => card.activityId === 'shower',
    );

    expect(showers).toHaveLength(1);
    expect(showers[0]).toMatchObject({
      id: 'reactive-shower',
      owner: 'PINNED',
      source: 'reactive',
    });
  },
);

test('Stop while travelling to an anchor consumes that block instead of restarting it', () => {
  const state = fresh();
  state.clock.absoluteMinute = 780; // baseline lunch target
  state.bars.nutrition = toFixed(50);
  consumeOtherAnchors(state, 'lunch');

  const travelling = step(state, [], content).next;
  expect(travelling.current?.type).toBe('travel');
  const targetId = travelling.current?.cardId;
  expect(
    travelling.queue.find((card) => card.id === targetId)?.blockId,
  ).toBe('lunch#1');

  const stopped = step(
    travelling,
    [{ type: 'stopCurrent' }],
    content,
  );

  expect(stopped.outcomes).toContainEqual({
    type: 'stopCurrent',
    status: 'accepted',
    cardId: targetId,
  });
  expect(stopped.next.anchorsConsumedOnDay.lunch).toBe(1);
  expect(
    stopped.next.queue.some((card) => card.blockId === 'lunch#1'),
  ).toBe(false);
  // §7.4 starts the next card on the same tick, so the slot is refilled — the point of
  // this test is that the stopped block is not what refills it.
  expect(stopped.next.current?.cardId).not.toBe(targetId);
});
