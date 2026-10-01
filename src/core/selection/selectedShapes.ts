import { executeCommand, updateShapesCommand } from '../commands';
import type { Shape } from '../shapes';
import type { EditorState, EditorStore } from '../store';

/** The selected shapes as currently drawn (preview versions win), bottom to top. */
export function selectedShapes(state: EditorState): Shape[] {
  const shapes: Shape[] = [];
  for (const id of state.selectedIds) {
    const shape = state.preview?.get(id) ?? state.document.shapes.get(id);
    if (shape !== undefined) {
      shapes.push(shape);
    }
  }
  return shapes.sort((a, b) => a.zIndex - b.zIndex);
}

/** Arrow-key nudge: moves the selection by (dx, dy) world units as one command. */
export function nudgeSelection(
  store: EditorStore,
  dx: number,
  dy: number,
  reportError: (error: Error) => void,
  /** True for a held key's repeats, which join the first press's undo step. */
  repeat = false,
): void {
  const before = selectedShapes(store.getState());
  if (before.length === 0) {
    return;
  }
  const after = before.map((shape) => ({ ...shape, x: shape.x + dx, y: shape.y + dy }));
  const result = executeCommand(store, updateShapesCommand('Nudge', before, after), {
    group: { key: 'nudge', continues: repeat },
  });
  if (!result.ok) {
    reportError(result.error);
  }
}
