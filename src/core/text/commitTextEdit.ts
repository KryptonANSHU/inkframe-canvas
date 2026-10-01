import {
  createShapeCommand,
  deleteShapesCommand,
  executeCommand,
  updateShapesCommand,
  type Command,
} from '../commands';
import type { EditorStore } from '../store';
import { selectCreated } from '../tools/selectCreated';
import type { TextMeasurer } from './layout';
import { createTextShape, withText, type TextEdit } from './textShape';

/**
 * Ends a text edit as one command: new text creates a shape, changed text updates it,
 * cleared text deletes it, and untouched text changes nothing. The text ends up
 * selected, unless it was deleted.
 */
export function commitTextEdit(
  store: EditorStore,
  edit: TextEdit,
  typed: string,
  measurer: TextMeasurer,
  reportError: (error: Error) => void,
): void {
  const { original } = edit;
  if (original === null) {
    const shape = createTextShape(edit, typed, measurer);
    if (shape !== null) {
      run(store, createShapeCommand(shape), reportError, () => {
        selectCreated(store, shape.id);
      });
    }
    return;
  }
  // The document's version: its zIndex is current, which deleting and undo rely on.
  const current = store.getState().document.shapes.get(original.id);
  if (current?.type !== 'text') {
    return;
  }
  if (current.text === typed.trimEnd()) {
    store.setState({ selectedIds: new Set([current.id]) });
    return;
  }
  const updated = withText(current, typed, measurer);
  const command =
    updated === null
      ? deleteShapesCommand('Delete text', [current])
      : updateShapesCommand('Edit text', [current], [updated]);
  run(store, command, reportError, () => {
    store.setState({ selectedIds: new Set(updated === null ? [] : [current.id]) });
  });
}

function run(
  store: EditorStore,
  command: Command,
  reportError: (error: Error) => void,
  onSuccess: () => void,
): void {
  const result = executeCommand(store, command);
  if (result.ok) {
    onSuccess();
  } else {
    reportError(result.error);
  }
}
