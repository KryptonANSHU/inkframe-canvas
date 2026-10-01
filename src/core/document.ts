import type { Shape, ShapeId } from './shapes';

export type DocumentState = {
  readonly shapes: ReadonlyMap<ShapeId, Shape>;
  /** Shape IDs from bottom to top. The shape at order[i] has zIndex i. */
  readonly order: readonly ShapeId[];
};

export class DocumentError extends Error {
  override readonly name = 'DocumentError';
}

export const EMPTY_DOCUMENT: DocumentState = { shapes: new Map(), order: [] };

/** Inserts `shape` at its zIndex and moves every shape above it up by one. */
export function insertShape(document: DocumentState, shape: Shape): DocumentState {
  if (document.shapes.has(shape.id)) {
    throw new DocumentError(`Shape ${shape.id} already exists.`);
  }
  const { zIndex } = shape;
  if (!Number.isInteger(zIndex) || zIndex < 0 || zIndex > document.order.length) {
    throw new DocumentError(
      `zIndex ${String(zIndex)} is outside 0–${String(document.order.length)}.`,
    );
  }
  const order = document.order.toSpliced(zIndex, 0, shape.id);
  const shapes = new Map(document.shapes).set(shape.id, shape);
  renumberFrom(shapes, order, zIndex + 1);
  return { shapes, order };
}

/** Removes a shape and moves every shape above it down by one. */
export function removeShape(document: DocumentState, id: ShapeId): DocumentState {
  const index = document.order.indexOf(id);
  if (index === -1) {
    throw new DocumentError(`Shape ${id} does not exist.`);
  }
  const order = document.order.toSpliced(index, 1);
  const shapes = new Map(document.shapes);
  shapes.delete(id);
  renumberFrom(shapes, order, index);
  return { shapes, order };
}

/**
 * Swaps in new versions of existing shapes (same IDs). Draw order never changes here:
 * each shape keeps the zIndex it already has in the document.
 */
export function replaceShapes(document: DocumentState, updated: readonly Shape[]): DocumentState {
  const shapes = new Map(document.shapes);
  for (const shape of updated) {
    const existing = document.shapes.get(shape.id);
    if (existing === undefined) {
      throw new DocumentError(`Shape ${shape.id} does not exist.`);
    }
    shapes.set(
      shape.id,
      shape.zIndex === existing.zIndex ? shape : { ...shape, zIndex: existing.zIndex },
    );
  }
  return { shapes, order: document.order };
}

/** The same shapes in a new draw order; every zIndex is renumbered to match. */
export function reorderShapes(document: DocumentState, order: readonly ShapeId[]): DocumentState {
  const unchanged = new Set(order);
  if (order.length !== document.order.length || document.order.some((id) => !unchanged.has(id))) {
    throw new DocumentError('A new draw order must list exactly the same shapes.');
  }
  const shapes = new Map(document.shapes);
  renumberFrom(shapes, order, 0);
  return { shapes, order: [...order] };
}

function renumberFrom(shapes: Map<ShapeId, Shape>, order: readonly ShapeId[], start: number) {
  for (let zIndex = start; zIndex < order.length; zIndex++) {
    const id = order[zIndex];
    const shape = id === undefined ? undefined : shapes.get(id);
    if (id === undefined || shape === undefined) {
      throw new DocumentError(`Draw order lists ${String(id)}, but no such shape exists.`);
    }
    if (shape.zIndex !== zIndex) {
      shapes.set(id, { ...shape, zIndex });
    }
  }
}
