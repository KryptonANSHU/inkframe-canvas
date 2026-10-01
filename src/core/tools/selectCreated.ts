import type { ShapeId } from '../shapes';
import type { EditorStore } from '../store';

/**
 * After drawing a shape, it becomes the selection and the select tool comes back,
 * ready to adjust it. The pen skips this so stroke after stroke can follow.
 */
export function selectCreated(store: EditorStore, id: ShapeId): void {
  store.setState({ selectedIds: new Set([id]), activeTool: 'select' });
}
