import { describe, expect, it, vi } from 'vitest';
import { undo } from './commands';
import { performEditAction } from './editActions';
import { expandToGroups, groupSelection, ungroupSelection } from './groups';
import { documentFromShapes, toFile } from './persistence/fileFormat';
import { readFile } from './persistence/readFile';
import type { GroupId } from './shapes';
import { createEditorStore } from './store';
import { makeRect, testShapeId } from './testing/factories';

const shapes = ['a', 'b', 'c'].map((name, zIndex) =>
  makeRect({ id: testShapeId(name), x: zIndex * 200, zIndex }),
);

function setup(...selected: string[]) {
  return createEditorStore({
    document: documentFromShapes(shapes),
    selectedIds: new Set(selected.map(testShapeId)),
  });
}
const groupOf = (store: ReturnType<typeof setup>, name: string) =>
  store.getState().document.shapes.get(testShapeId(name))?.groupId;

describe('groups', () => {
  it('groups the selection as one undo step, and ungroups as another', () => {
    const store = setup('a', 'b');
    const start = store.getState().document;
    groupSelection(store, vi.fn());
    expect(groupOf(store, 'a')).toBeDefined();
    expect(groupOf(store, 'a')).toBe(groupOf(store, 'b'));
    expect(groupOf(store, 'c')).toBeUndefined();

    ungroupSelection(store, vi.fn());
    expect(store.getState().document).toEqual(start);
    expect(store.getState().history.past).toHaveLength(2);
    undo(store);
    undo(store);
    expect(store.getState().document).toEqual(start);
  });

  it('needs two shapes, not already one group', () => {
    const store = setup('a');
    groupSelection(store, vi.fn());
    expect(store.getState().history.past).toHaveLength(0);
    store.setState({ selectedIds: new Set([testShapeId('a'), testShapeId('b')]) });
    groupSelection(store, vi.fn());
    groupSelection(store, vi.fn());
    expect(store.getState().history.past).toHaveLength(1);
  });

  it('expands ids to every member of their groups', () => {
    const store = setup('a', 'b');
    groupSelection(store, vi.fn());
    const ids = expandToGroups(store.getState().document, [testShapeId('a'), testShapeId('c')]);
    expect([...ids].sort()).toEqual(['a', 'b', 'c']);
  });

  it('a duplicated group becomes a new group of its own', () => {
    const store = setup('a', 'b');
    groupSelection(store, vi.fn());
    const original = groupOf(store, 'a');
    performEditAction('duplicate', store, vi.fn());
    const copies = [...store.getState().selectedIds].map(
      (id) => store.getState().document.shapes.get(id)?.groupId,
    );
    expect(copies).toHaveLength(2);
    expect(new Set(copies).size).toBe(1);
    expect(copies[0]).not.toBe(original);
    expect(copies[0]).toBeTypeOf('string');
  });

  it('saves and reads group IDs', () => {
    const grouped = shapes.map((shape) => ({ ...shape, groupId: 'g1' as GroupId }));
    const read = readFile(toFile(documentFromShapes(grouped)));
    expect(read.ok && read.value).toEqual(grouped);
  });
});
