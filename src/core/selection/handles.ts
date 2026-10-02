import { worldToScreen, type Camera } from '../camera';
import type { Point } from '../geometry/point';
import { toWorldPoint } from '../geometry/transform';
import { pathWorldPoints } from '../shapeGeometry';
import type { ArrowShape, LineShape, Shape } from '../shapes';
import { isRightAngleMultiple } from '../transform/angles';
import type { HandleDirection } from '../transform/resize';
import type { SelectionFrame } from './selectionFrame';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type HandleId = ResizeHandle | 'rotate' | 'start' | 'end';

/** Drawn size of a resize handle, in screen pixels. */
export const HANDLE_SIZE_PX = 8;
/** How close the pointer must be to a handle's center to grab it, in screen pixels. */
export const HANDLE_HIT_PX = 8;
/** On touch, handles draw larger and grab from a finger's width away. */
export const TOUCH_HANDLE_SIZE_PX = 12;
export const TOUCH_HANDLE_HIT_PX = 22;
/** Gap between the frame's top edge and the rotation handle, in screen pixels. */
export const ROTATE_HANDLE_OFFSET_PX = 24;
/** Below this on-screen length, a side's middle handle is hidden so corners stay grabbable. */
const MIN_SIDE_FOR_EDGE_HANDLE_PX = 3 * HANDLE_SIZE_PX;

export const HANDLE_DIRECTIONS: Readonly<Record<ResizeHandle, HandleDirection>> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
};

const CORNERS: readonly ResizeHandle[] = ['nw', 'ne', 'se', 'sw'];

/** A lone line or arrow is edited by its two ends, not a box. */
export function singleSegment(shapes: readonly Shape[]): LineShape | ArrowShape | null {
  const [only] = shapes;
  return shapes.length === 1 &&
    only !== undefined &&
    (only.type === 'line' || only.type === 'arrow')
    ? only
    : null;
}

/**
 * A selection can only scale uniformly when stretching would distort a member:
 * a shape not at a quarter turn from the frame, or text (its height follows its text).
 */
export function uniformOnly(shapes: readonly Shape[], frame: SelectionFrame): boolean {
  if (shapes.length === 1) {
    return false;
  }
  return shapes.some(
    (shape) => shape.type === 'text' || !isRightAngleMultiple(shape.rotation - frame.rotation),
  );
}

/** Which handles the selection offers, at the current zoom. */
export function availableHandles(
  shapes: readonly Shape[],
  frame: SelectionFrame,
  zoom: number,
): HandleId[] {
  if (singleSegment(shapes) !== null) {
    return ['start', 'end'];
  }
  const handles: HandleId[] = [...CORNERS];
  if (!uniformOnly(shapes, frame)) {
    const lonelyText = shapes.length === 1 && shapes[0]?.type === 'text';
    if (frame.height * zoom >= MIN_SIDE_FOR_EDGE_HANDLE_PX) {
      handles.push('e', 'w');
    }
    // Text height follows its content, so text has no top or bottom handle.
    if (!lonelyText && frame.width * zoom >= MIN_SIDE_FOR_EDGE_HANDLE_PX) {
      handles.push('n', 's');
    }
  }
  handles.push('rotate');
  return handles;
}

/** A handle's position in world space. */
export function handlePosition(
  handle: HandleId,
  shapes: readonly Shape[],
  frame: SelectionFrame,
  zoom: number,
): Point {
  if (handle === 'start' || handle === 'end') {
    const segment = singleSegment(shapes);
    const points = segment === null ? [] : pathWorldPoints(segment);
    const point = handle === 'start' ? points[0] : points.at(-1);
    return point ?? { x: frame.centerX, y: frame.centerY };
  }
  const local =
    handle === 'rotate'
      ? { x: 0, y: -frame.height / 2 - ROTATE_HANDLE_OFFSET_PX / zoom }
      : {
          x: (HANDLE_DIRECTIONS[handle].x * frame.width) / 2,
          y: (HANDLE_DIRECTIONS[handle].y * frame.height) / 2,
        };
  return toWorldPoint(local, frame.centerX, frame.centerY, frame.rotation, { x: 0, y: 0 });
}

/** The handle under a screen point, nearest first, or null. */
export function handleAt(
  shapes: readonly Shape[],
  frame: SelectionFrame,
  camera: Camera,
  screen: Readonly<Point>,
  touch = false,
): HandleId | null {
  let best: HandleId | null = null;
  let bestDistance = touch ? TOUCH_HANDLE_HIT_PX : HANDLE_HIT_PX;
  for (const handle of availableHandles(shapes, frame, camera.zoom)) {
    const position = worldToScreen(camera, handlePosition(handle, shapes, frame, camera.zoom));
    const distance = Math.hypot(position.x - screen.x, position.y - screen.y);
    if (distance <= bestDistance) {
      best = handle;
      bestDistance = distance;
    }
  }
  return best;
}

const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'] as const;

/** A resize cursor turned with the frame, so the arrows always point along the drag. */
export function handleCursor(handle: HandleId, frame: SelectionFrame): string {
  if (handle === 'rotate') {
    return 'grab';
  }
  if (handle === 'start' || handle === 'end') {
    return 'crosshair';
  }
  const direction = HANDLE_DIRECTIONS[handle];
  const angle = Math.atan2(direction.y, direction.x) + frame.rotation;
  // Cursors repeat every half turn; pick the nearest of the four 45° steps.
  const step = Math.round(angle / (Math.PI / 4));
  return RESIZE_CURSORS[((step % 4) + 4) % 4] ?? 'default';
}
