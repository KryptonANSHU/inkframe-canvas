import { assertNever } from './assertNever';
import {
  createShapesCommand,
  deleteShapesCommand,
  executeCommand,
  redo,
  undo,
  type CommandError,
} from './commands';
import type { DocumentState } from './document';
import type { Result } from './result';
import { selectedShapes } from './selection/selectedShapes';
import { createShapeId, type Shape } from './shapes';
import { EMPTY_SELECTION, type EditorStore } from './store';

export type EditAction = 'undo' | 'redo' | 'delete' | 'duplicate' | 'copy' | 'paste' | 'save';

/** World units between a shape and its duplicate, and between successive pastes. */
export const COPY_OFFSET = 10;

/**
 * Copied shapes, kept inside the editor (not the system clipboard, which needs
 * permissions and async reads). Each paste lands one offset further than the last.
 */
export type ShapeClipboard = {
  copy(store: EditorStore): void;
  paste(store: EditorStore, reportError: (error: Error) => void): void;
};

export function createShapeClipboard(): ShapeClipboard {
  let copied: readonly Shape[] = [];
  let pastes = 0;
  return {
    copy(store) {
      const shapes = selectedShapes(store.getState());
      if (shapes.length > 0) {
        copied = shapes;
        pastes = 0;
      }
    },
    paste(store, reportError) {
      if (copied.length === 0) {
        return;
      }
      pastes += 1;
      addCopies(store, 'Paste', copied, COPY_OFFSET * pastes, reportError);
    },
  };
}

export function performEditAction(
  action: EditAction,
  store: EditorStore,
  clipboard: ShapeClipboard,
  reportError: (error: Error) => void,
): void {
  switch (action) {
    case 'undo':
      report(undo(store), reportError);
      return;
    case 'redo':
      report(redo(store), reportError);
      return;
    case 'delete':
      deleteSelection(store, reportError);
      return;
    case 'duplicate':
      addCopies(store, 'Duplicate', selectedShapes(store.getState()), COPY_OFFSET, reportError);
      return;
    case 'copy':
      clipboard.copy(store);
      return;
    case 'paste':
      clipboard.paste(store, reportError);
      return;
    case 'save':
      // Claimed so the browser never saves the page; saving arrives in M6.
      return;
    default:
      assertNever(action);
  }
}

function deleteSelection(store: EditorStore, reportError: (error: Error) => void): void {
  const shapes = selectedShapes(store.getState());
  if (shapes.length > 0) {
    report(
      executeCommand(store, deleteShapesCommand('Delete', shapes), { select: EMPTY_SELECTION }),
      reportError,
    );
  }
}

/** Copies with new IDs, offset by `offset`, on top of everything, and selected. */
function addCopies(
  store: EditorStore,
  label: string,
  shapes: readonly Shape[],
  offset: number,
  reportError: (error: Error) => void,
): void {
  if (shapes.length === 0) {
    return;
  }
  const copies = shapes.map((shape) => ({
    ...shape,
    id: createShapeId(),
    x: shape.x + offset,
    y: shape.y + offset,
  }));
  const select = new Set(copies.map((shape) => shape.id));
  report(executeCommand(store, createShapesCommand(label, copies), { select }), reportError);
}

function report(
  result: Result<DocumentState, CommandError> | null,
  reportError: (error: Error) => void,
): void {
  if (result?.ok === false) {
    reportError(result.error);
  }
}
