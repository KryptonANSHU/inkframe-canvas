import { unionBounds, type Bounds } from '../geometry/bounds';
import type { Point } from '../geometry/point';
import { toLocalPoint } from '../geometry/transform';
import {
  HANDLE_DIRECTIONS,
  handleCursor,
  handlePosition,
  singleSegment,
  uniformOnly,
  type HandleId,
  type ResizeHandle,
} from '../selection/handles';
import type { SelectionFrame } from '../selection/selectionFrame';
import { shapeGeometryBounds } from '../shapeGeometry';
import type { Shape } from '../shapes';
import { snapMove, SNAP_REACH_PX, SNAP_THRESHOLD_PX, type Guide } from '../snapping';
import { NO_GUIDES } from '../store';
import type { TextMeasurer } from '../text/layout';
import { moveEndpoint } from '../transform/endpoints';
import { resizeFromHandle, resizeShapes } from '../transform/resize';
import { rotateShapes, snappedDelta } from '../transform/rotate';
import type { ToolPointerEvent } from './tool';

type Modifiers = Pick<ToolPointerEvent, 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;

/** The shapes as they would be at this pointer position, and any snap guides to show. */
export type GestureResult = { readonly shapes: Shape[]; readonly guides: readonly Guide[] };

/**
 * One drag that transforms the selection. `apply` is pure: it returns the shapes as
 * they would be with the pointer at `pointer` (world), so the select tool can preview
 * every move and commit the last result as a single command.
 */
export type TransformGesture = {
  readonly label: string;
  readonly cursor: string;
  readonly originals: readonly Shape[];
  apply(pointer: Readonly<Point>, modifiers: Modifiers): GestureResult;
};

/** Bounds of the shapes a move may snap to, near `area` (the select tool asks the index). */
export type SnapTargets = (area: Bounds) => Bounds[];

export type MoveSnapping = { readonly targets: SnapTargets; readonly zoom: number };

/**
 * Moves the selection with the pointer. With `snapping`, its box snaps to nearby shapes'
 * edges and centers (within 6 screen pixels); holding Ctrl / ⌘ moves freely.
 */
export function moveGesture(
  originals: readonly Shape[],
  start: Readonly<Point>,
  snapping?: MoveSnapping,
): TransformGesture {
  const box = unionOf(originals.map(shapeGeometryBounds));
  return {
    label: 'Move',
    cursor: 'move',
    originals,
    apply(pointer, modifiers) {
      let dx = pointer.x - start.x;
      let dy = pointer.y - start.y;
      let guides = NO_GUIDES;
      if (snapping !== undefined && box !== null && !modifiers.ctrlKey && !modifiers.metaKey) {
        const moving = translated(box, dx, dy);
        const reach = SNAP_REACH_PX / snapping.zoom;
        const area = {
          minX: moving.minX - reach,
          minY: moving.minY - reach,
          maxX: moving.maxX + reach,
          maxY: moving.maxY + reach,
        };
        const snapped = snapMove(moving, snapping.targets(area), SNAP_THRESHOLD_PX / snapping.zoom);
        dx += snapped.dx;
        dy += snapped.dy;
        guides = snapped.guides;
      }
      return {
        shapes: originals.map((shape) => ({ ...shape, x: shape.x + dx, y: shape.y + dy })),
        guides,
      };
    },
  };
}

function unionOf(bounds: readonly Bounds[]): Bounds | null {
  const [first, ...rest] = bounds;
  return first === undefined ? null : rest.reduce(unionBounds, first);
}

function translated(bounds: Bounds, dx: number, dy: number): Bounds {
  return {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy,
  };
}

export type HandleGestureContext = {
  readonly originals: readonly Shape[];
  readonly frame: SelectionFrame;
  readonly start: Readonly<Point>;
  readonly zoom: number;
  readonly measurer: TextMeasurer;
};

export function handleGesture(handle: HandleId, context: HandleGestureContext): TransformGesture {
  if (handle === 'rotate') {
    return rotateGesture(context);
  }
  if (handle === 'start' || handle === 'end') {
    return endpointGesture(handle, context);
  }
  return resizeGesture(handle, context);
}

function resizeGesture(handle: ResizeHandle, context: HandleGestureContext): TransformGesture {
  const { originals, frame, start, zoom, measurer } = context;
  const direction = HANDLE_DIRECTIONS[handle];
  // Where the press landed relative to the handle, so the handle doesn't jump to the pointer.
  const handleAt = toLocalPoint(
    handlePosition(handle, originals, frame, zoom),
    frame.centerX,
    frame.centerY,
    frame.rotation,
    { x: 0, y: 0 },
  );
  const pressAt = toLocalPoint(start, frame.centerX, frame.centerY, frame.rotation, { x: 0, y: 0 });
  const grab = { x: handleAt.x - pressAt.x, y: handleAt.y - pressAt.y };
  const isCorner = direction.x !== 0 && direction.y !== 0;
  const lonelyText = originals.length === 1 && originals[0]?.type === 'text';
  const forcedAspect = uniformOnly(originals, frame) || (lonelyText && isCorner);
  const local = { x: 0, y: 0 };

  return {
    label: 'Resize',
    cursor: handleCursor(handle, frame),
    originals,
    apply(pointer, modifiers) {
      toLocalPoint(pointer, frame.centerX, frame.centerY, frame.rotation, local);
      const target = { x: local.x + grab.x, y: local.y + grab.y };
      const result = resizeFromHandle(frame, direction, target, {
        fromCenter: modifiers.altKey,
        keepAspect: modifiers.shiftKey || forcedAspect,
      });
      return { shapes: resizeShapes(originals, frame, result, measurer), guides: NO_GUIDES };
    },
  };
}

function rotateGesture({ originals, frame, start }: HandleGestureContext): TransformGesture {
  const startAngle = Math.atan2(start.y - frame.centerY, start.x - frame.centerX);
  return {
    label: 'Rotate',
    cursor: 'grabbing',
    originals,
    apply(pointer, modifiers) {
      const turned = Math.atan2(pointer.y - frame.centerY, pointer.x - frame.centerX) - startAngle;
      const delta = snappedDelta(originals, turned, modifiers.shiftKey);
      return {
        shapes: rotateShapes(originals, frame.centerX, frame.centerY, delta),
        guides: NO_GUIDES,
      };
    },
  };
}

function endpointGesture(
  endpoint: 'start' | 'end',
  context: HandleGestureContext,
): TransformGesture {
  const { originals, frame, start, zoom } = context;
  const segment = singleSegment(originals);
  const handleAt = handlePosition(endpoint, originals, frame, zoom);
  const grab = { x: handleAt.x - start.x, y: handleAt.y - start.y };
  return {
    label: 'Resize',
    cursor: 'crosshair',
    originals,
    apply: (pointer) => ({
      shapes:
        segment === null
          ? [...originals]
          : [moveEndpoint(segment, endpoint, { x: pointer.x + grab.x, y: pointer.y + grab.y })],
      guides: NO_GUIDES,
    }),
  };
}
