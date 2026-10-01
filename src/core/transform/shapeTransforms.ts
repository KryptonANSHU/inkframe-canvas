import type { Point } from '../geometry/point';
import { shapeBox } from '../shapeGeometry';
import { MIN_SHAPE_SIZE, type PathPoint, type Shape } from '../shapes';
import { layoutText, type TextMeasurer } from '../text/layout';

export function shapeCenter(shape: Shape): Point {
  const box = shapeBox(shape);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The same shape, moved so its box center is (x, y). */
export function withCenter<T extends Shape>(shape: T, x: number, y: number): T {
  const center = shapeCenter(shape);
  return { ...shape, x: shape.x + x - center.x, y: shape.y + y - center.y };
}

/**
 * Scales a shape in its own (unrotated) frame around its center. Negative factors
 * mirror it: paths get mirrored points, boxes just a positive size (they look the
 * same mirrored). Sizes never drop below 1 world unit. Text changes wrap width and,
 * for a uniform scale, font size; its height is re-measured.
 */
export function scaleInPlace(shape: Shape, gx: number, gy: number, measurer: TextMeasurer): Shape {
  const center = shapeCenter(shape);
  return withCenter(scaledGeometry(shape, gx, gy, measurer), center.x, center.y);
}

function scaledGeometry(shape: Shape, gx: number, gy: number, measurer: TextMeasurer): Shape {
  switch (shape.type) {
    case 'rectangle':
    case 'ellipse':
      return {
        ...shape,
        width: Math.max(MIN_SHAPE_SIZE, Math.abs(gx) * shape.width),
        height: Math.max(MIN_SHAPE_SIZE, Math.abs(gy) * shape.height),
      };
    case 'text': {
      const uniform = Math.abs(Math.abs(gx) - Math.abs(gy)) < 1e-9;
      const width = Math.max(MIN_SHAPE_SIZE, Math.abs(gx) * shape.width);
      const fontSize = uniform ? Math.max(1, Math.abs(gx) * shape.fontSize) : shape.fontSize;
      const height = Math.max(
        MIN_SHAPE_SIZE,
        layoutText(shape.text, width, fontSize, measurer).height,
      );
      return { ...shape, width, height, fontSize };
    }
    case 'line':
    case 'arrow': {
      const [start, end] = scalePoints(shape, gx, gy);
      return start === undefined || end === undefined
        ? shape
        : normalizeOrigin({ ...shape, points: [start, end] });
    }
    case 'pen':
      return normalizeOrigin({ ...shape, points: scalePoints(shape, gx, gy) });
  }
}

/** Points scaled (and mirrored, for negative factors) around the center of their box. */
function scalePoints(
  shape: Extract<Shape, { points: unknown }>,
  gx: number,
  gy: number,
): PathPoint[] {
  const box = shapeBox(shape);
  const cx = box.x + box.width / 2 - shape.x;
  const cy = box.y + box.height / 2 - shape.y;
  return shape.points.map((point) => ({
    x: cx + (point.x - cx) * gx,
    y: cy + (point.y - cy) * gy,
  }));
}

/** Shifts a path so (x, y) is the top-left of its points again, without moving it. */
export function normalizeOrigin<T extends Extract<Shape, { points: unknown }>>(shape: T): T {
  let minX = Infinity;
  let minY = Infinity;
  for (const point of shape.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
  }
  if (minX === Infinity || (minX === 0 && minY === 0)) {
    return shape;
  }
  const points = shape.points.map((point) => ({ x: point.x - minX, y: point.y - minY }));
  return { ...shape, x: shape.x + minX, y: shape.y + minY, points };
}
