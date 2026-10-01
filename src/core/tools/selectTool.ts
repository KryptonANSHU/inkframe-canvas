import { screenToWorld } from '../camera';
import { executeCommand, updateShapesCommand } from '../commands';
import type { Bounds } from '../geometry/bounds';
import { createPoint, distance, type Point } from '../geometry/point';
import { hitTest, hitTestAll, hitToleranceAt } from '../hitTest';
import { shapesInMarquee } from '../selection/marquee';
import { frameContains, selectionFrame } from '../selection/selectionFrame';
import { selectedShapes } from '../selection/selectedShapes';
import type { Shape, ShapeId } from '../shapes';
import type { SpatialIndex } from '../spatial/spatialIndex';
import { EMPTY_SELECTION, type EditorStore } from '../store';
import { DRAG_THRESHOLD_PX } from './dragShapeTool';
import type { Tool, ToolPointerEvent } from './tool';

/** What the press landed on decides what a drag does and what a click means. */
type PressTarget =
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
  | {
      readonly kind: 'moving';
      readonly startWorld: Readonly<Point>;
      readonly originals: readonly Shape[];
    }
  | {
      readonly kind: 'marquee';
      readonly startWorld: Readonly<Point>;
      /** Shift + marquee adds to what was selected before. */
      readonly base: ReadonlySet<ShapeId>;
    };

/**
 * Click to select, Shift + click to add or remove, Alt + click to cycle through the
 * shapes under the pointer, drag to move, drag on empty canvas for a marquee
 * (Ctrl / ⌘ selects what it touches). Cancel restores shapes and selection.
 */
export function createSelectTool(
  store: EditorStore,
  index: SpatialIndex,
  reportError: (error: Error) => void,
): Tool {
  let state: SelectToolState = { kind: 'idle' };
  let selectionBefore: ReadonlySet<ShapeId> = EMPTY_SELECTION;
  let hoverCursor = 'default';
  const world = createPoint();

  const toWorld = (event: ToolPointerEvent) =>
    screenToWorld(store.getState().camera, event.screen, world);
  const select = (ids: Iterable<ShapeId>) => {
    store.setState({ selectedIds: new Set(ids) });
  };

  const startDrag = (
    pressing: Extract<SelectToolState, { kind: 'pressing' }>,
    event: ToolPointerEvent,
  ) => {
    if (pressing.target.kind === 'empty') {
      const base = event.shiftKey ? store.getState().selectedIds : EMPTY_SELECTION;
      select(base);
      return { kind: 'marquee', startWorld: pressing.startWorld, base } as const;
    }
    const originals = selectedShapes(store.getState());
    return { kind: 'moving', startWorld: pressing.startWorld, originals } as const;
  };

  return {
    getCursor: () =>
      state.kind === 'moving' ? 'move' : state.kind === 'marquee' ? 'default' : hoverCursor,

    hover(event) {
      hoverCursor = pressTarget(store, index, toWorld(event)).kind === 'empty' ? 'default' : 'move';
    },

    pointerDown(event) {
      selectionBefore = store.getState().selectedIds;
      const startWorld = { ...toWorld(event) };
      const target = pressTarget(store, index, startWorld);
      // Select on press (not release) so a drag that starts here moves this shape.
      if (target.kind === 'shape' && !target.wasSelected && !event.altKey) {
        select(event.shiftKey ? [...selectionBefore, target.id] : [target.id]);
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
      if (state.kind === 'moving') {
        store.setState({
          preview: movedPreview(state.originals, delta(state.startWorld, toWorld(event))),
        });
      } else if (state.kind === 'marquee') {
        updateMarquee(store, index, state, toWorld(event), event);
      }
    },

    pointerUp(event) {
      const finished = state;
      state = { kind: 'idle' };
      if (finished.kind === 'pressing') {
        clickSelect(store, index, finished.target, finished.startWorld, event, select);
      } else if (finished.kind === 'moving') {
        commitMove(store, finished, delta(finished.startWorld, toWorld(event)), reportError);
      } else if (finished.kind === 'marquee') {
        updateMarquee(store, index, finished, toWorld(event), event);
        store.setState({ marquee: null });
      }
    },

    cancel() {
      if (state.kind !== 'idle') {
        store.setState({ preview: null, marquee: null, selectedIds: selectionBefore });
      }
      state = { kind: 'idle' };
    },
  };
}

function pressTarget(store: EditorStore, index: SpatialIndex, point: Readonly<Point>): PressTarget {
  const { document, camera, selectedIds } = store.getState();
  const hit = hitTest(document, index, point, camera.zoom);
  if (hit !== null) {
    return { kind: 'shape', id: hit, wasSelected: selectedIds.has(hit) };
  }
  const frame = selectionFrame(selectedShapes(store.getState()));
  if (frame !== null && frameContains(frame, point, hitToleranceAt(camera.zoom))) {
    return { kind: 'selection' };
  }
  return { kind: 'empty' };
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
  if (target.kind !== 'shape') {
    return;
  }
  if (event.altKey) {
    // Alt + click: the next shape below the current one at this point, wrapping around.
    const stack = hitTestAll(document, index, point, camera.zoom);
    const [current] = selectedIds.size === 1 ? selectedIds : [];
    const position = current === undefined ? -1 : stack.indexOf(current);
    const next = stack[(position + 1) % stack.length];
    select(next === undefined ? [] : [next]);
  } else if (event.shiftKey) {
    if (target.wasSelected) {
      select([...selectedIds].filter((id) => id !== target.id));
    }
  } else if (target.wasSelected) {
    // Clicking one shape of a multi-selection (without dragging) narrows to that shape.
    select([target.id]);
  }
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
  const inside = shapesInMarquee(store.getState().document, index, area, mode);
  store.setState({ marquee: area, selectedIds: new Set([...marquee.base, ...inside]) });
}

function delta(start: Readonly<Point>, end: Readonly<Point>): Point {
  return { x: end.x - start.x, y: end.y - start.y };
}

function movedPreview(originals: readonly Shape[], offset: Readonly<Point>): Map<ShapeId, Shape> {
  return new Map(
    originals.map((shape) => [
      shape.id,
      { ...shape, x: shape.x + offset.x, y: shape.y + offset.y },
    ]),
  );
}

/** One drag = one command, built from the shapes as they were when the drag began. */
function commitMove(
  store: EditorStore,
  moving: Extract<SelectToolState, { kind: 'moving' }>,
  offset: Readonly<Point>,
  reportError: (error: Error) => void,
): void {
  store.setState({ preview: null });
  if ((offset.x === 0 && offset.y === 0) || moving.originals.length === 0) {
    return;
  }
  const moved = [...movedPreview(moving.originals, offset).values()];
  const result = executeCommand(store, updateShapesCommand('Move', moving.originals, moved));
  if (!result.ok) {
    reportError(result.error);
  }
}
