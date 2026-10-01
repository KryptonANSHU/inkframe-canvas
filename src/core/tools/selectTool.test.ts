import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DOCUMENT, insertShape } from '../document';
import { DEFAULT_SHAPE_STYLE, type Shape } from '../shapes';
import { createSpatialIndex } from '../spatial/spatialIndex';
import { bindSpatialIndex } from '../spatial/syncIndex';
import { createEditorStore } from '../store';
import { makeRect, pointerAt, testShapeId, type Modifiers } from '../testing/factories';
import { createSelectTool } from './selectTool';

const filled = { ...DEFAULT_SHAPE_STYLE, fillColor: '#ff0000' };
// Two overlapping filled squares (b on top) and one far away; all at zoom 1.
const a = makeRect({
  id: testShapeId('a'),
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  style: filled,
  zIndex: 0,
});
const b = makeRect({
  id: testShapeId('b'),
  x: 50,
  y: 50,
  width: 100,
  height: 100,
  style: filled,
  zIndex: 1,
});
const far = makeRect({ id: testShapeId('far'), x: 400, y: 0, width: 50, height: 50, zIndex: 2 });

function setup(shapes: readonly Shape[] = [a, b, far]) {
  const store = createEditorStore({ document: shapes.reduce(insertShape, EMPTY_DOCUMENT) });
  const index = createSpatialIndex();
  bindSpatialIndex(store, index);
  const reportError = vi.fn();
  const tool = createSelectTool(store, index, reportError);
  const selected = () => [...store.getState().selectedIds].sort();
  const shape = (id: string) => store.getState().document.shapes.get(testShapeId(id));
  return { store, tool, selected, shape, reportError };
}

function click(
  tool: ReturnType<typeof setup>['tool'],
  x: number,
  y: number,
  modifiers: Modifiers = {},
) {
  tool.pointerDown(pointerAt(x, y, 1, modifiers));
  tool.pointerUp(pointerAt(x, y, 1, modifiers));
}

