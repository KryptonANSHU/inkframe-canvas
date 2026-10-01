import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DOCUMENT, insertShape } from '../document';
import { DEFAULT_SHAPE_STYLE, type Shape } from '../shapes';
import { createSpatialIndex } from '../spatial/spatialIndex';
import { bindSpatialIndex } from '../spatial/syncIndex';
import { createEditorStore } from '../store';
import { makeLine, makeRect, pointerAt, testShapeId, type Modifiers } from '../testing/factories';
import { selectionFrame } from '../selection/selectionFrame';
import { fakeMeasurer } from '../testing/factories';
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
  const tool = createSelectTool({ store, index, measurer: fakeMeasurer, reportError });
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

describe('select tool: handles', () => {
  // One 100 × 50 rectangle at the origin, selected; handles sit on its frame.
  function selectedRect() {
    const rect = makeRect({ id: testShapeId('r'), x: 0, y: 0, width: 100, height: 50 });
    const env = setup([rect]);
    env.store.setState({ selectedIds: new Set([rect.id]) });
    return env;
  }

  it('resizes from a corner as one command, keeping the opposite corner', () => {
    const { tool, shape, store } = selectedRect();
    const documentChanges = vi.fn();
    store.subscribe((s, p) => {
      if (s.document !== p.document) documentChanges();
    });
    drag(tool, [100, 50], [150, 100]);
    expect(shape('r')).toMatchObject({ x: 0, y: 0, width: 150, height: 100 });
    expect(documentChanges).toHaveBeenCalledTimes(1);
  });

  it('keeps the grab offset, so the handle does not jump to the pointer', () => {
    const { tool, shape } = selectedRect();
    // Press 3 px inside the corner handle, drag by (+50, +50).
    drag(tool, [97, 47], [147, 97]);
    expect(shape('r')).toMatchObject({ width: 150, height: 100 });
  });

  it('with Shift keeps the aspect ratio, with Alt resizes around the center', () => {
    const shifted = selectedRect();
    drag(shifted.tool, [100, 50], [300, 60], { shiftKey: true });
    expect(shifted.shape('r')).toMatchObject({ width: 300, height: 150 });

    const centered = selectedRect();
    drag(centered.tool, [100, 50], [150, 75], { altKey: true });
    expect(centered.shape('r')).toMatchObject({ x: -50, y: -25, width: 200, height: 100 });
  });

  it('resizes one side from an edge handle', () => {
    const { tool, shape } = selectedRect();
    drag(tool, [100, 25], [40, 300]);
    expect(shape('r')).toMatchObject({ x: 0, y: 0, width: 40, height: 50 });
  });

  it('flips a line when dragged past the anchor, without negative sizes', () => {
    const line = makeLine({
      id: testShapeId('l'),
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    });
    const pen = makeRect({ id: testShapeId('p'), x: 0, y: 100, width: 100, height: 50 });
    const { tool, shape, store } = setup([line, pen]);
    store.setState({ selectedIds: new Set([line.id, pen.id]) });
    // Group frame spans x 0–100, y 0–150; drag its right edge 100 left of its left edge.
    drag(tool, [100, 75], [-100, 75]);
    expect(shape('l')).toMatchObject({
      x: -100,
      points: [
        { x: 100, y: 0 },
        { x: 0, y: 0 },
      ],
    });
    expect(shape('p')).toMatchObject({ x: -100, width: 100 });
  });

  it('rotates around the center, snapping to 15° with Shift', () => {
    const { tool, shape } = selectedRect();
    // The rotation handle is 24 px above the top-center (50, −24); the center is (50, 25).
    drag(tool, [50, -24], [99, 25]);
    expect(shape('r')?.rotation).toBeCloseTo(Math.PI / 2, 9);

    const snapping = selectedRect();
    drag(snapping.tool, [50, -24], [80, -20], { shiftKey: true });
    const rotation = snapping.shape('r')?.rotation ?? 0;
    expect((rotation / (Math.PI / 12)) % 1).toBeCloseTo(0, 9);
  });

  it('drags one end of a lone line', () => {
    const line = makeLine({
      id: testShapeId('l'),
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    });
    const { tool, shape, store } = setup([line]);
    store.setState({ selectedIds: new Set([line.id]) });
    drag(tool, [100, 0], [100, 80]);
    expect(shape('l')).toMatchObject({
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 80 },
      ],
    });
  });

  it('forces a uniform resize for a group with mixed rotations', () => {
    const a = makeRect({ id: testShapeId('a'), x: 0, y: 0, width: 100, height: 100 });
    const b = makeRect({
      id: testShapeId('b'),
      x: 200,
      y: 200,
      width: 100,
      height: 100,
      rotation: 0.5,
    });
    const { tool, store } = setup([a, b]);
    store.setState({ selectedIds: new Set([a.id, b.id]) });
    const frame = selectionFrame([a, b]);
    if (frame === null) throw new Error('no frame');
    const corner = { x: frame.centerX + frame.width / 2, y: frame.centerY + frame.height / 2 };
    // Pull the corner right only; the height must follow.
    drag(tool, [corner.x, corner.y], [corner.x + frame.width, corner.y]);
    expect(store.getState().document.shapes.get(a.id)).toMatchObject({ width: 200, height: 200 });
  });

  it('Alt + click on a handle still cycles, while Alt + drag resizes from the center', () => {
    const under = makeRect({
      id: testShapeId('under'),
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zIndex: 0,
    });
    const over = makeRect({
      id: testShapeId('over'),
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      zIndex: 1,
    });
    const { tool, selected, store } = setup([under, over]);
    store.setState({ selectedIds: new Set([over.id]) });
    // (50, 0) is the top-center handle of the selected shape and on both top edges.
    click(tool, 50, 0, { altKey: true });
    expect(selected()).toEqual(['under']);
  });

  it('cancel mid-resize puts the shape back', () => {
    const { tool, shape } = selectedRect();
    tool.pointerDown(pointerAt(100, 50));
    tool.pointerMove(pointerAt(300, 300));
    tool.cancel();
    tool.pointerUp(pointerAt(300, 300));
    expect(shape('r')).toMatchObject({ width: 100, height: 50 });
  });

  it('adds no command for a resize that ends where it started', () => {
    const { tool, store } = selectedRect();
    const before = store.getState().document;
    tool.pointerDown(pointerAt(100, 50));
    tool.pointerMove(pointerAt(150, 90));
    tool.pointerUp(pointerAt(100, 50));
    expect(store.getState().document).toBe(before);
  });

  it('shows a resize cursor over handles and the drag cursor during a gesture', () => {
    const { tool } = selectedRect();
    tool.hover(pointerAt(100, 50));
    expect(tool.getCursor()).toBe('nwse-resize');
    tool.hover(pointerAt(50, -24));
    expect(tool.getCursor()).toBe('grab');
    tool.pointerDown(pointerAt(50, -24));
    tool.pointerMove(pointerAt(80, -10));
    expect(tool.getCursor()).toBe('grabbing');
  });
});
