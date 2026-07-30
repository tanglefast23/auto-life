import type { Speed } from '../application/loop';

export interface EditableTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

export interface KeyboardLikeEvent {
  key: string;
  code?: string;
  keyCode?: number;
  target: EditableTargetLike | null;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
}

export type KeyboardAction =
  | { type: 'togglePause' }
  | { type: 'setSpeed'; speed: Exclude<Speed, 0> }
  | { type: 'closePanel' }
  | { type: 'focusQueue' }
  | { type: 'queueArrow'; direction: -1 | 1; moveCard: boolean }
  | { type: 'openQueueMenu' }
  | { type: 'removeQueueCard' }
  | { type: 'stopCurrent' }
  | { type: 'togglePalette' }
  | { type: 'openGoals' }
  | { type: 'undoRemove' };

export function shortcutIsSuppressed(event: KeyboardLikeEvent): boolean {
  if (event.isComposing === true || event.keyCode === 229) return true;
  const target = event.target;
  if (target === null) return false;
  const tag = target.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable === true) return true;
  return target.closest?.('[contenteditable="true"]') !== undefined &&
    target.closest?.('[contenteditable="true"]') !== null;
}

/** The fixed T6-owned subset of SPEC §11.8. Later-task keys deliberately return null. */
export function keyboardActionFor(event: KeyboardLikeEvent): KeyboardAction | null {
  if (
    shortcutIsSuppressed(event) ||
    event.altKey === true ||
    event.ctrlKey === true ||
    event.metaKey === true
  ) {
    return null;
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === ' ' || key === 'Spacebar' || event.code === 'Space') {
    return { type: 'togglePause' };
  }
  if (key === '1') return { type: 'setSpeed', speed: 1 };
  if (key === '2') return { type: 'setSpeed', speed: 2 };
  if (key === '3') return { type: 'setSpeed', speed: 4 };
  if (key === 'Escape') return { type: 'closePanel' };
  if (key === 'q') return { type: 'focusQueue' };
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return {
      type: 'queueArrow',
      direction: key === 'ArrowLeft' ? -1 : 1,
      moveCard: event.shiftKey === true,
    };
  }
  if (key === 'Enter') return { type: 'openQueueMenu' };
  if (key === 'Delete' || key === 'Backspace') return { type: 'removeQueueCard' };
  if (key === 'x') return { type: 'stopCurrent' };
  if (key === 'a') return { type: 'togglePalette' };
  if (key === 'g') return { type: 'openGoals' };
  if (key === 'u') return { type: 'undoRemove' };
  return null;
}
