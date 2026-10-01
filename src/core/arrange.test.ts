import { describe, expect, it, vi } from 'vitest';
import { arrangedOrder, arrangeSelection } from './arrange';
import { undo } from './commands';
import { documentFromShapes } from './persistence/fileFormat';
import type { ShapeId } from './shapes';
import { createEditorStore } from './store';
import { makeRect, testShapeId } from './testing/factories';

const ids = ['a', 'b', 'c', 'd', 'e'].map(testShapeId);
const pick = (...names: string[]) => new Set(names.map(testShapeId));
const order = (result: readonly ShapeId[]) => result.join('');

describe('arrangedOrder', () => {
  it.each([
    ['forward', ['b', 'd'], 'acbed'],
    ['backward', ['b', 'd'], 'badce'],
    ['front', ['b', 'd'], 'acebd'],
    ['back', ['b', 'd'], 'bdace'],
    ['forward', ['d', 'e'], 'abcde'],
    ['backward', ['a'], 'abcde'],
  ] as const)('%s with %j selected gives %s', (action, selected, expected) => {
    expect(order(arrangedOrder(ids, pick(...selected), action))).toBe(expected);
  });
});

describe('arrangeSelection', () => {
  it('reorders as one undo step and renumbers zIndex; does nothing when already there', () => {
    const shapes = ids.map((id) => makeRect({ id }));
    const store = createEditorStore({
      document: documentFromShapes(shapes),
      selectedIds: pick('a'),
    });
    const start = store.getState().document;
    arrangeSelection(store, 'front', vi.fn());
    expect(order(store.getState().document.order)).toBe('bcdea');
    expect(store.getState().document.shapes.get(testShapeId('a'))?.zIndex).toBe(4);
    arrangeSelection(store, 'front', vi.fn());
    expect(store.getState().history.past).toHaveLength(1);
    undo(store);
    expect(store.getState().document).toEqual(start);
  });
});
