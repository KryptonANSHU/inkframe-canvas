import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_DOCUMENT, insertShape } from '../document';
import { createEditorStore } from '../store';
import { makeRect, pointerAt, testShapeId } from '../testing/factories';
import { createDragShapeTool, DRAG_THRESHOLD_PX } from './dragShapeTool';
import { lineBetween, rectangleBetween } from './shapeBuilders';

function setup(camera = { x: 0, y: 0, zoom: 1 }, build = rectangleBetween) {
  const store = createEditorStore({ camera });
  const reportError = vi.fn();
  const tool = createDragShapeTool(store, reportError, build);
  return { store, tool, reportError };
}

function onlyShape(store: ReturnType<typeof setup>['store']) {
  const { document } = store.getState();
  expect(document.order).toHaveLength(1);
  return document.shapes.get(document.order[0] ?? testShapeId('none'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drag shape tool', () => {
  it('creates one rectangle from a drag, in world coordinates', () => {
    const { store, tool } = setup({ x: 100, y: 50, zoom: 2 });
    tool.pointerDown(pointerAt(10, 20));
    tool.pointerMove(pointerAt(60, 70));
    tool.pointerUp(pointerAt(210, 120));

    expect(onlyShape(store)).toMatchObject({ x: 105, y: 60, width: 100, height: 50, zIndex: 0 });
    expect(store.getState().draft).toBeNull();
  });

  it('normalizes a drag up and to the left to positive width and height', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(200, 200));
    tool.pointerMove(pointerAt(150, 150));
    tool.pointerUp(pointerAt(100, 120));

    expect(onlyShape(store)).toMatchObject({ x: 100, y: 120, width: 100, height: 80 });
  });

  it('shows the rectangle as a draft while dragging, outside the document', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(40, 30));

    expect(store.getState().draft).toMatchObject({ x: 0, y: 0, width: 40, height: 30 });
    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
  });

  it(`ignores movement under ${String(DRAG_THRESHOLD_PX)} screen pixels, so a click draws nothing`, () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(2, 2)); // ≈ 2.83 px
    tool.pointerUp(pointerAt(2, 2));

    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
    expect(store.getState().draft).toBeNull();
  });

  it('starts dragging at exactly the threshold', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(DRAG_THRESHOLD_PX, 0));
    expect(store.getState().draft).not.toBeNull();
  });

  it('keeps width and height at least 1 world unit', () => {
    const { store, tool } = setup({ x: 0, y: 0, zoom: 4 });
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(3, 0));
    tool.pointerUp(pointerAt(3, 0));

    expect(onlyShape(store)).toMatchObject({ width: 1, height: 1 });
  });

  it('cancel clears the draft and leaves the document untouched', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(50, 50));
    tool.cancel();
    tool.pointerUp(pointerAt(80, 80));

    expect(store.getState().draft).toBeNull();
    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
  });

  it('changes the document exactly once per gesture', () => {
    const { store, tool } = setup();
    const documentChanges = vi.fn();
    store.subscribe((state, previous) => {
      if (state.document !== previous.document) documentChanges();
    });
    tool.pointerDown(pointerAt(0, 0));
    for (let x = 5; x <= 100; x += 5) tool.pointerMove(pointerAt(x, x));
    tool.pointerUp(pointerAt(100, 100));

    expect(documentChanges).toHaveBeenCalledTimes(1);
  });

  it('reports a failed command and keeps the document unchanged', () => {
    const existing = makeRect({ id: testShapeId('taken') });
    const store = createEditorStore({ document: insertShape(EMPTY_DOCUMENT, existing) });
    const before = store.getState().document;
    const reportError = vi.fn();
    const tool = createDragShapeTool(store, reportError, rectangleBetween);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('taken' as ReturnType<typeof crypto.randomUUID>);

    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(50, 50));
    tool.pointerUp(pointerAt(50, 50));

    expect(store.getState().document).toBe(before);
    expect(store.getState().draft).toBeNull();
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ name: 'CommandError' }));
  });

  it('builds whichever shape it was given, from the drag start to the release point', () => {
    const { store, tool } = setup(undefined, lineBetween);
    tool.pointerDown(pointerAt(100, 100));
    tool.pointerMove(pointerAt(60, 120));
    tool.pointerUp(pointerAt(40, 130));

    expect(onlyShape(store)).toMatchObject({
      type: 'line',
      x: 40,
      y: 100,
      points: [
        { x: 60, y: 0 },
        { x: 0, y: 30 },
      ],
    });
  });

  it('selects the new shape and switches back to the select tool', () => {
    const { store, tool } = setup();
    store.setState({ activeTool: 'rectangle' });
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(40, 40));
    tool.pointerUp(pointerAt(40, 40));
    const [id] = store.getState().document.order;
    expect([...store.getState().selectedIds]).toEqual([id]);
    expect(store.getState().activeTool).toBe('select');
  });
});
