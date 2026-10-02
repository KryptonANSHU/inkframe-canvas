import * as Y from 'yjs';
import type { SharedHistory } from '../core/editActions';
import type { ShapeId } from '../core/shapes';
import type { EditorStore } from '../core/store';
import { LOCAL_EDIT, type LocalEdit } from './binding';
import { sharedShapes } from './sharedDocument';

const BEFORE = 'selectionBefore';
const AFTER = 'selectionAfter';

export type SharedUndo = SharedHistory & {
  /** Feed every local edit here (the binding's onLocalEdit) before it is written. */
  readonly onLocalEdit: (edit: LocalEdit) => void;
  dispose(): void;
};

/**
 * Per-user undo: Yjs's UndoManager tracks only this client's LOCAL_EDIT transactions,
 * so undo never removes a collaborator's work, and redo survives their edits in between.
 * One editor step is one undo step: capturing runs until the next new step starts, so
 * joined commands (a held arrow key, a slider drag) stay together. Each step remembers
 * the selection on either side, and undo / redo restore it, as the local history does.
 */
export function createSharedUndo(store: EditorStore, doc: Y.Doc): SharedUndo {
  const manager = new Y.UndoManager(sharedShapes(doc), {
    trackedOrigins: new Set([LOCAL_EDIT]),
    // Never time-based: steps end where the editor says (stopCapturing below).
    captureTimeout: Number.POSITIVE_INFINITY,
  });
  let pending: LocalEdit | null = null;
  /** The step being undone or redone, whose selections its inverse inherits. */
  let moving: Y.UndoManager['undoStack'][number] | null = null;

  const publish = () => {
    store.setState({ sharedUndo: { canUndo: manager.canUndo(), canRedo: manager.canRedo() } });
  };
  const select = (ids: unknown) => {
    const { shapes } = store.getState().document;
    const kept =
      ids instanceof Set ? [...(ids as Set<ShapeId>)].filter((id) => shapes.has(id)) : [];
    store.setState({ selectedIds: new Set(kept) });
  };

  manager.on('stack-item-added', ({ stackItem }) => {
    if (moving !== null) {
      // The inverse of a step being undone (or redone) carries the same selections.
      stackItem.meta.set(BEFORE, moving.meta.get(BEFORE));
      stackItem.meta.set(AFTER, moving.meta.get(AFTER));
    } else if (pending !== null) {
      stackItem.meta.set(BEFORE, pending.selectionBefore);
      stackItem.meta.set(AFTER, pending.selectionAfter);
    }
    publish();
  });
  manager.on('stack-item-updated', ({ stackItem }) => {
    if (pending !== null) stackItem.meta.set(AFTER, pending.selectionAfter);
  });
  manager.on('stack-item-popped', ({ stackItem, type }) => {
    select(stackItem.meta.get(type === 'undo' ? BEFORE : AFTER));
    publish();
  });
  manager.on('stack-cleared', publish);
  publish();

  const step = (stack: 'undo' | 'redo') => {
    moving = (stack === 'undo' ? manager.undoStack : manager.redoStack).at(-1) ?? null;
    if (stack === 'undo') manager.undo();
    else manager.redo();
    moving = null;
  };

  return {
    onLocalEdit(edit) {
      if (edit.newStep) manager.stopCapturing();
      pending = edit;
    },
    undo: () => {
      step('undo');
    },
    redo: () => {
      step('redo');
    },
    dispose() {
      manager.destroy();
      store.setState({ sharedUndo: null });
    },
  };
}
