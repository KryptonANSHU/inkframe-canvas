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

/**
 * Actions bound to keys. Copy, cut, and paste aren't here: they run from the
 * browser's clipboard events (see dom/clipboard.ts), which come with clipboard access.
 */
export type EditAction = 'undo' | 'redo' | 'delete' | 'duplicate' | 'open' | 'save';

/** Opening and saving files need the browser; the DOM layer supplies them. */
export type FileCommands = { open(): void; save(): void };

const NO_FILE_COMMANDS: FileCommands = { open: () => undefined, save: () => undefined };

/** World units between a shape and its duplicate, and between successive pastes. */
export const COPY_OFFSET = 10;

/**
 * Remembers what was copied, so pasting the same shapes again lands one offset further
 * each time. The shapes themselves travel through the system clipboard.
 */
export type ShapeClipboard = {
  /** The selection, now remembered as copied; empty when nothing is selected. */
  copy(store: EditorStore): readonly Shape[];
  /** Adds copies of `shapes` (read back from the clipboard) with new IDs, selected. */
  paste(store: EditorStore, shapes: readonly Shape[], reportError: (error: Error) => void): void;
};

export function createShapeClipboard(): ShapeClipboard {
  let copiedIds = '';
  let pastes = 0;
  const idsOf = (shapes: readonly Shape[]) => shapes.map((shape) => shape.id).join('\n');
  return {
    copy(store) {
      const shapes = selectedShapes(store.getState());
      if (shapes.length > 0) {
        copiedIds = idsOf(shapes);
        pastes = 0;
      }
      return shapes;
    },
    paste(store, shapes, reportError) {
      // Shapes copied elsewhere (another tab) start a new cascade.
      if (idsOf(shapes) !== copiedIds) {
        copiedIds = idsOf(shapes);
        pastes = 0;
      }
      pastes += 1;
      addCopies(store, 'Paste', shapes, COPY_OFFSET * pastes, reportError);
    },
  };
}

export function performEditAction(
  action: EditAction,
  store: EditorStore,
  reportError: (error: Error) => void,
  files: FileCommands = NO_FILE_COMMANDS,
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
    case 'open':
      files.open();
      return;
    case 'save':
      files.save();
      return;
    default:
      assertNever(action);
  }
}

export function deleteSelection(store: EditorStore, reportError: (error: Error) => void): void {
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
