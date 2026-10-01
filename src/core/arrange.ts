import { assertNever } from './assertNever';
import { executeCommand, type Command } from './commands';
import { reorderShapes } from './document';
import type { ShapeId } from './shapes';
import type { EditorStore } from './store';

export type ArrangeAction = 'forward' | 'backward' | 'front' | 'back';

const LABELS: Readonly<Record<ArrangeAction, string>> = {
  forward: 'Bring forward',
  backward: 'Send backward',
  front: 'Bring to front',
  back: 'Send to back',
};

/**
 * The draw order (bottom to top) after moving `selected` shapes. Forward and backward
 * move each selected shape past one unselected neighbor, so a selection keeps its
 * internal order and its gaps; front and back move it to an end.
 */
export function arrangedOrder(
  order: readonly ShapeId[],
  selected: ReadonlySet<ShapeId>,
  action: ArrangeAction,
): ShapeId[] {
  const isSelected = (id: ShapeId | undefined) => id !== undefined && selected.has(id);
  const next = [...order];
  const swap = (i: number, j: number) => {
    [next[i], next[j]] = [next[j] as ShapeId, next[i] as ShapeId];
  };
  switch (action) {
    case 'front':
      return [
        ...order.filter((id) => !selected.has(id)),
        ...order.filter((id) => selected.has(id)),
      ];
    case 'back':
      return [
        ...order.filter((id) => selected.has(id)),
        ...order.filter((id) => !selected.has(id)),
      ];
    case 'forward':
      for (let i = next.length - 2; i >= 0; i--) {
        if (isSelected(next[i]) && !isSelected(next[i + 1])) swap(i, i + 1);
      }
      return next;
    case 'backward':
      for (let i = 1; i < next.length; i++) {
        if (isSelected(next[i]) && !isSelected(next[i - 1])) swap(i, i - 1);
      }
      return next;
    default:
      return assertNever(action);
  }
}

/** Swaps between two draw orders of the same shapes. */
export function reorderCommand(
  label: string,
  before: readonly ShapeId[],
  after: readonly ShapeId[],
): Command {
  return {
    label,
    do: (document) => reorderShapes(document, after),
    undo: (document) => reorderShapes(document, before),
  };
}

/** Moves the selection in the draw order as one undo step; nothing if it can't move. */
export function arrangeSelection(
  store: EditorStore,
  action: ArrangeAction,
  reportError: (error: Error) => void,
): void {
  const { document, selectedIds } = store.getState();
  const after = arrangedOrder(document.order, selectedIds, action);
  if (after.every((id, i) => id === document.order[i])) {
    return;
  }
  const result = executeCommand(store, reorderCommand(LABELS[action], document.order, after));
  if (!result.ok) {
    reportError(result.error);
  }
}
