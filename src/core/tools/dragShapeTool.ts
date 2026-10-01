import { screenToWorld } from '../camera';
import { createShapeCommand, executeCommand } from '../commands';
import { createPoint, distance, type Point } from '../geometry/point';
import { createShapeId, type ShapeId } from '../shapes';
import type { EditorStore } from '../store';
import type { DragShapeBuilder } from './shapeBuilders';
import type { Tool, ToolPointerEvent } from './tool';

/** Screen pixels a press must move before it becomes a drag, so a click never draws. */
export const DRAG_THRESHOLD_PX = 3;

type DragShapeToolState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'pressing';
      readonly startScreen: Readonly<Point>;
      readonly startWorld: Readonly<Point>;
    }
  | { readonly kind: 'dragging'; readonly startWorld: Readonly<Point>; readonly id: ShapeId };

/**
 * Press, drag, release to create one shape: rectangle, ellipse, line, or arrow,
 * depending on `build`. The shape is a draft until release, so cancel leaves no trace.
 */
export function createDragShapeTool(
  store: EditorStore,
  reportError: (error: Error) => void,
  build: DragShapeBuilder,
): Tool {
  let state: DragShapeToolState = { kind: 'idle' };
  const pointerWorld = createPoint();

  const shapeTo = (event: ToolPointerEvent, startWorld: Readonly<Point>, id: ShapeId) =>
    build(id, startWorld, screenToWorld(store.getState().camera, event.screen, pointerWorld));

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
        store.setState({ draft: shapeTo(event, state.startWorld, state.id) });
      }
    },

    pointerUp(event) {
      const finished = state;
      state = { kind: 'idle' };
      if (finished.kind !== 'dragging') {
        return;
      }
      const shape = shapeTo(event, finished.startWorld, finished.id);
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
