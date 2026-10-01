import { createShapeCommand, executeCommand } from '../commands';
import type { Shape } from '../shapes';
import { EMPTY_SELECTION, type EditorStore } from '../store';

/**
 * Adds a drawn shape as one undo step that also selects it, then brings the select
 * tool back, ready to adjust it. With the tool locked (Q), the tool stays and nothing
 * is selected, so shape after shape can follow. The pen always works like that.
 */
export function createAndSelect(
  store: EditorStore,
  shape: Shape,
  reportError: (error: Error) => void,
): void {
  const locked = store.getState().toolLocked;
  const select = locked ? EMPTY_SELECTION : new Set([shape.id]);
  const result = executeCommand(store, createShapeCommand(shape), { select });
  if (!result.ok) {
    reportError(result.error);
  } else if (!locked) {
    store.setState({ activeTool: 'select' });
  }
}
