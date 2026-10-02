import { screenToWorld } from '../camera';
import { executeCommand, updateShapesCommand } from '../commands';
import { expandToGroups } from '../groups';
import type { Bounds } from '../geometry/bounds';
import { createPoint, distance, type Point } from '../geometry/point';
import { hitTest, hitTestAll, hitToleranceAt } from '../hitTest';
import { handleAt, handleCursor, type HandleId } from '../selection/handles';
import { shapesInMarquee } from '../selection/marquee';
import { selectedShapes } from '../selection/selectedShapes';
import { frameContains, selectionFrame, type SelectionFrame } from '../selection/selectionFrame';
import { createShapeId, type Shape, type ShapeId } from '../shapes';
import { shapeGeometryBounds } from '../shapeGeometry';
import type { SpatialIndex } from '../spatial/spatialIndex';
import { EMPTY_SELECTION, NO_GUIDES, type EditorStore } from '../store';
import type { TextMeasurer } from '../text/layout';
import { editExisting } from '../text/textShape';
import { DRAG_THRESHOLD_PX } from './dragShapeTool';
import type { Tool, ToolPointerEvent } from './tool';
import { handleGesture, moveGesture, type TransformGesture } from './transformGestures';

/** What the press landed on decides what a drag does and what a click means. */
type PressTarget =
  | { readonly kind: 'handle'; readonly handle: HandleId; readonly frame: SelectionFrame }
  | { readonly kind: 'shape'; readonly id: ShapeId; readonly wasSelected: boolean }
  /** Empty space inside the current selection's frame: drags the selection. */
  | { readonly kind: 'selection' }
  | { readonly kind: 'empty' };

type SelectToolState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'pressing';
      readonly startScreen: Readonly<Point>;
      readonly startWorld: Readonly<Point>;
      readonly target: PressTarget;
    }
  /** Moving, resizing, rotating, or dragging a line end: previewed until release. */
  | { readonly kind: 'transforming'; readonly gesture: TransformGesture }
  | {
      readonly kind: 'marquee';
      readonly startWorld: Readonly<Point>;
      /** Shift + marquee adds to what was selected before. */
      readonly base: ReadonlySet<ShapeId>;
    };

export type SelectToolOptions = {
  readonly store: EditorStore;
  readonly index: SpatialIndex;
  readonly measurer: TextMeasurer;
  readonly reportError: (error: Error) => void;
};

/**
 * Click to select, Shift + click to add or remove, Alt + click to cycle through the
 * shapes under the pointer, drag to move, drag a handle to resize or rotate, drag on
 * empty canvas for a marquee (Ctrl / ⌘ selects what it touches), double-click text to
 * edit it or empty canvas to type new text. Every drag is one command on release; cancel restores shapes and selection.
 */
