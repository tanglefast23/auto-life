import {
  keyboardActionFor,
  shortcutIsSuppressed,
  type KeyboardLikeEvent,
} from '../keyboard';

const event = (
  key: string,
  over: Partial<KeyboardLikeEvent> = {},
): KeyboardLikeEvent => ({
  key,
  target: null,
  ...over,
});

test('maps every shortcut whose surface exists at T6', () => {
  expect(keyboardActionFor(event(' '))).toEqual({ type: 'togglePause' });
  expect(keyboardActionFor(event('1'))).toEqual({ type: 'setSpeed', speed: 1 });
  expect(keyboardActionFor(event('2'))).toEqual({ type: 'setSpeed', speed: 2 });
  expect(keyboardActionFor(event('3'))).toEqual({ type: 'setSpeed', speed: 4 });
  expect(keyboardActionFor(event('Escape'))).toEqual({ type: 'closePanel' });
  expect(keyboardActionFor(event('q'))).toEqual({ type: 'focusQueue' });
  expect(keyboardActionFor(event('X'))).toEqual({ type: 'stopCurrent' });
  expect(keyboardActionFor(event('a'))).toEqual({ type: 'togglePalette' });
  expect(keyboardActionFor(event('g'))).toEqual({ type: 'openGoals' });
  expect(keyboardActionFor(event('u'))).toEqual({ type: 'undoRemove' });
});

test('maps queue-local keys and keeps Shift as the explicit move-card modifier', () => {
  expect(keyboardActionFor(event('ArrowUp'))).toEqual({
    type: 'queueArrow',
    direction: -1,
    moveCard: false,
  });
  expect(keyboardActionFor(event('ArrowDown', { shiftKey: true }))).toEqual({
    type: 'queueArrow',
    direction: 1,
    moveCard: true,
  });
  expect(keyboardActionFor(event('Enter'))).toEqual({ type: 'openQueueMenu' });
  expect(keyboardActionFor(event('Delete'))).toEqual({ type: 'removeQueueCard' });
});

test('Tab stays ordinary traversal and v2 shortcuts are not stolen', () => {
  expect(keyboardActionFor(event('Tab'))).toBeNull();
  expect(keyboardActionFor(event('w'))).toBeNull(); // v2 Week Plan
  expect(keyboardActionFor(event('m'))).toEqual({
    type: 'toggleMute',
  });
});

test('shortcuts are suppressed in editable controls, contenteditable, and IME composition', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    expect(shortcutIsSuppressed(event('q', { target: { tagName } }))).toBe(true);
  }
  expect(
    shortcutIsSuppressed(
      event('q', { target: { tagName: 'DIV', isContentEditable: true } }),
    ),
  ).toBe(true);
  expect(shortcutIsSuppressed(event('q', { isComposing: true }))).toBe(true);
  expect(shortcutIsSuppressed(event('q', { keyCode: 229 }))).toBe(true);
});

test('browser and assistive-technology modifier chords remain untouched', () => {
  expect(keyboardActionFor(event('q', { metaKey: true }))).toBeNull();
  expect(keyboardActionFor(event('q', { ctrlKey: true }))).toBeNull();
  expect(keyboardActionFor(event('q', { altKey: true }))).toBeNull();
});
