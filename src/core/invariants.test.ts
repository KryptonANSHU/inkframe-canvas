import { describe, expect, it } from 'vitest';
import { EMPTY_DOCUMENT, insertShape, type DocumentState } from './document';
import { invariantViolations } from './invariants';
import type { Shape } from './shapes';
import { createSpatialIndex } from './spatial/spatialIndex';
import { createEditorStore } from './store';
import { makePen, makeRect, testShapeId } from './testing/factories';

const rect = makeRect({ id: testShapeId('r') });
const valid = insertShape(EMPTY_DOCUMENT, rect);

function violations(document: DocumentState, selected: readonly string[] = []) {
  const state = createEditorStore({
    document,
    selectedIds: new Set(selected.map((id) => testShapeId(id))),
  }).getState();
  return invariantViolations(state);
}

/** The valid document with `rect` swapped for a broken version, bypassing document.ts. */
function withShape(shape: Shape): DocumentState {
  return { ...valid, shapes: new Map([[rect.id, shape]]) };
}

describe('invariantViolations', () => {
  it('finds nothing wrong with a valid document and selection', () => {
    expect(violations(valid, ['r'])).toEqual([]);
  });

  it.each([
    ['a missing selected shape', valid, ['gone'], /Selected shape gone/],
    ['a duplicated ID in the order', { ...valid, order: [rect.id, rect.id] }, [], /twice/],
    [
      'an ID missing from the scene',
      { ...valid, order: [testShapeId('x')] },
      [],
      /not in the scene/,
    ],
    ['a zIndex out of step', withShape({ ...rect, zIndex: 3 }), [], /zIndex 3/],
    [
      'NaN anywhere',
      withShape({ ...rect, style: { ...rect.style, opacity: NaN } }),
      [],
      /style\.opacity/,
    ],
    ['a size under 1', withShape({ ...rect, width: 0.5 }), [], /under 1/],
    ['an unnormalized rotation', withShape({ ...rect, rotation: -1 }), [], /rotation/],
    [
      'a one-point pen stroke',
      withShape(makePen({ id: rect.id, points: [{ x: 0, y: 0 }] })),
      [],
      /2 points/,
    ],
  ] as const)('reports %s', (_name, document, selected, message) => {
    expect(violations(document, selected).join('\n')).toMatch(message);
  });

  it('allows a zero-height line: paths have no stored size', () => {
    const line: Shape = {
      ...rect,
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
    };
    expect(violations(withShape(line))).toEqual([]);
  });

  it('compares the spatial index with a full rebuild', () => {
    const state = createEditorStore({ document: valid }).getState();
    const index = createSpatialIndex();
    expect(invariantViolations(state, index).join()).toMatch(/spatial index/);
    index.update(rect);
    expect(invariantViolations(state, index)).toEqual([]);
  });
});
