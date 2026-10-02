import { executeCommand, updateShapesCommand } from './commands';
import type { DocumentState } from './document';
import { selectedShapes } from './selection/selectedShapes';
import { createGroupId, type GroupId, type Shape, type ShapeId } from './shapes';
import type { EditorStore } from './store';

/**
 * `ids` plus every other member of their groups: what a click, Shift + click, or marquee
 * selects, since a group selects as a whole. Groups are flat, so one pass is enough.
 */
export function expandToGroups(document: DocumentState, ids: Iterable<ShapeId>): Set<ShapeId> {
  const selected = new Set(ids);
  const groups = new Set<GroupId>();
  for (const id of selected) {
    const groupId = document.shapes.get(id)?.groupId;
    if (groupId !== undefined) groups.add(groupId);
  }
  if (groups.size === 0) return selected;
  for (const shape of document.shapes.values()) {
    if (shape.groupId !== undefined && groups.has(shape.groupId)) selected.add(shape.id);
  }
  return selected;
}

/**
 * Groups the selection (two or more shapes) as one undo step. Shapes already in groups
 * join the new one: groups don't nest.
 */
export function groupSelection(store: EditorStore, reportError: (error: Error) => void): void {
  const before = selectedShapes(store.getState());
  if (!canGroup(before)) return;
  const groupId = createGroupId();
  apply(
    store,
    'Group',
    before,
    before.map((shape) => ({ ...shape, groupId })),
    reportError,
  );
}

/** Two or more shapes that aren't already exactly one group. */
export function canGroup(shapes: readonly Shape[]): boolean {
  const [first] = shapes;
  if (first === undefined || shapes.length < 2) return false;
  return first.groupId === undefined || shapes.some((shape) => shape.groupId !== first.groupId);
}

/** Ungroups every selected shape, as one undo step; the shapes stay selected. */
export function ungroupSelection(store: EditorStore, reportError: (error: Error) => void): void {
  const before = selectedShapes(store.getState()).filter((shape) => shape.groupId !== undefined);
  if (before.length === 0) return;
  apply(store, 'Ungroup', before, before.map(withoutGroup), reportError);
}

/** The shape with no group: the key is left out, as the schema expects. */
export function withoutGroup<T extends Shape>(shape: T): T {
  const { groupId, ...rest } = shape;
  return rest as T;
}

/**
 * Copies get new groups, one per original group, so a duplicated group is a group of
 * its own rather than joining the original.
 */
export function regroupCopies<T extends Shape>(copies: readonly T[]): T[] {
  const fresh = new Map<GroupId, GroupId>();
  return copies.map((shape) => {
    if (shape.groupId === undefined) return shape;
    let groupId = fresh.get(shape.groupId);
    if (groupId === undefined) {
      groupId = createGroupId();
      fresh.set(shape.groupId, groupId);
    }
    return { ...shape, groupId };
  });
}

function apply(
  store: EditorStore,
  label: string,
  before: readonly Shape[],
  after: readonly Shape[],
  reportError: (error: Error) => void,
): void {
  const result = executeCommand(store, updateShapesCommand(label, before, after));
  if (!result.ok) reportError(result.error);
}
