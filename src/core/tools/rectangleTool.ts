import { screenToWorld } from '../camera';
import { createShapeCommand, executeCommand } from '../commands';
import { createPoint, distance, type Point } from '../geometry/point';
import {
  createShapeId,
  DEFAULT_SHAPE_STYLE,
  MIN_SHAPE_SIZE,
  type RectShape,
  type ShapeId,
} from '../shapes';
import type { EditorStore } from '../store';
import type { Tool, ToolPointerEvent } from './tool';

/** Screen pixels a press must move before it becomes a drag, so a click never draws. */
export const DRAG_THRESHOLD_PX = 3;

type RectangleToolState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'pressing';
      readonly startScreen: Readonly<Point>;
      readonly startWorld: Readonly<Point>;
    }
  | { readonly kind: 'dragging'; readonly startWorld: Readonly<Point>; readonly id: ShapeId };

export function createRectangleTool(store: EditorStore, reportError: (error: Error) => void): Tool {
  let state: RectangleToolState = { kind: 'idle' };
  const pointerWorld = createPoint();

  const rectangleTo = (event: ToolPointerEvent, startWorld: Readonly<Point>, id: ShapeId) =>
    rectangleBetween(
      id,
      startWorld,
      screenToWorld(store.getState().camera, event.screen, pointerWorld),
    );

  return {
    getCursor: () => 'crosshair',

    pointerDown(event) {
      const startWorld = screenToWorld(store.getState().camera, event.screen);
      state = { kind: 'pressing', startScreen: { ...event.screen }, startWorld };
    },

    pointerMove(event) {
      if (
        state.kind === 'pressing' &&
        distance(state.startScreen, event.screen) >= DRAG_THRESHOLD_PX
      ) {
        state = { kind: 'dragging', startWorld: state.startWorld, id: createShapeId() };
      }
      if (state.kind === 'dragging') {
        store.setState({ draft: rectangleTo(event, state.startWorld, state.id) });
      }
    },

    pointerUp(event) {
      const finished = state;
      state = { kind: 'idle' };
      if (finished.kind !== 'dragging') {
        return;
      }
      const shape = rectangleTo(event, finished.startWorld, finished.id);
      store.setState({ draft: null });
      const result = executeCommand(store, createShapeCommand(shape));
      if (!result.ok) {
        reportError(result.error);
      }
    },

    cancel() {
      if (state.kind === 'dragging') {
        store.setState({ draft: null });
      }
      state = { kind: 'idle' };
    },
  };
}

/** The rectangle spanned by two world points, in any drag direction, at least 1 unit each way. */
export function rectangleBetween(id: ShapeId, a: Readonly<Point>, b: Readonly<Point>): RectShape {
  return {
    id,
    type: 'rectangle',
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.max(MIN_SHAPE_SIZE, Math.abs(b.x - a.x)),
    height: Math.max(MIN_SHAPE_SIZE, Math.abs(b.y - a.y)),
    rotation: 0,
    style: DEFAULT_SHAPE_STYLE,
    // createShapeCommand assigns the real zIndex (top of the draw order).
    zIndex: 0,
  };
}
