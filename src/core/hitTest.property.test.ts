import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EMPTY_DOCUMENT, insertShape, type DocumentState } from './document';
import type { Point } from './geometry/point';
import { hitsShape, hitTest, hitTestAll, hitToleranceAt } from './hitTest';
import { shapeBounds } from './shapeGeometry';
import type { Shape, ShapeId } from './shapes';
import { createSpatialIndex } from './spatial/spatialIndex';
import { shapeArbitrary } from './testing/arbitraries';
import { testShapeId } from './testing/factories';

const POINTS_PER_RUN = 10_000;

/** The reference: test every shape, top to bottom, no index. */
function bruteForceHitTest(document: DocumentState, point: Point, zoom: number): ShapeId | null {
  const tolerance = hitToleranceAt(zoom);
  for (let i = document.order.length - 1; i >= 0; i--) {
    const shape = document.shapes.get(document.order[i] ?? testShapeId('missing'));
    if (shape !== undefined && hitsShape(shape, point, tolerance)) {
      return shape.id;
    }
  }
  return null;
}

const documentArbitrary = fc
  .integer({ min: 1, max: 150 })
  .chain((count) =>
    fc.tuple(
      ...Array.from({ length: count }, (_, i) => shapeArbitrary(testShapeId(`s${String(i)}`))),
    ),
  )
  .map((shapes: Shape[]) =>
    shapes.reduce(
      (document, shape) => insertShape(document, { ...shape, zIndex: document.order.length }),
      EMPTY_DOCUMENT,
    ),
  );

/**
 * Half the points are uniform over the scene; half land inside a random shape's bounds,
 * where strokes, fills, rotations, and overlaps actually get tested.
 */
function samplePoints(document: DocumentState, random: () => number): Point[] {
  const shapes = [...document.shapes.values()];
  return Array.from({ length: POINTS_PER_RUN }, (_, i) => {
    if (i % 2 === 0) {
      return { x: (random() - 0.5) * 14_000, y: (random() - 0.5) * 14_000 };
    }
    const shape = shapes[Math.floor(random() * shapes.length)];
    if (shape === undefined) {
      return { x: 0, y: 0 };
    }
    const bounds = shapeBounds(shape);
    return {
      x: bounds.minX + random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + random() * (bounds.maxY - bounds.minY),
    };
  });
}

describe('hit-test properties', () => {
  it(`matches brute force on ${String(POINTS_PER_RUN)} random points per document`, () => {
    fc.assert(
      fc.property(
        documentArbitrary,
        fc.constantFrom(0.1, 0.5, 1, 2, 4),
        fc.integer(),
        (document, zoom, seed) => {
          const index = createSpatialIndex();
          document.shapes.forEach((shape) => {
            index.update(shape);
          });
          const random = mulberry32(seed);
          for (const point of samplePoints(document, random)) {
            const expected = bruteForceHitTest(document, point, zoom);
            expect(hitTest(document, index, point, zoom)).toBe(expected);
            expect(hitTestAll(document, index, point, zoom)[0] ?? null).toBe(expected);
          }
        },
      ),
      // Each run is 10,000 points × up to 150 shapes, checked three ways.
      { numRuns: 5 },
    );
  }, 30_000);
});

/** Small seeded PRNG so a failing run's points are reproducible from fast-check's seed. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