function drag(
  tool: ReturnType<typeof setup>['tool'],
  from: readonly [number, number],
  to: readonly [number, number],
  modifiers: Modifiers = {},
) {
  tool.pointerDown(pointerAt(...from, 1, modifiers));
  tool.pointerMove(pointerAt((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 1, modifiers));
  tool.pointerUp(pointerAt(...to, 1, modifiers));
}

describe('select tool: clicking', () => {
  it('selects the topmost shape under the pointer', () => {
    const { tool, selected } = setup();
    click(tool, 75, 75);
    expect(selected()).toEqual(['b']);
  });

  it('clears the selection on empty canvas, unless Shift is held', () => {
    const { tool, selected } = setup();
    click(tool, 75, 75);
    click(tool, 300, 300, { shiftKey: true });
    expect(selected()).toEqual(['b']);
    click(tool, 300, 300);
    expect(selected()).toEqual([]);
  });

  it('Shift + click adds a shape, and removes it on a second Shift + click', () => {
    const { tool, selected } = setup();
    click(tool, 75, 75);
    click(tool, 425, 0, { shiftKey: true });
    expect(selected()).toEqual(['b', 'far']);
    click(tool, 425, 0, { shiftKey: true });
    expect(selected()).toEqual(['b']);
  });

  it('a plain click on one shape of a multi-selection narrows to that shape', () => {
    const { tool, selected } = setup();
    click(tool, 75, 75);
    click(tool, 425, 0, { shiftKey: true });
    click(tool, 425, 0);
    expect(selected()).toEqual(['far']);
  });

  it('Alt + click cycles through every shape under the pointer, then wraps', () => {
    const { tool, selected } = setup();
    click(tool, 75, 75, { altKey: true });
    expect(selected()).toEqual(['b']);
    click(tool, 75, 75, { altKey: true });
    expect(selected()).toEqual(['a']);
    click(tool, 75, 75, { altKey: true });
    expect(selected()).toEqual(['b']);
  });
});

describe('select tool: moving', () => {
  it('drags the pressed shape as one command, with a preview until release', () => {
    const { store, tool, shape } = setup();
    const documentChanges = vi.fn();
    store.subscribe((state, previous) => {
      if (state.document !== previous.document) documentChanges();
    });
    tool.pointerDown(pointerAt(25, 25));
    tool.pointerMove(pointerAt(60, 45));
    expect(store.getState().preview?.get(testShapeId('a'))).toMatchObject({ x: 35, y: 20 });
    expect(shape('a')).toBe(a);
    tool.pointerUp(pointerAt(125, 75));

    expect(shape('a')).toMatchObject({ x: 100, y: 50 });
    expect(store.getState().preview).toBeNull();
    expect(documentChanges).toHaveBeenCalledTimes(1);
  });

  it('moves every selected shape together', () => {
    const { tool, shape } = setup();
    click(tool, 25, 25);
    click(tool, 425, 0, { shiftKey: true });
    drag(tool, [25, 25], [35, 45]);
    expect(shape('a')).toMatchObject({ x: 10, y: 20 });
    expect(shape('far')).toMatchObject({ x: 410, y: 20 });
    expect(shape('b')).toBe(b);
  });

  it('drags the selection from empty space inside its frame', () => {
    const outline = makeRect({ id: testShapeId('outline'), x: 0, y: 0, width: 200, height: 200 });
    const { tool, selected, shape } = setup([outline]);
    click(tool, 100, 0);
    // The middle of an unfilled rectangle is not a hit, but it is inside the selection.
    drag(tool, [100, 100], [130, 100]);
    expect(selected()).toEqual(['outline']);
    expect(shape('outline')).toMatchObject({ x: 30 });
  });

  it('cancel puts the shapes and the selection back', () => {
    const { store, tool, selected, shape } = setup();
    click(tool, 425, 0);
    tool.pointerDown(pointerAt(25, 25));
    tool.pointerMove(pointerAt(80, 80));
    tool.cancel();
    tool.pointerUp(pointerAt(80, 80));
    expect(shape('a')).toBe(a);
    expect(store.getState().preview).toBeNull();
    expect(selected()).toEqual(['far']);
  });

  it('ignores movement under the drag threshold', () => {
    const { store, tool } = setup();
    const before = store.getState().document;
    tool.pointerDown(pointerAt(25, 25));
    tool.pointerMove(pointerAt(27, 26));
    tool.pointerUp(pointerAt(27, 26));
    expect(store.getState().document).toBe(before);
  });

  it('makes no command for a drag that ends where it started', () => {
    const { store, tool } = setup();
    const before = store.getState().document;
    drag(tool, [25, 25], [25, 25]);
    tool.pointerDown(pointerAt(25, 25));
    tool.pointerMove(pointerAt(60, 60));
    tool.pointerUp(pointerAt(25, 25));
    expect(store.getState().document).toBe(before);
  });

  it('shows a move cursor over shapes and the selection, a default cursor elsewhere', () => {
    const { tool } = setup();
    tool.hover(pointerAt(25, 25));
    expect(tool.getCursor()).toBe('move');
    tool.hover(pointerAt(300, 300));
    expect(tool.getCursor()).toBe('default');
  });
});

describe('select tool: marquee', () => {
  it('selects shapes fully inside, updating live and clearing the marquee on release', () => {
    const { store, tool, selected } = setup();
    tool.pointerDown(pointerAt(-10, -10));
    tool.pointerMove(pointerAt(160, 160));
    expect(store.getState().marquee).toEqual({ minX: -10, minY: -10, maxX: 160, maxY: 160 });
    expect(selected()).toEqual(['a', 'b']);
    tool.pointerUp(pointerAt(120, 120));
    expect(selected()).toEqual(['a']);
    expect(store.getState().marquee).toBeNull();
  });

  it('with Ctrl or ⌘, selects shapes the marquee touches', () => {
    const { tool, selected } = setup();
    drag(tool, [-10, -10], [60, 60], { ctrlKey: true });
    expect(selected()).toEqual(['a', 'b']);
    drag(tool, [390, -10], [410, 10], { metaKey: true });
    expect(selected()).toEqual(['far']);
  });

  it('with Shift, adds to the existing selection', () => {
    const { tool, selected } = setup();
    click(tool, 425, 0);
    drag(tool, [-10, -10], [120, 120], { shiftKey: true });
    expect(selected()).toEqual(['a', 'far']);
  });

  it('starting a marquee without Shift clears the old selection', () => {
    const { tool, selected } = setup();
    click(tool, 425, 0);
    drag(tool, [300, 300], [350, 350]);
    expect(selected()).toEqual([]);
  });
});
