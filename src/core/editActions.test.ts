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
  const clipboard = createShapeClipboard();
  const reportError = vi.fn();
  const perform = (action: EditAction) => {
    performEditAction(action, store, clipboard, reportError);
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

  it('each paste lands one offset further from what was copied', () => {
    const { store, perform, shapes } = setup();
    perform('copy');
    perform('paste');
    perform('paste');
    expect(shapes().map((shape) => shape.x)).toEqual([0, 100, 10, 110, 20, 120]);
    // Copying again starts over from the new selection.
    store.setState({ selectedIds: new Set([a.id]) });
    perform('copy');
    perform('paste');
    expect(shapes().at(-1)?.x).toBe(COPY_OFFSET);
  });

  it('does nothing without a selection or a copy', () => {
    const { store, perform, reportError } = setup();
    store.setState({ selectedIds: new Set() });
    const before = store.getState().history;
    for (const action of ['delete', 'duplicate', 'copy', 'paste', 'save'] as const) {
      perform(action);
    }
    expect(store.getState().history).toBe(before);
    expect(reportError).not.toHaveBeenCalled();
  });
});
