import { GameLoop } from '../loop';
import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { newGameState } from '../../sim/state';

const fresh = () =>
  newGameState('baseline', content.rates, 1234, content.perks);

function removeUpcomingWakeCard(loop: GameLoop): string {
  loop.runOneTick();
  const target = loop.peekState().queue.find(
    (card) => card.id !== loop.peekState().current?.cardId,
  );
  if (target === undefined) throw new Error('no upcoming wake card');
  loop.enqueue({ type: 'removeCard', cardId: target.id });
  loop.runOneTick();
  const toast = loop.undoToast;
  if (toast === null) throw new Error('remove did not publish an undo toast');
  return toast.receiptId;
}

test('an eligible remove exposes a five-real-second toast and undo restores it', () => {
  const loop = new GameLoop(fresh(), content);
  const receiptId = removeUpcomingWakeCard(loop);
  const removedCardId = loop.peekState().removalReceipt?.card.id;
  if (removedCardId === undefined) throw new Error('missing canonical receipt');

  expect(loop.undoToast).toEqual({ receiptId, remainingMs: 5000 });
  expect(loop.undoLastRemove(receiptId)).toBe(true);
  loop.runOneTick();

  expect(loop.peekState().queue.some((card) => card.id === removedCardId)).toBe(true);
  expect(loop.undoToast).toBeNull();
  expect(loop.peekState().removalReceipt).toBeNull();
});

test('the toast expires in real time even while no simulation frames run in the background', () => {
  const loop = new GameLoop(fresh(), content);
  const receiptId = removeUpcomingWakeCard(loop);
  loop.setSystemPaused(true);

  loop.elapsePresentationTime(4999);
  expect(loop.undoToast).toEqual({ receiptId, remainingMs: 1 });
  loop.elapsePresentationTime(1);
  expect(loop.undoToast).toBeNull();
  expect(loop.undoLastRemove(receiptId)).toBe(false);

  // The application-owned expiry command clears the canonical engine receipt at
  // the next minute boundary; no stale id can be replayed after unpausing.
  loop.setSystemPaused(false);
  loop.runOneTick();
  expect(loop.peekState().removalReceipt).toBeNull();
});

test('reset clears a live receipt and toast', () => {
  const loop = new GameLoop(fresh(), content);
  removeUpcomingWakeCard(loop);
  expect(loop.undoToast).not.toBeNull();

  loop.reset();

  expect(loop.undoToast).toBeNull();
  expect(loop.peekState().removalReceipt).toBeNull();
});
