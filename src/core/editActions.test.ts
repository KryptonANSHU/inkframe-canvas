import { describe, expect, it, vi } from 'vitest';
import { createShapesCommand, executeCommand } from './commands';
import {
  COPY_OFFSET,
  createShapeClipboard,
  performEditAction,
  type EditAction,
} from './editActions';
import { createEditorStore } from './store';
import { makeEllipse, makeRect, testShapeId } from './testing/factories';

const a = makeRect({ id: testShapeId('a'), x: 0 });
const b = makeEllipse({ id: testShapeId('b'), x: 100 });

function setup() {
  const store = createEditorStore();
  executeCommand(store, createShapesCommand('Setup', [a, b]), { select: new Set([a.id, b.id]) });
  const reportError = vi.fn();
  const perform = (action: EditAction) => {
    performEditAction(action, store, reportError);
  };
  const shapes = () => [...store.getState().document.shapes.values()];
  return { store, perform, shapes, reportError };
}

describe('edit actions', () => {
  it('delete removes the selection; undo brings back the same shapes and selection', () => {
    const { store, perform } = setup();
    const before = store.getState();
    perform('delete');
    expect(store.getState().document.order).toEqual([]);
    expect(store.getState().selectedIds.size).toBe(0);
    perform('undo');
    expect(store.getState().document).toEqual(before.document);
    expect(store.getState().selectedIds).toEqual(before.selectedIds);
  });

  it('duplicate adds offset copies with new IDs on top, and selects them', () => {
    const { store, perform, shapes } = setup();
    perform('duplicate');
    const copies = shapes().slice(2);
    expect(copies.map((shape) => [shape.type, shape.x, shape.zIndex])).toEqual([
      ['rectangle', COPY_OFFSET, 2],
      ['ellipse', 100 + COPY_OFFSET, 3],
    ]);
    expect([...store.getState().selectedIds]).toEqual(copies.map((shape) => shape.id));
    expect(copies.map((shape) => shape.id)).not.toContain(a.id);
  });

  it('each paste of the same shapes lands one offset further', () => {
    const { store, shapes, reportError } = setup();
    const clipboard = createShapeClipboard();
    const copied = clipboard.copy(store);
    clipboard.paste(store, copied, reportError);
    clipboard.paste(store, copied, reportError);
    expect(shapes().map((shape) => shape.x)).toEqual([0, 100, 10, 110, 20, 120]);
    expect([...store.getState().selectedIds]).toEqual(
      shapes()
        .slice(4)
        .map((shape) => shape.id),
    );
    // Shapes copied elsewhere (another tab) start again one offset away.
    clipboard.paste(store, [makeRect({ id: testShapeId('other'), x: 50 })], reportError);
    expect(shapes().at(-1)?.x).toBe(50 + COPY_OFFSET);
  });

  it('does nothing without a selection', () => {
    const { store, perform, reportError } = setup();
    store.setState({ selectedIds: new Set() });
    const before = store.getState().history;
    expect(createShapeClipboard().copy(store)).toEqual([]);
    for (const action of ['delete', 'duplicate', 'save'] as const) {
      perform(action);
    }
    expect(store.getState().history).toBe(before);
    expect(reportError).not.toHaveBeenCalled();
  });
});

describe('select all', () => {
  it('selects every shape, as plain UI state (not an undo step)', () => {
    const { store, perform } = setup();
    store.setState({ selectedIds: new Set() });
    const history = store.getState().history;
    perform('selectAll');
    expect([...store.getState().selectedIds]).toEqual(['a', 'b']);
    expect(store.getState().history).toBe(history);
  });
});
