import { EMPTY_DOCUMENT, type DocumentState } from '../document';
import type { EditorStore } from '../store';
import type { SpatialIndex } from './spatialIndex';

/**
 * Brings the index from `previous` to `next`. Shapes are immutable, so any shape whose
 * object changed was created, moved, resized, rotated, or restored by undo/redo; one
 * reference comparison per shape catches them all, whichever command made the change.
 */
export function syncSpatialIndex(
  index: SpatialIndex,
  previous: DocumentState,
  next: DocumentState,
): void {
  if (previous === next) {
    return;
  }
  for (const [id, shape] of next.shapes) {
    if (previous.shapes.get(id) !== shape) {
      index.update(shape);
    }
  }
  for (const id of previous.shapes.keys()) {
    if (!next.shapes.has(id)) {
      index.remove(id);
    }
  }
}

/** Keeps `index` in sync with the store's document. Returns a function that stops it. */
export function bindSpatialIndex(store: EditorStore, index: SpatialIndex): () => void {
  syncSpatialIndex(index, EMPTY_DOCUMENT, store.getState().document);
  return store.subscribe((state, previousState) => {
    syncSpatialIndex(index, previousState.document, state.document);
  });
}
