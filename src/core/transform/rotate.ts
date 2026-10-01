import type { Shape } from '../shapes';
import { normalizeAngle, snapAngle } from './angles';
import { shapeCenter, withCenter } from './shapeTransforms';

/** Shift + rotate snaps to 15° steps (PRD 1C). */
export const ROTATION_SNAP = Math.PI / 12;

/** Turns every shape by `delta` radians around (centerX, centerY): positions orbit, rotations add. */
export function rotateShapes(
  shapes: readonly Shape[],
  centerX: number,
  centerY: number,
  delta: number,
): Shape[] {
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  return shapes.map((shape) => {
    const center = shapeCenter(shape);
    const dx = center.x - centerX;
    const dy = center.y - centerY;
    const turned = { ...shape, rotation: normalizeAngle(shape.rotation + delta) };
    return withCenter(turned, centerX + dx * cos - dy * sin, centerY + dx * sin + dy * cos);
  });
}

/**
 * The rotation to apply for a drag of `delta`, snapped with Shift. A single shape snaps
 * its final angle (so it lands on 0°, 15°, 30°, …); a group snaps the turn itself.
 */
export function snappedDelta(shapes: readonly Shape[], delta: number, snap: boolean): number {
  if (!snap) {
    return delta;
  }
  const [only] = shapes;
  if (shapes.length === 1 && only !== undefined) {
    return snapAngle(only.rotation + delta, ROTATION_SNAP) - only.rotation;
  }
  return snapAngle(delta, ROTATION_SNAP);
}
