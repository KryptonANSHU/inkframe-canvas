import { describe, expect, it } from 'vitest';
import { createShapeCommand, executeCommand } from '../commands';
import { EMPTY_DOCUMENT, insertShape, removeShape } from '../document';
import { boundsAround } from '../geometry/bounds';
import { createEditorStore } from '../store';
import { makeRect, testShapeId } from '../testing/factories';
import { createSpatialIndex } from './spatialIndex';
import { bindSpatialIndex, syncSpatialIndex } from './syncIndex';

const a = makeRect({ id: testShapeId('a'), x: 0, y: 0, width: 50, height: 50 });
const b = makeRect({ id: testShapeId('b'), x: 1000, y: 1000, width: 50, height: 50 });

describe('createSpatialIndex', () => {
  it('finds shapes near a point and skips distant ones', () => {
    const index = createSpatialIndex();
    index.update(a);
    index.update(b);
    expect(index.query(boundsAround(25, 25, 1))).toEqual(['a']);
    expect(index.query(boundsAround(500, 500, 1))).toEqual([]);
  });

  it('re-files a shape when it moves', () => {
    const index = createSpatialIndex();
    index.update(a);
    index.update({ ...a, x: 2000 });
    expect(index.query(boundsAround(25, 25, 1))).toEqual([]);
    expect(index.query(boundsAround(2025, 25, 1))).toEqual(['a']);
    expect(index.size()).toBe(1);
  });

  it('forgets removed shapes and leaves no empty cells behind', () => {
    const index = createSpatialIndex();
    index.update(a);
    index.remove(a.id);
    index.remove(testShapeId('never-added'));
    expect(index.query(boundsAround(25, 25, 1))).toEqual([]);
    expect(index.snapshot()).toEqual({ entries: [], cells: [] });
  });

  it('keeps shapes that cover too many cells in an oversized list', () => {
    const index = createSpatialIndex({ cellSize: 10 });
    const huge = makeRect({ id: testShapeId('huge'), width: 5000, height: 5000 });
    index.update(huge);
    expect(index.snapshot().cells).toEqual([]);
    expect(index.query(boundsAround(2500, 2500, 1))).toEqual(['huge']);
    expect(index.query(boundsAround(9000, 9000, 1))).toEqual([]);
  });

  it('answers very large queries by scanning every entry', () => {
    const index = createSpatialIndex({ cellSize: 10 });
    index.update(a);
    index.update(b);
    expect(index.query({ minX: -1e5, minY: -1e5, maxX: 1e5, maxY: 1e5 }).sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('still returns shapes with non-finite bounds, so nothing silently disappears', () => {
    const index = createSpatialIndex();
    index.update(makeRect({ id: testShapeId('nan'), x: Number.NaN }));
    expect(index.snapshot().entries[0]?.[2]).toBe('oversized');
  });

  it('skips re-indexing when only the zIndex changed', () => {
    const index = createSpatialIndex();
    index.update(a);
    const before = index.snapshot();
    index.update({ ...a, zIndex: 5 });
    expect(index.snapshot()).toEqual(before);
  });

  it('places shapes far beyond the precision range without failing', () => {
    const index = createSpatialIndex();
    const far = makeRect({ id: testShapeId('far'), x: 1e12, y: -1e12 });
    index.update(far);
    expect(index.query(boundsAround(1e12 + 1, -1e12 + 1, 1))).toEqual(['far']);
  });
});

describe('syncSpatialIndex', () => {
  it('adds new shapes, re-indexes changed ones, and removes deleted ones', () => {
    const index = createSpatialIndex();
    const first = [a, b].reduce(insertShape, EMPTY_DOCUMENT);
    syncSpatialIndex(index, EMPTY_DOCUMENT, first);
    expect(index.size()).toBe(2);

    const second = removeShape(first, a.id);
    syncSpatialIndex(index, first, second);
    expect(index.query(boundsAround(25, 25, 1))).toEqual([]);
    expect(index.size()).toBe(1);
  });
});

describe('bindSpatialIndex', () => {
  it('indexes the current document, follows commands, and stops when unbound', () => {
    const store = createEditorStore({ document: insertShape(EMPTY_DOCUMENT, a) });
    const index = createSpatialIndex();
    const unbind = bindSpatialIndex(store, index);
    expect(index.size()).toBe(1);

    executeCommand(store, createShapeCommand(b));
    expect(index.size()).toBe(2);

    unbind();
    executeCommand(store, createShapeCommand(makeRect({ id: testShapeId('c') })));
    expect(index.size()).toBe(2);
  });
});
