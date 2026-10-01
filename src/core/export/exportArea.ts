import { unionBounds, type Bounds } from '../geometry/bounds';
import { selectedShapes } from '../selection/selectedShapes';
import { shapeBounds } from '../shapeGeometry';
import type { Shape } from '../shapes';
import type { EditorState } from '../store';

/** Blank space around exported shapes, in world units. */
export const EXPORT_PADDING = 16;

/** What an export contains: the selection if there is one, otherwise everything. */
export function shapesToExport(state: EditorState): Shape[] {
  if (state.selectedIds.size > 0) {
    return selectedShapes(state);
  }
  const { shapes, order } = state.document;
  return order.flatMap((id) => {
    const shape = shapes.get(id);
    return shape === undefined ? [] : [shape];
  });
}

/** The world area an export covers: every shape's ink, plus padding. Null when empty. */
export function exportBounds(shapes: readonly Shape[]): Bounds | null {
  const [first, ...rest] = shapes.map(shapeBounds);
  if (first === undefined) {
    return null;
  }
  const all = rest.reduce(unionBounds, first);
  return {
    minX: all.minX - EXPORT_PADDING,
    minY: all.minY - EXPORT_PADDING,
    maxX: all.maxX + EXPORT_PADDING,
    maxY: all.maxY + EXPORT_PADDING,
  };
}
