import fc from 'fast-check';
import { describe, it } from 'vitest';
import type { Point } from '../geometry/point';
import { toWorldPoint } from '../geometry/transform';
import { selectionFrame } from '../selection/selectionFrame';
import { shapeBox } from '../shapeGeometry';
import type { Shape } from '../shapes';
import { fakeMeasurer, makeEllipse, makeRect, testShapeId } from '../testing/factories';
import { resizeFromHandle, resizeShapes, type HandleDirection } from './resize';

const TOLERANCE = 1e-6;
const finite = (min: number, max: number) => fc.double({ min, max, noNaN: true });
const directions: HandleDirection[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
];

const rect = fc
  .record({
    x: finite(-1000, 1000),
    y: finite(-1000, 1000),
    width: finite(1, 500),
    height: finite(1, 500),
    rotation: finite(0, 2 * Math.PI - 1e-9),
  })
  .map((geometry) => makeRect(geometry));

/** Corners and edge midpoints of a shape's rotated box, in world space. */
function handlePoints(shape: Shape): Point[] {
  const box = shapeBox(shape);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return directions.map((d) =>
    toWorldPoint({ x: (d.x * box.width) / 2, y: (d.y * box.height) / 2 }, cx, cy, shape.rotation, {
      x: 0,
      y: 0,
    }),
  );
}

function near(points: readonly Point[], target: Point): boolean {
  return points.some((p) => Math.hypot(p.x - target.x, p.y - target.y) < TOLERANCE * 1000);
}

describe('resize properties', () => {
  it('the opposite handle stays fixed in world space, for any rotation, handle, and drag', () => {
    fc.assert(
      fc.property(
        rect,
        fc.constantFrom(...directions),
        finite(-800, 800),
        finite(-800, 800),
        (shape, direction, tx, ty) => {
          const frame = selectionFrame([shape]);
          if (frame === null) return false;
          const result = resizeFromHandle(
            frame,
            direction,
            { x: tx, y: ty },
            { fromCenter: false, keepAspect: false },
          );
          const [resized] = resizeShapes([shape], frame, result, fakeMeasurer);
          if (resized === undefined) return false;
          const anchor = toWorldPoint(
            { x: (-direction.x * frame.width) / 2, y: (-direction.y * frame.height) / 2 },
            frame.centerX,
            frame.centerY,
            frame.rotation,
            { x: 0, y: 0 },
          );
          return near(handlePoints(resized), anchor);
        },
      ),
    );
  });

  it('the dragged handle lands on the pointer, unless the 1-unit minimum stops it', () => {
    fc.assert(
      fc.property(
        rect,
        fc.constantFrom(...directions),
        finite(-800, 800),
        finite(-800, 800),
        (shape, direction, tx, ty) => {
          const frame = selectionFrame([shape]);
          if (frame === null) return false;
          const target = { x: direction.x === 0 ? 0 : tx, y: direction.y === 0 ? 0 : ty };
          const anchorDistanceX = Math.abs(target.x + (direction.x * frame.width) / 2);
          const anchorDistanceY = Math.abs(target.y + (direction.y * frame.height) / 2);
          fc.pre(
            (direction.x === 0 || anchorDistanceX >= 1) &&
              (direction.y === 0 || anchorDistanceY >= 1),
          );
          const result = resizeFromHandle(frame, direction, target, {
            fromCenter: false,
            keepAspect: false,
          });
          const [resized] = resizeShapes([shape], frame, result, fakeMeasurer);
          if (resized === undefined) return false;
          const dragged = toWorldPoint(target, frame.centerX, frame.centerY, frame.rotation, {
            x: 0,
            y: 0,
          });
          return near(handlePoints(resized), dragged);
        },
      ),
    );
  });

  it('every size stays finite and at least 1 unit, whatever the drag', () => {
    fc.assert(
      fc.property(
        rect,
        fc.constantFrom(...directions),
        finite(-1e4, 1e4),
        finite(-1e4, 1e4),
        fc.boolean(),
        fc.boolean(),
        (shape, direction, tx, ty, fromCenter, keepAspect) => {
          const frame = selectionFrame([shape]);
          if (frame === null) return false;
          const result = resizeFromHandle(
            frame,
            direction,
            { x: tx, y: ty },
            { fromCenter, keepAspect },
          );
          const [resized] = resizeShapes([shape], frame, result, fakeMeasurer);
          return (
            resized?.type === 'rectangle' &&
            resized.width >= 1 &&
            resized.height >= 1 &&
            [resized.x, resized.y, resized.width, resized.height, resized.rotation].every(
              Number.isFinite,
            ) &&
            resized.rotation >= 0 &&
            resized.rotation < 2 * Math.PI
          );
        },
      ),
    );
  });

  it('a uniform group resize scales every distance between shapes by the same factor', () => {
    const member = (id: string) =>
      fc
        .record({ x: finite(-500, 500), y: finite(-500, 500), rotation: finite(0, 6) })
        .map((g) => makeEllipse({ ...g, id: testShapeId(id), width: 40, height: 20 }));
    fc.assert(
      fc.property(member('a'), member('b'), finite(0.1, 5), (a, b, factor) => {
        const frame = selectionFrame([a, b]);
        if (frame === null) return false;
        const result = { scaleX: factor, scaleY: factor, centerShift: { x: 0, y: 0 } };
        const [a2, b2] = resizeShapes([a, b], frame, result, fakeMeasurer);
        if (a2 === undefined || b2 === undefined) return false;
        const gap = (p: Shape, q: Shape) => Math.hypot(p.x - q.x, p.y - q.y);
        return Math.abs(gap(a2, b2) - gap(a, b) * factor) < 1e-6 * (1 + gap(a, b) * factor);
      }),
    );
  });
});
