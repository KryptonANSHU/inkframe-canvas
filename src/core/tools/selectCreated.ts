import { createShapeCommand, executeCommand } from '../commands';
import type { Shape } from '../shapes';
import type { EditorStore } from '../store';

/**
 * Adds a drawn shape as one undo step that also selects it, then brings the select
 * tool back, ready to adjust it. The pen skips this so stroke after stroke can follow.
 */
export function createAndSelect(
  store: EditorStore,
  shape: Shape,
  reportError: (error: Error) => void,
): void {
  const result = executeCommand(store, createShapeCommand(shape), { select: new Set([shape.id]) });
  if (result.ok) {
    store.setState({ activeTool: 'select' });
  } else {
    reportError(result.error);
  }
}
