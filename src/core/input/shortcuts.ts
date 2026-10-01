import type { EditAction } from '../editActions';
import type { KeyInput } from './inputController';

/** Edit shortcuts, by lower-case key, that need Ctrl or ⌘ (either works on any OS). */
const WITH_COMMAND_KEY: Readonly<Record<string, EditAction>> = {
  z: 'undo',
  y: 'redo',
  d: 'duplicate',
  c: 'copy',
  v: 'paste',
  o: 'open',
  s: 'save',
};

/** The edit action a key press asks for, or null. Alt combos are left to the OS. */
export function editActionFor(input: KeyInput): EditAction | null {
  if (input.altKey) {
    return null;
  }
  if (!input.ctrlKey && !input.metaKey) {
    return input.key === 'Delete' || input.key === 'Backspace' ? 'delete' : null;
  }
  const action = WITH_COMMAND_KEY[input.key.toLowerCase()] ?? null;
  // Ctrl / ⌘ + Shift + Z redoes, as in most editors.
  return action === 'undo' && input.shiftKey ? 'redo' : action;
}
