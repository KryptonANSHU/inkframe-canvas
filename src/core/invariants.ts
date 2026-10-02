import { attachmentViolations } from './attachments';
import { describeIssue, shapeSchema } from './persistence/schema';
import { MIN_SHAPE_SIZE, type Shape } from './shapes';
import { createSpatialIndex, type SpatialIndex } from './spatial/spatialIndex';
import type { EditorState, EditorStore } from './store';

const FULL_TURN = Math.PI * 2;

/**
 * Checks the rules every editor state must keep and returns what is broken,
 * or nothing. With `index`, also checks it against a full rebuild.
 */
export function invariantViolations(state: EditorState, index?: SpatialIndex): string[] {
  const { shapes, order } = state.document;
  const problems: string[] = [];
  if (new Set(order).size !== order.length) {
    problems.push('The draw order lists a shape twice.');
  }
  if (order.length !== shapes.size) {
    problems.push(
      `The draw order has ${String(order.length)} IDs for ${String(shapes.size)} shapes.`,
    );
  }
  order.forEach((id, position) => {
    const shape = shapes.get(id);
    if (shape === undefined) {
      problems.push(`${id} is in the draw order but not in the scene.`);
    } else {
      problems.push(...shapeViolations(shape, id, position));
      if (shape.type === 'arrow') {
        problems.push(...attachmentViolations(shape, (other) => shapes.get(other)));
      }
    }
  });
  for (const id of state.selectedIds) {
    if (!shapes.has(id)) {
      problems.push(`Selected shape ${id} does not exist.`);
    }
  }
  if (index !== undefined && !matchesRebuild(index, state)) {
    problems.push('The spatial index differs from a full rebuild.');
  }
  return problems;
}

/**
 * Reports violations after every document or selection change, through `report`.
 * Meant for dev builds: the index check rebuilds the index each time.
 */
export function watchInvariants(
  store: EditorStore,
  index: SpatialIndex,
  report: (error: Error) => void,
): () => void {
  return store.subscribe((state, previous) => {
    if (state.document === previous.document && state.selectedIds === previous.selectedIds) {
      return;
    }
    const problems = invariantViolations(state, index);
    if (problems.length > 0) {
      report(new Error(`Document invariants broken:\n${problems.join('\n')}`));
    }
  });
}

function shapeViolations(shape: Shape, id: string, position: number): string[] {
  const problems = nonFinitePaths(shape).map((path) => `${id}: ${path} is not a finite number.`);
  if (shape.id !== id) {
    problems.push(`${id} is stored under another shape's ID (${shape.id}).`);
  }
  if (shape.zIndex !== position) {
    problems.push(`${id}: zIndex ${String(shape.zIndex)} at draw position ${String(position)}.`);
  }
  if (!(shape.rotation >= 0 && shape.rotation < FULL_TURN)) {
    problems.push(`${id}: rotation ${String(shape.rotation)} is outside 0–2π.`);
  }
  // Paths have no stored size: a straight horizontal line is legitimately 0 tall.
  if ('width' in shape && !(shape.width >= MIN_SHAPE_SIZE && shape.height >= MIN_SHAPE_SIZE)) {
    problems.push(`${id}: size ${String(shape.width)} × ${String(shape.height)} is under 1.`);
  }
  if (shape.type === 'pen' && shape.points.length < 2) {
    problems.push(`${id}: a pen stroke needs at least 2 points.`);
  }
  // The same schema that guards files, so the document always holds what a file can.
  const parsed = shapeSchema.safeParse(shape);
  if (!parsed.success) {
    problems.push(`${id} fails the document schema: ${describeIssue(parsed.error)}.`);
  }
  return problems;
}

/** Paths (like "points.3.x") to every number in `value` that is NaN or infinite. */
function nonFinitePaths(value: unknown, path = ''): string[] {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? [] : [path];
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    nonFinitePaths(child, path === '' ? key : `${path}.${key}`),
  );
}

/** Assumes the live index uses the default cell size and bounds, as the editor's does. */
function matchesRebuild(index: SpatialIndex, state: EditorState): boolean {
  const rebuilt = createSpatialIndex();
  state.document.shapes.forEach((shape) => {
    rebuilt.update(shape);
  });
  return JSON.stringify(index.snapshot()) === JSON.stringify(rebuilt.snapshot());
}