export function createSelectTool({ store, index, measurer, reportError }: SelectToolOptions): Tool {
  let state: SelectToolState = { kind: 'idle' };
  let selectionBefore: ReadonlySet<ShapeId> = EMPTY_SELECTION;
  let hoverCursor = 'default';
  const world = createPoint();

  const toWorld = (event: ToolPointerEvent) =>
    screenToWorld(store.getState().camera, event.screen, world);
  const select = (ids: Iterable<ShapeId>) => {
    store.setState({ selectedIds: new Set(ids) });
  };
  // Shapes near `area`, from the spatial index, minus the ones being moved.
  const snapTargets = (area: Bounds) => {
    const { document, selectedIds } = store.getState();
    return index.query(area).flatMap((id) => {
      const shape = selectedIds.has(id) ? undefined : document.shapes.get(id);
      return shape === undefined ? [] : [shapeGeometryBounds(shape)];
    });
  };

  const startDrag = (
    pressing: Extract<SelectToolState, { kind: 'pressing' }>,
    event: ToolPointerEvent,
  ): SelectToolState => {
    const { target, startWorld } = pressing;
    if (target.kind === 'empty') {
      const base = event.shiftKey ? store.getState().selectedIds : EMPTY_SELECTION;
      select(base);
      return { kind: 'marquee', startWorld, base };
    }
    const originals = selectedShapes(store.getState());
    const gesture =
      target.kind === 'handle'
        ? handleGesture(target.handle, {
            originals,
            frame: target.frame,
            start: startWorld,
            zoom: store.getState().camera.zoom,
            measurer,
          })
        : moveGesture(originals, startWorld, {
            targets: snapTargets,
            zoom: store.getState().camera.zoom,
          });
    return { kind: 'transforming', gesture };
  };

  return {
    getCursor: () => {
      if (state.kind === 'transforming') return state.gesture.cursor;
      return state.kind === 'marquee' ? 'default' : hoverCursor;
    },

    hover(event) {
      hoverCursor = cursorFor(pressTarget(store, index, event.screen, toWorld(event)));
    },

    pointerDown(event) {
      selectionBefore = store.getState().selectedIds;
      const startWorld = { ...toWorld(event) };
      const target = pressTarget(store, index, event.screen, startWorld);
      // Select on press (not release) so a drag that starts here moves this shape.
      if (target.kind === 'shape' && !target.wasSelected && !event.altKey) {
        const pressed = withGroup(store, target.id, event);
        select(event.shiftKey ? [...selectionBefore, ...pressed] : pressed);
      }
      state = { kind: 'pressing', startScreen: { ...event.screen }, startWorld, target };
    },

    pointerMove(event) {
      if (
        state.kind === 'pressing' &&
        distance(state.startScreen, event.screen) >= DRAG_THRESHOLD_PX
      ) {
        state = startDrag(state, event);
      }
      if (state.kind === 'transforming') {
        const { shapes, guides } = state.gesture.apply(toWorld(event), event);
        store.setState({ preview: byId(shapes), guides });
      } else if (state.kind === 'marquee') {
        updateMarquee(store, index, state, toWorld(event), event);
      }
    },

    pointerUp(event) {
      const finished = state;
      state = { kind: 'idle' };
      if (finished.kind === 'pressing') {
        clickSelect(store, index, finished.target, finished.startWorld, event, select);
      } else if (finished.kind === 'transforming') {
        const { gesture } = finished;
        commitTransform(store, gesture, gesture.apply(toWorld(event), event).shapes, reportError);
      } else if (finished.kind === 'marquee') {
        updateMarquee(store, index, finished, toWorld(event), event);
        store.setState({ marquee: null });
      }
    },

    // Runs for every tool (see the input controller): text is a double-click away.
    doubleClick(event) {
      const { document, camera, textEdit } = store.getState();
      if (textEdit !== null) {
        return;
      }
      const point = toWorld(event);
      const hit = hitTest(document, index, point, camera.zoom);
      const shape = hit === null ? undefined : document.shapes.get(hit);
      if (shape?.type === 'text') {
        // Deselected while editing so handles don't sit on the textarea; the commit reselects.
        store.setState({ textEdit: editExisting(shape), selectedIds: EMPTY_SELECTION });
      } else if (shape === undefined) {
        // Empty canvas: a new text box here, as if the text tool had been used.
        store.setState({
          activeTool: 'text',
          selectedIds: EMPTY_SELECTION,
          textEdit: { id: createShapeId(), x: point.x, y: point.y, original: null },
        });
      }
    },

    cancel() {
      if (state.kind !== 'idle') {
        store.setState({
          preview: null,
          guides: NO_GUIDES,
          marquee: null,
          selectedIds: selectionBefore,
        });
      }
      state = { kind: 'idle' };
    },
  };
}

function pressTarget(
  store: EditorStore,
  index: SpatialIndex,
  screen: Readonly<Point>,
  point: Readonly<Point>,
): PressTarget {
  const state = store.getState();
  const { document, camera, selectedIds } = state;
  const selected = selectedShapes(state);
  const frame = selectionFrame(selected);
  // Handles first: they sit on the frame's edge, often on top of the shape itself.
  const handle = frame === null ? null : handleAt(selected, frame, camera, screen);
  if (handle !== null && frame !== null) {
    return { kind: 'handle', handle, frame };
  }
  const hit = hitTest(document, index, point, camera.zoom);
  if (hit !== null) {
    return { kind: 'shape', id: hit, wasSelected: selectedIds.has(hit) };
  }
  if (frame !== null && frameContains(frame, point, hitToleranceAt(camera.zoom))) {
    return { kind: 'selection' };
  }
  return { kind: 'empty' };
}

