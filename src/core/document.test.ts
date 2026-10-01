import { describe, expect, it } from 'vitest';
import { DocumentError, EMPTY_DOCUMENT, insertShape, removeShape } from './document';
import { makeRect, testShapeId } from './testing/factories';

const a = makeRect({ id: testShapeId('a'), zIndex: 0 });
const b = makeRect({ id: testShapeId('b'), zIndex: 1 });
const c = makeRect({ id: testShapeId('c'), zIndex: 2 });
const abc = [a, b, c].reduce(insertShape, EMPTY_DOCUMENT);

function zIndexes(document: typeof abc) {
  return document.order.map((id) => [id, document.shapes.get(id)?.zIndex]);
}

describe('insertShape', () => {
  it('appends shapes in draw order', () => {
    expect(abc.order).toEqual(['a', 'b', 'c']);
    expect(zIndexes(abc)).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('inserts in the middle and moves the shapes above up by one', () => {
    const inserted = insertShape(abc, makeRect({ id: testShapeId('x'), zIndex: 1 }));
    expect(zIndexes(inserted)).toEqual([
      ['a', 0],
      ['x', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('never mutates the input document', () => {
    insertShape(abc, makeRect({ id: testShapeId('x'), zIndex: 0 }));
    expect(abc.order).toEqual(['a', 'b', 'c']);
    expect(abc.shapes.get(testShapeId('a'))).toBe(a);
  });

  it('rejects a duplicate ID', () => {
    expect(() => insertShape(abc, { ...a, zIndex: 3 })).toThrow(DocumentError);
  });

  it.each([-1, 4, 1.5, Number.NaN])('rejects zIndex %s', (zIndex) => {
    const shape = makeRect({ id: testShapeId('x'), zIndex });
    expect(() => insertShape(abc, shape)).toThrow(DocumentError);
  });
});

describe('removeShape', () => {
  it('removes a shape and moves the shapes above down by one', () => {
    const removed = removeShape(abc, testShapeId('a'));
    expect(removed.shapes.has(testShapeId('a'))).toBe(false);
    expect(zIndexes(removed)).toEqual([
      ['b', 0],
      ['c', 1],
    ]);
  });

  it('restores the exact document when the shape is inserted back', () => {
    const removed = removeShape(abc, testShapeId('b'));
    expect(insertShape(removed, b)).toEqual(abc);
  });

  it('rejects an unknown ID', () => {
    expect(() => removeShape(abc, testShapeId('missing'))).toThrow(DocumentError);
  });

  it('reports a draw order that lists a missing shape', () => {
    const corrupted = { ...abc, order: [...abc.order, testShapeId('ghost')] };
    expect(() => removeShape(corrupted, testShapeId('a'))).toThrow(/ghost/);
  });
});
