import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DOCUMENT } from '../document';
import { MAX_PEN_POINTS, type PenShape } from '../shapes';
import { createEditorStore } from '../store';
import { pointerAt, testShapeId } from '../testing/factories';
import { createPenTool } from './penTool';

function setup(camera = { x: 0, y: 0, zoom: 1 }) {
  const store = createEditorStore({ camera });
  const reportError = vi.fn();
  return { store, tool: createPenTool(store, reportError), reportError };
}

function committed(store: ReturnType<typeof setup>['store']): PenShape {
  const { document } = store.getState();
  expect(document.order).toHaveLength(1);
  const shape = document.shapes.get(document.order[0] ?? testShapeId('none'));
  if (shape?.type !== 'pen') throw new Error('expected a pen shape');
  return shape;
}

describe('pen tool', () => {
  it('records a stroke in world space, with (x, y) at the top-left of its points', () => {
    const { store, tool } = setup({ x: 100, y: 0, zoom: 2 });
    tool.pointerDown(pointerAt(20, 20));
    tool.pointerMove(pointerAt(0, 40));
    tool.pointerMove(pointerAt(40, 60));
    tool.pointerUp(pointerAt(40, 60));

    expect(committed(store)).toMatchObject({
      x: 100,
      y: 10,
      points: [
        { x: 10, y: 0 },
        { x: 0, y: 10 },
        { x: 20, y: 20 },
      ],
    });
    expect(store.getState().draft).toBeNull();
  });

  it('skips pointer moves under 1 screen pixel', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(0.5, 0));
    tool.pointerMove(pointerAt(1, 0));
    tool.pointerMove(pointerAt(1.5, 0.5));
    tool.pointerUp(pointerAt(1.5, 0.5));
    expect(committed(store).points).toHaveLength(2);
  });

  it(`stops adding points at ${String(MAX_PEN_POINTS)}`, () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(0, 0));
    for (let i = 1; i <= MAX_PEN_POINTS + 50; i++) tool.pointerMove(pointerAt(i, 0));
    tool.pointerUp(pointerAt(MAX_PEN_POINTS + 50, 0));
    expect(committed(store).points).toHaveLength(MAX_PEN_POINTS);
  });

  it('draws nothing for a press without movement', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(10, 10));
    tool.pointerUp(pointerAt(10, 10));
    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
  });

  it('shows the stroke as a draft, then commits a copy the tool no longer touches', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(10, 0));
    const draft = store.getState().draft;
    if (draft?.type !== 'pen') throw new Error('expected a pen draft');
    tool.pointerUp(pointerAt(10, 0));

    expect(committed(store).points).not.toBe(draft.points);
    // A new stroke must not change the committed one.
    tool.pointerDown(pointerAt(50, 50));
    tool.pointerMove(pointerAt(60, 60));
    expect(committed(store).points).toHaveLength(2);
  });

  it('changes the document once per stroke', () => {
    const { store, tool } = setup();
    const documentChanges = vi.fn();
    store.subscribe((state, previous) => {
      if (state.document !== previous.document) documentChanges();
    });
    tool.pointerDown(pointerAt(0, 0));
    for (let i = 1; i < 100; i++) tool.pointerMove(pointerAt(i * 2, i));
    tool.pointerUp(pointerAt(200, 100));
    expect(documentChanges).toHaveBeenCalledTimes(1);
  });

  it('cancel clears the draft and leaves the document untouched', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(0, 0));
    tool.pointerMove(pointerAt(30, 30));
    tool.cancel();
    tool.pointerUp(pointerAt(30, 30));
    expect(store.getState().draft).toBeNull();
    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
  });

  it('reports a failed command', () => {
    const { tool, reportError, store } = setup();
    const spy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('same-id' as ReturnType<typeof crypto.randomUUID>);
    for (let stroke = 0; stroke < 2; stroke++) {
      tool.pointerDown(pointerAt(0, 0));
      tool.pointerMove(pointerAt(10, 10));
      tool.pointerUp(pointerAt(10, 10));
    }
    spy.mockRestore();
    expect(store.getState().document.order).toHaveLength(1);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ name: 'CommandError' }));
  });
});
