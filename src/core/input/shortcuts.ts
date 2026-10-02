import type { EditAction } from '../editActions';
import type { KeyInput } from './inputController';

/** Shortcuts, by lower-case key, that need Ctrl or ⌘ (either works on any OS). */
const WITH_COMMAND_KEY: Readonly<Record<string, EditAction>> = {
  z: 'undo',
  y: 'redo',
  d: 'duplicate',
  a: 'selectAll',
  o: 'open',
  s: 'save',
  '=': 'zoomIn',
  '+': 'zoomIn',
  '-': 'zoomOut',
  '0': 'zoomReset',
  "'": 'toggleGrid',
  g: 'group',
  ']': 'forward',
  '[': 'backward',
  // Shift + ] and Shift + [ type braces on most layouts.
  '}': 'front',
  '{': 'back',
};

/** Shortcuts without Ctrl or ⌘. Tool keys (R, O, …) live in TOOL_SHORTCUTS. */
const PLAIN: Readonly<Record<string, EditAction>> = {
  delete: 'delete',
  backspace: 'delete',
  q: 'toggleLock',
  '?': 'help',
  // Shift + 1, as in design tools.
  '!': 'zoomFit',
};

/** The edit action a key press asks for, or null. Alt combos are left to the OS. */
export function editActionFor(input: KeyInput): EditAction | null {
  if (input.altKey) {
    return null;
  }
  const key = input.key.toLowerCase();
  if (!input.ctrlKey && !input.metaKey) {
    return PLAIN[key] ?? (input.shiftKey && key === '1' ? 'zoomFit' : null);
  }
  const action = WITH_COMMAND_KEY[key] ?? null;
  if (input.shiftKey && action === 'forward') return 'front';
  if (input.shiftKey && action === 'backward') return 'back';
  if (input.shiftKey && action === 'group') return 'ungroup';
  // Ctrl / ⌘ + Shift + Z redoes, as in most editors.
  return action === 'undo' && input.shiftKey ? 'redo' : action;
}
