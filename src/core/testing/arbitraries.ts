import fc from 'fast-check';
import type { PathPoint, Shape, ShapeId, ShapeStyle } from '../shapes';

const coordinate = fc.double({ min: -5000, max: 5000, noNaN: true });
const size = fc.double({ min: 1, max: 2000, noNaN: true });
const rotation = fc.double({ min: 0, max: Math.PI * 2, maxExcluded: true, noNaN: true });
const point: fc.Arbitrary<PathPoint> = fc.record({
  x: fc.double({ min: 0, max: 800, noNaN: true }),
  y: fc.double({ min: 0, max: 800, noNaN: true }),
});

export const styleArbitrary: fc.Arbitrary<ShapeStyle> = fc.record({
  strokeColor: fc.constant('#1e2430'),
  fillColor: fc.option(fc.constant('#f5c542'), { nil: null }),
  strokeWidth: fc.double({ min: 1, max: 20, noNaN: true }),
  opacity: fc.constant(1),
});

/** Any shape type with any placement, rotation, and style. IDs come from `id`. */
export function shapeArbitrary(id: ShapeId): fc.Arbitrary<Shape> {
  const base = {
    id: fc.constant(id),
    x: coordinate,
    y: coordinate,
    rotation,
    style: styleArbitrary,
    zIndex: fc.constant(0),
  };
  return fc.oneof(
    fc.record({ ...base, type: fc.constant('rectangle' as const), width: size, height: size }),
    fc.record({ ...base, type: fc.constant('ellipse' as const), width: size, height: size }),
    fc.record({ ...base, type: fc.constant('line' as const), points: fc.tuple(point, point) }),
    fc.record({ ...base, type: fc.constant('arrow' as const), points: fc.tuple(point, point) }),
    fc.record({
      ...base,
      type: fc.constant('text' as const),
      width: size,
      height: size,
      text: fc.constant('Text'),
      fontSize: fc.constant(20),
    }),
    fc.record({
      ...base,
      type: fc.constant('pen' as const),
      points: fc.array(point, { minLength: 2, maxLength: 40 }),
    }),
  );
}
