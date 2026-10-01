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
    [key('c', { ctrl: true }), 'copy'],
    [key('v', { ctrl: true }), 'paste'],
    [key('o', { meta: true }), 'open'],
    [key('s', { ctrl: true }), 'save'],
    [key('Delete'), 'delete'],
    [key('Backspace'), 'delete'],
    [key('z'), null],
    [key('z', { ctrl: true, alt: true }), null],
    [key('Backspace', { meta: true }), null],
  ] as const)('%o → %s', (input, action) => {
    expect(editActionFor(input)).toBe(action);
  });
});
