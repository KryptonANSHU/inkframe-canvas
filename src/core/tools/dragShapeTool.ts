import { withEnd, type AnchorFinder } from '../attachments';
import { screenToWorld } from '../camera';
import { distance, type Point } from '../geometry/point';
import { gridSnapping, snapPointToGrid } from '../grid';
import {
  createShapeId,
  MIN_SHAPE_SIZE,
  type Attachment,
  type Shape,
  type ShapeId,
} from '../shapes';
import { createAndSelect } from './selectCreated';
import { EMPTY_SELECTION, type EditorStore } from '../store';
import type { DragShapeBuilder } from './shapeBuilders';
import type { Tool, ToolPointerEvent } from './tool';

/** Screen pixels a press must move before it becomes a drag, so a click never draws. */
export const DRAG_THRESHOLD_PX = 3;

/** A point the shape is drawn from or to, and the anchor it is attached to, if any. */
type DragEnd = { readonly point: Readonly<Point>; readonly attachment: Attachment | null };

type DragShapeToolState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pressing'; readonly startScreen: Readonly<Point>; readonly start: DragEnd }
  | { readonly kind: 'dragging'; readonly start: DragEnd; readonly id: ShapeId };

/**
 * Press, drag, release to create one shape: rectangle, ellipse, line, or arrow,
 * depending on `build`. The shape is a draft until release, so cancel leaves no trace.
 * With `anchors` (arrows), an end near a shape snaps to one of its anchors and stays
 * attached to it; otherwise ends snap to the grid while it is shown.
 */
export function createDragShapeTool(
  store: EditorStore,
  reportError: (error: Error) => void,
  build: DragShapeBuilder,
  anchors?: AnchorFinder,
): Tool {
  let state: DragShapeToolState = { kind: 'idle' };
  let selectionBefore: ReadonlySet<ShapeId> = EMPTY_SELECTION;

  // Ctrl / ⌘ draws freely: no anchors, no grid.
  const endAt = (event: ToolPointerEvent, avoid?: Attachment | null): DragEnd => {
    const { camera, gridVisible } = store.getState();
    const point = screenToWorld(camera, event.screen);
    const free = event.ctrlKey || event.metaKey;
    const target = anchors === undefined || free ? null : anchors(point, avoid ?? undefined);
    if (anchors !== undefined) store.setState({ anchorHint: target?.hint ?? null });
    if (target !== null && target.at !== null && target.hint.anchor !== null) {
      return {
        point: target.at,
        attachment: { shapeId: target.hint.shapeId, anchor: target.hint.anchor },
      };
    }
    return {
      point: gridSnapping(gridVisible, event) ? snapPointToGrid(point) : point,
      attachment: null,
    };
  };
  const shapeTo = (start: DragEnd, end: DragEnd, id: ShapeId): Shape => {
    const shape = build(id, start.point, end.point);
    if (shape.type !== 'arrow') return shape;
    // Too short to sit on two anchors: the head stays free (see settleArrow).
    const head = distance(start.point, end.point) < MIN_SHAPE_SIZE ? null : end.attachment;
    return withEnd(withEnd(shape, 'start', start.attachment), 'end', head);
  };

  return {
    getCursor: () => 'crosshair',

    hover() {
      // The cursor is the same everywhere for this tool.
    },

    pointerDown(event) {
      state = { kind: 'pressing', startScreen: { ...event.screen }, start: endAt(event) };
    },

    pointerMove(event) {
      if (
        state.kind === 'pressing' &&
        distance(state.startScreen, event.screen) >= DRAG_THRESHOLD_PX
      ) {
        // The old selection's handles would crowd the new shape (and any anchors);
        // the new shape is selected on release, and cancel brings the old one back.
        selectionBefore = store.getState().selectedIds;
        store.setState({ selectedIds: EMPTY_SELECTION });
        state = { kind: 'dragging', start: state.start, id: createShapeId() };
      }
      if (state.kind === 'dragging') {
        const end = endAt(event, state.start.attachment);
        store.setState({ draft: shapeTo(state.start, end, state.id) });
      }
    },

    pointerUp(event) {
      const finished = state;
      state = { kind: 'idle' };
      if (finished.kind !== 'dragging') {
        store.setState({ anchorHint: null });
        return;
      }
      const shape = shapeTo(finished.start, endAt(event, finished.start.attachment), finished.id);
      store.setState({ draft: null, anchorHint: null });
      createAndSelect(store, shape, reportError);
    },

    cancel() {
      if (state.kind === 'dragging') {
        store.setState({ draft: null, anchorHint: null, selectedIds: selectionBefore });
      } else if (state.kind === 'pressing') {
        store.setState({ anchorHint: null });
      }
      state = { kind: 'idle' };
    },
  };
}
