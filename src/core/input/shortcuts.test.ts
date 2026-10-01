import { describe, expect, it } from 'vitest';
import { editActionFor } from './shortcuts';

const key = (
  name: string,
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {},
) => ({
  key: name,
  ctrlKey: modifiers.ctrl ?? false,
  metaKey: modifiers.meta ?? false,
  shiftKey: modifiers.shift ?? false,
  altKey: modifiers.alt ?? false,
  repeat: false,
});

describe('editActionFor', () => {
  it.each([
    [key('z', { ctrl: true }), 'undo'],
    [key('Z', { meta: true, shift: true }), 'redo'],
    [key('y', { ctrl: true }), 'redo'],
    [key('d', { meta: true }), 'duplicate'],
    // Left to the browser, which then fires copy and paste events.
    [key('c', { ctrl: true }), null],
    [key('v', { meta: true }), null],
    [key('o', { meta: true }), 'open'],
    [key('s', { ctrl: true }), 'save'],
    [key('Delete'), 'delete'],
    [key('=', { meta: true }), 'zoomIn'],
    [key('-', { ctrl: true }), 'zoomOut'],
    [key('0', { ctrl: true }), 'zoomReset'],
    [key('!', { shift: true }), 'zoomFit'],
    [key(']', { meta: true }), 'forward'],
    [key('}', { meta: true, shift: true }), 'front'],
    [key('[', { ctrl: true, shift: true }), 'back'],
    [key('q'), 'toggleLock'],
    [key('?', { shift: true }), 'help'],
    [key('Backspace'), 'delete'],
    [key('z'), null],
    [key('z', { ctrl: true, alt: true }), null],
    [key('Backspace', { meta: true }), null],
  ] as const)('%o → %s', (input, action) => {
    expect(editActionFor(input)).toBe(action);
  });
});
