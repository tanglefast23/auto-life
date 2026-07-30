import { newSession, resetSession, restoreSession } from '../session';
import { advanceGame } from '../tick';

test('a new session round-trips through JSON unchanged', () => {
  const s = newSession();
  expect(restoreSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
});

test('reset discards everything accumulated in the session', () => {
  const dirty = advanceGame(newSession(), [
    { type: 'activityCompleted', detail: 'breakfast', atMinute: 480 },
    { type: 'anchorMissed', detail: 'morning-routine', atMinute: 600 },
  ]).session;
  expect(dirty).not.toEqual(newSession()); // the fixture is genuinely dirty

  expect(resetSession()).toEqual(newSession());
});
