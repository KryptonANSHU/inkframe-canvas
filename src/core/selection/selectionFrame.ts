import type { Point } from '../geometry/point';
import { toLocalPoint } from '../geometry/transform';
import { shapeBox, shapeGeometryBounds } from '../shapeGeometry';
import type { Shape } from '../shapes';

/** The box around the selection, in world units: rotated with a single shape, axis-aligned for several. */
export type SelectionFrame = {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
};

export function selectionFrame(shapes: readonly Shape[]): SelectionFrame | null {
  const [only] = shapes;
  if (only === undefined) {
    return null;
  }
  if (shapes.length === 1) {
    const box = shapeBox(only);
    return {
      centerX: box.x + box.width / 2,
      centerY: box.y + box.height / 2,
      width: box.width,
      height: box.height,
      rotation: only.rotation,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    const bounds = shapeGeometryBounds(shape);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
    rotation: 0,
  };
}

const local = { x: 0, y: 0 };

/** Whether a world point is inside the frame, with `margin` world units of slack on each side. */
export function frameContains(
  frame: SelectionFrame,
  point: Readonly<Point>,
  margin: number,
): boolean {
  toLocalPoint(point, frame.centerX, frame.centerY, frame.rotation, local);
  return (
    Math.abs(local.x) <= frame.width / 2 + margin && Math.abs(local.y) <= frame.height / 2 + margin
  );
}
