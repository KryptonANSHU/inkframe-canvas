import { arrangeSelection, type ArrangeAction } from './arrange';
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
import { groupSelection, regroupCopies, ungroupSelection } from './groups';
import type { Result } from './result';
import { selectedShapes } from './selection/selectedShapes';
import { createShapeId, type Shape } from './shapes';
import { EMPTY_SELECTION, type EditorStore } from './store';
import { zoomView } from './view';

/**
 * Actions bound to keys and buttons. Copy, cut, and paste aren't here: they run from
 * the browser's clipboard events (see dom/clipboard.ts), which come with access.
 */
export type EditAction =
  | 'undo'
  | 'redo'
  | 'delete'
  | 'duplicate'
  | 'selectAll'
  | 'clear'
  | 'open'
  | 'save'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'zoomFit'
  | ArrangeAction
  | 'group'
  | 'ungroup'
  | 'toggleLock'
  | 'toggleGrid'
  | 'help';

/** What only the browser can do: open and save files, and measure the view. */
export type EditorHooks = {
  open(): void;
  save(): void;
  /** The canvas's size in CSS pixels. */
  viewSize(): { readonly width: number; readonly height: number };
};

const NO_HOOKS: EditorHooks = {
  open: () => undefined,
  save: () => undefined,
  viewSize: () => ({ width: 0, height: 0 }),
};

const ZOOMS = { zoomIn: 'in', zoomOut: 'out', zoomReset: 'reset', zoomFit: 'fit' } as const;

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
  hooks: EditorHooks = NO_HOOKS,
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
    case 'clear':
      clearCanvas(store, reportError);
      return;
    case 'selectAll':
      store.setState({ selectedIds: new Set(store.getState().document.order) });
      return;
    case 'open':
      hooks.open();
      return;
    case 'save':
      hooks.save();
      return;
    case 'zoomIn':
    case 'zoomOut':
    case 'zoomReset':
    case 'zoomFit': {
      const { width, height } = hooks.viewSize();
      zoomView(store, ZOOMS[action], width, height);
      return;
    }
    case 'forward':
    case 'backward':
    case 'front':
    case 'back':
      arrangeSelection(store, action, reportError);
      return;
    case 'group':
      groupSelection(store, reportError);
      return;
    case 'ungroup':
      ungroupSelection(store, reportError);
      return;
    case 'toggleLock':
      store.setState({ toolLocked: !store.getState().toolLocked });
      return;
    case 'toggleGrid':
      store.setState({ gridVisible: !store.getState().gridVisible });
      return;
    case 'help':
      store.setState({ helpOpen: !store.getState().helpOpen });
      return;
    default:
      assertNever(action);
  }
}

/** Removes every shape as one undo step, so one Ctrl / ⌘ + Z brings the drawing back. */
function clearCanvas(store: EditorStore, reportError: (error: Error) => void): void {
  const { document } = store.getState();
  const shapes = document.order.flatMap((id) => {
    const shape = document.shapes.get(id);
    return shape === undefined ? [] : [shape];
  });
  if (shapes.length > 0) {
    report(
      executeCommand(store, deleteShapesCommand('Clear canvas', shapes), {
        select: EMPTY_SELECTION,
      }),
      reportError,
    );
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
  const copies = regroupCopies(
    shapes.map((shape) => ({
      ...shape,
      id: createShapeId(),
      x: shape.x + offset,
      y: shape.y + offset,
    })),
  );
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
