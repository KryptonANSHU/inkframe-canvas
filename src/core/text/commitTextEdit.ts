import { deleteShapesCommand, executeCommand, updateShapesCommand } from '../commands';
import { EMPTY_SELECTION, type EditorStore } from '../store';
import { createAndSelect } from '../tools/selectCreated';
import type { TextMeasurer } from './layout';
import { createTextShape, withText, type TextEdit } from './textShape';

/**
 * Ends a text edit as one undo step: new text creates a shape, changed text updates it,
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
      createAndSelect(store, shape, reportError);
    }
    return;
  }
  // The document's version: its zIndex is current, which deleting and undo rely on.
  const current = store.getState().document.shapes.get(original.id);
  if (current?.type !== 'text') {
    return;
  }
  // Selected again first, so undoing the edit restores the text as selected.
  store.setState({ selectedIds: new Set([current.id]) });
  if (current.text === typed.trimEnd()) {
    return;
  }
  const updated = withText(current, typed, measurer);
  const result =
    updated === null
      ? executeCommand(store, deleteShapesCommand('Delete text', [current]), {
          select: EMPTY_SELECTION,
        })
      : executeCommand(store, updateShapesCommand('Edit text', [current], [updated]));
  if (!result.ok) {
    reportError(result.error);
  }
}
