import type { Point } from '../geometry/point';
import { toLocalPoint, toWorldPoint } from '../geometry/transform';
import type { SelectionFrame } from '../selection/selectionFrame';
import { MIN_SHAPE_SIZE, type Shape } from '../shapes';
import type { TextMeasurer } from '../text/layout';
import { isOddQuarterTurn, isRightAngleMultiple, normalizeAngle } from './angles';
import { scaleInPlace, shapeCenter, withCenter } from './shapeTransforms';

/** Which way a handle pulls along the frame's own axes: −1, 0 (that axis stays), or 1. */
export type HandleDirection = { readonly x: -1 | 0 | 1; readonly y: -1 | 0 | 1 };

export type ResizeOptions = {
  /** Alt: resize around the frame center instead of the opposite handle. */
  readonly fromCenter: boolean;
  /** Shift, or forced for selections that can only scale uniformly. */
  readonly keepAspect: boolean;
};

/** Signed scale along the frame's x and y axes (negative = flipped), plus where the center moves. */
export type ResizeResult = {
  readonly scaleX: number;
  readonly scaleY: number;
  /** New frame center relative to the old one, in the frame's local axes. */
  readonly centerShift: Point;
};

/**
 * Turns a handle drag into scale factors. `target` is where the dragged handle should
 * now be, in the frame's local coordinates (relative to its center, rotation undone).
 * The opposite handle (or the center, with Alt) stays put; dragging past it flips.
 */
export function resizeFromHandle(
  frame: SelectionFrame,
  direction: HandleDirection,
  target: Readonly<Point>,
  options: ResizeOptions,
): ResizeResult {
  const halfWidth = frame.width / 2;
  const halfHeight = frame.height / 2;
  const anchorX = options.fromCenter ? 0 : -direction.x * halfWidth;
  const anchorY = options.fromCenter ? 0 : -direction.y * halfHeight;
  let scaleX = isFlat(frame.width) ? 1 : axisScale(direction.x, target.x, anchorX, halfWidth);
  let scaleY = isFlat(frame.height) ? 1 : axisScale(direction.y, target.y, anchorY, halfHeight);

  if (options.keepAspect) {
    [scaleX, scaleY] = keepAspect(direction, scaleX, scaleY);
  }
  scaleX = atLeastMinimum(scaleX, frame.width);
  scaleY = atLeastMinimum(scaleY, frame.height);
  return {
    scaleX,
    scaleY,
    // `+ 0` turns −0 (a centered anchor times a negative) into 0 before it reaches stored shapes.
    centerShift: { x: anchorX * (1 - scaleX) + 0, y: anchorY * (1 - scaleY) + 0 },
  };
}

/** How far the moving edge travelled relative to the anchor, as a signed factor. */
function axisScale(direction: -1 | 0 | 1, target: number, anchor: number, half: number): number {
  const original = direction * half - anchor;
  return direction === 0 || original === 0 ? 1 : (target - anchor) / original;
}

function keepAspect(direction: HandleDirection, scaleX: number, scaleY: number): [number, number] {
  if (direction.x !== 0 && direction.y !== 0) {
    // Corner: the axis that moved further wins; each axis keeps its own flip.
    const magnitude = Math.max(Math.abs(scaleX), Math.abs(scaleY));
    return [Math.sign(scaleX || 1) * magnitude, Math.sign(scaleY || 1) * magnitude];
  }
  // Edge: the other axis follows symmetrically, without flipping.
  return direction.x !== 0 ? [scaleX, Math.abs(scaleX)] : [Math.abs(scaleY), scaleY];
}

/**
 * A side this thin (a flat line, or float noise) can't be scaled: dividing by it
 * overflows to Infinity. It keeps factor 1, so a flat line stays flat.
 */
const FLAT_SIZE = 1e-9;

function isFlat(size: number): boolean {
  return size < FLAT_SIZE;
}

/** Never smaller than 1 world unit; a flat axis keeps factor 1. */
function atLeastMinimum(scale: number, size: number): number {
  if (isFlat(size)) {
    return 1;
  }
  return Math.abs(scale) * size < MIN_SHAPE_SIZE
    ? (Math.sign(scale) || 1) * (MIN_SHAPE_SIZE / size)
    : scale;
}

/**
 * How a scale along the frame's axes acts on a shape turned `relativeRotation` from
 * the frame: its new rotation (relative to the frame) and the scale along its own axes.
 * Exact when the shape is at a quarter-turn multiple; otherwise the scale must be
 * uniform (enforced by the handles), and a single-axis flip turns θ into −θ.
 */
export function shapeScale(
  relativeRotation: number,
  scaleX: number,
  scaleY: number,
): { rotation: number; scaleX: number; scaleY: number } {
  if (isRightAngleMultiple(relativeRotation)) {
    return isOddQuarterTurn(relativeRotation)
      ? { rotation: relativeRotation, scaleX: scaleY, scaleY: scaleX }
      : { rotation: relativeRotation, scaleX, scaleY };
  }
  const magnitude = Math.abs(scaleX);
  if (scaleX >= 0 && scaleY >= 0) {
    return { rotation: relativeRotation, scaleX: magnitude, scaleY: magnitude };
  }
  if (scaleX < 0 && scaleY < 0) {
    return { rotation: relativeRotation + Math.PI, scaleX: magnitude, scaleY: magnitude };
  }
  // Mirror(x)·R(θ) = R(−θ)·Mirror(x);  Mirror(y)·R(θ) = R(π − θ)·Mirror(x).
  const rotation = scaleX < 0 ? -relativeRotation : Math.PI - relativeRotation;
  return { rotation, scaleX: -magnitude, scaleY: magnitude };
}

/** Applies a frame resize to every shape: positions scale with the frame, shapes in place. */
export function resizeShapes(
  shapes: readonly Shape[],
  frame: SelectionFrame,
  result: ResizeResult,
  measurer: TextMeasurer,
): Shape[] {
  const local = { x: 0, y: 0 };
  const world = { x: 0, y: 0 };
  return shapes.map((shape) => {
    const scale = shapeScale(shape.rotation - frame.rotation, result.scaleX, result.scaleY);
    toLocalPoint(shapeCenter(shape), frame.centerX, frame.centerY, frame.rotation, local);
    local.x = local.x * result.scaleX + result.centerShift.x;
    local.y = local.y * result.scaleY + result.centerShift.y;
    toWorldPoint(local, frame.centerX, frame.centerY, frame.rotation, world);
    const scaled = scaleInPlace(shape, scale.scaleX, scale.scaleY, measurer);
    const rotated = { ...scaled, rotation: normalizeAngle(frame.rotation + scale.rotation) };
    return withCenter(rotated, world.x, world.y);
  });
}