function cursorFor(target: PressTarget): string {
  switch (target.kind) {
    case 'handle':
      return handleCursor(target.handle, target.frame);
    case 'shape':
    case 'selection':
      return 'move';
    case 'empty':
      return 'default';
  }
}

/** A press and release without a drag. */
function clickSelect(
  store: EditorStore,
  index: SpatialIndex,
  target: PressTarget,
  point: Readonly<Point>,
  event: ToolPointerEvent,
  select: (ids: Iterable<ShapeId>) => void,
): void {
  const { selectedIds, document, camera } = store.getState();
  if (target.kind === 'empty') {
    if (!event.shiftKey) {
      select([]);
    }
    return;
  }
  if (event.altKey) {
    // Alt + click: the next shape below the current one at this point, wrapping around.
    // Also on a handle: Alt + drag resizes from the center, but a plain Alt + click cycles.
    const stack = hitTestAll(document, index, point, camera.zoom);
    if (stack.length === 0) {
      return;
    }
    const [current] = selectedIds.size === 1 ? selectedIds : [];
    const position = current === undefined ? -1 : stack.indexOf(current);
    const next = stack[(position + 1) % stack.length];
    select(next === undefined ? [] : [next]);
  } else if (target.kind !== 'shape') {
    return;
  } else if (event.shiftKey) {
    if (target.wasSelected) {
      const removed = withGroup(store, target.id, event);
      select([...selectedIds].filter((id) => !removed.has(id)));
    }
  } else if (target.wasSelected) {
    // Clicking one shape of a multi-selection (without dragging) narrows to that shape
    // (its group, or just the shape with Ctrl / ⌘).
    select(withGroup(store, target.id, event));
  }
}

/**
 * The shape a click lands on plus the rest of its group, since a group selects as a
 * whole. Ctrl / ⌘ + click reaches inside: just that one shape.
 */
function withGroup(store: EditorStore, id: ShapeId, event: ToolPointerEvent): Set<ShapeId> {
  return event.ctrlKey || event.metaKey
    ? new Set([id])
    : expandToGroups(store.getState().document, [id]);
}

function updateMarquee(
  store: EditorStore,
  index: SpatialIndex,
  marquee: Extract<SelectToolState, { kind: 'marquee' }>,
  current: Readonly<Point>,
  event: ToolPointerEvent,
): void {
  const area: Bounds = {
    minX: Math.min(marquee.startWorld.x, current.x),
    minY: Math.min(marquee.startWorld.y, current.y),
    maxX: Math.max(marquee.startWorld.x, current.x),
    maxY: Math.max(marquee.startWorld.y, current.y),
  };
  const mode = event.ctrlKey || event.metaKey ? 'touching' : 'inside';
  const { document } = store.getState();
  // A marquee that catches part of a group selects the whole group.
  const inside = expandToGroups(document, shapesInMarquee(document, index, area, mode));
  store.setState({ marquee: area, selectedIds: new Set([...marquee.base, ...inside]) });
}

function byId(shapes: readonly Shape[]): Map<ShapeId, Shape> {
  return new Map(shapes.map((shape) => [shape.id, shape]));
}

/**
 * One drag = one command, from the shapes as they were when it began. A drag that
 * ends exactly where it started changes nothing, so it adds no command.
 */
function commitTransform(
  store: EditorStore,
  gesture: TransformGesture,
  after: readonly Shape[],
  reportError: (error: Error) => void,
): void {
  store.setState({ preview: null, guides: NO_GUIDES });
  const unchanged = after.every(
    (shape, i) => JSON.stringify(shape) === JSON.stringify(gesture.originals[i]),
  );
  if (after.length === 0 || unchanged) {
    return;
  }
  const result = executeCommand(
    store,
    updateShapesCommand(gesture.label, gesture.originals, after),
  );
  if (!result.ok) {
    reportError(result.error);
  }
}
