import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createShapeCommand, type Command } from '../commands';
import { EMPTY_DOCUMENT, insertShape, removeShape, type DocumentState } from '../document';
import { boundsIntersect, type Bounds } from '../geometry/bounds';
import { shapeBounds } from '../shapeGeometry';
import type { Shape } from '../shapes';
import { shapeArbitrary } from '../testing/arbitraries';
import { testShapeId } from '../testing/factories';
import { createSpatialIndex, type SpatialIndex } from './spatialIndex';
import { syncSpatialIndex } from './syncIndex';

// Each step is one change a user (or, from M4, a command) can make to the document.
type Step =
  | { readonly kind: 'create'; readonly shape: Shape }
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' }
  | { readonly kind: 'remove'; readonly pick: number }
  | { readonly kind: 'replace'; readonly pick: number; readonly shape: Shape };

let nextId = 0;
const freshShape = fc
  .constant(null)
  .chain(() => shapeArbitrary(testShapeId(`s${String(nextId++)}`)));
const pick = fc.nat({ max: 1000 });

const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 4, arbitrary: freshShape.map((shape) => ({ kind: 'create' as const, shape })) },
  { weight: 2, arbitrary: fc.constant({ kind: 'undo' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'redo' as const }) },
  { weight: 1, arbitrary: pick.map((p) => ({ kind: 'remove' as const, pick: p })) },
  {
    weight: 2,
    // Same ID, new geometry: stands in for move / resize / rotate until M4 adds those commands.
    arbitrary: fc
      .tuple(pick, shapeArbitrary(testShapeId('placeholder')))
      .map(([p, shape]) => ({ kind: 'replace' as const, pick: p, shape })),
  },
);

type History = { done: Command[]; undone: Command[] };

function apply(document: DocumentState, s: Step, history: History): DocumentState {
  const pickId = (n: number) => document.order[n % Math.max(1, document.order.length)];
  switch (s.kind) {
    case 'create': {
      const command = createShapeCommand(s.shape);
      history.done.push(command);
      history.undone = [];
      return command.do(document);
    }
    case 'undo': {
      const command = history.done.pop();
      if (command === undefined) return document;
      history.undone.push(command);
      return command.undo(document);
    }
    case 'redo': {
      const command = history.undone.pop();
      if (command === undefined) return document;
      history.done.push(command);
      return command.do(document);
    }
    case 'remove':
    case 'replace': {
      const id = pickId(s.pick);
      const existing = id === undefined ? undefined : document.shapes.get(id);
      if (existing === undefined) return document;
      // Direct edits invalidate the command history, as a real edit would.
      history.done = [];
      history.undone = [];
      const without = removeShape(document, existing.id);
      return s.kind === 'remove'
        ? without
        : insertShape(without, { ...s.shape, id: existing.id, zIndex: existing.zIndex });
    }
  }
}

function rebuild(document: DocumentState): SpatialIndex {
  const index = createSpatialIndex();
  document.shapes.forEach((shape) => {
    index.update(shape);
  });
  return index;
}

function bruteForceQuery(document: DocumentState, area: Bounds): string[] {
  return [...document.shapes.values()]
    .filter((shape) => boundsIntersect(shapeBounds(shape), area))
    .map((shape) => shape.id)
    .sort();
}

const area = fc
  .record({
    x: fc.double({ min: -6000, max: 6000, noNaN: true }),
    y: fc.double({ min: -6000, max: 6000, noNaN: true }),
    size: fc.double({ min: 0, max: 3000, noNaN: true }),
  })
  .map(({ x, y, size }) => ({ minX: x, minY: y, maxX: x + size, maxY: y + size }));

describe('spatial index properties', () => {
  it('after every step, the incrementally synced index equals a full rebuild', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 60 }), (steps) => {
        const index = createSpatialIndex();
        const history: History = { done: [], undone: [] };
        let document = EMPTY_DOCUMENT;
        for (const s of steps) {
          const next = apply(document, s, history);
          syncSpatialIndex(index, document, next);
          document = next;
          expect(index.snapshot()).toEqual(rebuild(document).snapshot());
        }
      }),
    );
  });

  it('query returns exactly the shapes whose bounds intersect the area', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), area, (steps, queryArea) => {
        const history: History = { done: [], undone: [] };
        const document = steps.reduce((doc, s) => apply(doc, s, history), EMPTY_DOCUMENT);
        const found = rebuild(document).query(queryArea).sort();
        expect(found).toEqual(bruteForceQuery(document, queryArea));
      }),
    );
  });
});
