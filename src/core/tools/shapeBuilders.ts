import type { Point } from '../geometry/point';
import {
  DEFAULT_SHAPE_STYLE,
  MIN_SHAPE_SIZE,
  type ArrowShape,
  type EllipseShape,
  type LineShape,
  type PathPoint,
  type RectShape,
  type ShapeId,
} from '../shapes';

/** Builds the shape a drag from `start` to `end` (world points) describes. */
export type DragShapeBuilder = (
  id: ShapeId,
  start: Readonly<Point>,
  end: Readonly<Point>,
) => RectShape | EllipseShape | LineShape | ArrowShape;

// createShapeCommand assigns the real zIndex (top of the draw order).
const common = { rotation: 0, style: DEFAULT_SHAPE_STYLE, zIndex: 0 } as const;

/** The box spanned by two points, in any drag direction, at least 1 unit each way. */
function boxBetween(a: Readonly<Point>, b: Readonly<Point>) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.max(MIN_SHAPE_SIZE, Math.abs(b.x - a.x)),
    height: Math.max(MIN_SHAPE_SIZE, Math.abs(b.y - a.y)),
  };
}

export const rectangleBetween: DragShapeBuilder = (id, start, end) => ({
  id,
  type: 'rectangle',
  ...boxBetween(start, end),
  ...common,
});

export const ellipseBetween: DragShapeBuilder = (id, start, end) => ({
  id,
  type: 'ellipse',
  ...boxBetween(start, end),
  ...common,
});

export const lineBetween: DragShapeBuilder = (id, start, end) => ({
  id,
  type: 'line',
  ...pathBetween(start, end),
  ...common,
});

export const arrowBetween: DragShapeBuilder = (id, start, end) => ({
  id,
  type: 'arrow',
  ...pathBetween(start, end),
  ...common,
});

/**
 * A two-point path from `start` to `end`, keeping its direction (it matters for arrows).
 * (x, y) is the top-left of the points' box, so both points are non-negative offsets.
 * Shorter than 1 unit is stretched to 1 along the drag direction.
 */
function pathBetween(start: Readonly<Point>, end: Readonly<Point>) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const target =
    length >= MIN_SHAPE_SIZE
      ? end
      : length === 0
        ? { x: start.x + MIN_SHAPE_SIZE, y: start.y }
        : {
            x: start.x + ((end.x - start.x) / length) * MIN_SHAPE_SIZE,
            y: start.y + ((end.y - start.y) / length) * MIN_SHAPE_SIZE,
          };
  const x = Math.min(start.x, target.x);
  const y = Math.min(start.y, target.y);
  const points: readonly [PathPoint, PathPoint] = [
    { x: start.x - x, y: start.y - y },
    { x: target.x - x, y: target.y - y },
  ];
  return { x, y, points };
}
