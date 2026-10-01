import { describe, expect, it, vi } from 'vitest';
import { undo } from './commands';
import { documentFromShapes } from './persistence/fileFormat';
import { createEditorStore } from './store';
import { applyStyle, selectionStyle } from './style';
import { makeLine, makeRect, makeText, testShapeId } from './testing/factories';

const rect = makeRect({ id: testShapeId('r') });
const line = makeLine({ id: testShapeId('l'), style: { ...rect.style, strokeWidth: 4 } });
const text = makeText({ id: testShapeId('t') });

function setup() {
  const store = createEditorStore({
    document: documentFromShapes([rect, line, text]),
    selectedIds: new Set([rect.id, line.id, text.id]),
  });
  const shape = (id: string) => store.getState().document.shapes.get(testShapeId(id));
  return { store, shape };
}

describe('selectionStyle', () => {
  it('reports shared values, mixed ones, and what the selection supports', () => {
    expect(selectionStyle([rect, line, text])).toEqual({
      strokeColor: '#1e2430',
      fillColor: null,
      strokeWidth: 'mixed',
      opacity: 1,
      hasStroke: true,
    });
    expect(selectionStyle([text])).toMatchObject({ fillColor: undefined, hasStroke: false });
    expect(selectionStyle([])).toBeNull();
  });
});

describe('applyStyle', () => {
  it('changes every selected shape in one undo step; fill only reaches fillable shapes', () => {
    const { store, shape } = setup();
    const before = store.getState().document;
    applyStyle(store, { strokeColor: '#d63a45', fillColor: '#ffe1e3' }, vi.fn());
    expect(shape('r')?.style).toMatchObject({ strokeColor: '#d63a45', fillColor: '#ffe1e3' });
    expect(shape('l')?.style).toMatchObject({ strokeColor: '#d63a45', fillColor: null });
    expect(shape('t')?.style.strokeColor).toBe('#d63a45');
    undo(store);
    expect(store.getState().document).toEqual(before);
  });

  it('joins a slider drag into one step and skips changes that change nothing', () => {
    const { store } = setup();
    applyStyle(store, { opacity: 0.8 }, vi.fn(), { key: 'opacity', continues: false });
    applyStyle(store, { opacity: 0.6 }, vi.fn(), { key: 'opacity', continues: true });
    applyStyle(store, { opacity: 0.6 }, vi.fn());
    expect(store.getState().history.past).toHaveLength(1);
  });
});
