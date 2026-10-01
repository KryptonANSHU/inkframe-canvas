import { screenToWorld } from '../camera';
import { createShapeCommand, executeCommand } from '../commands';
import { createPoint, distance, type Point } from '../geometry/point';
import {
  createShapeId,
  DEFAULT_SHAPE_STYLE,
  MAX_PEN_POINTS,
  type PathPoint,
  type PenShape,
  type ShapeId,
} from '../shapes';
import type { EditorStore } from '../store';
import type { Tool } from './tool';

/** Screen pixels the pointer must move before another point is recorded. */
export const MIN_POINT_SPACING_PX = 1;

type Stroke = {
  readonly id: ShapeId;
  readonly origin: Readonly<Point>;
  /** Relative to `origin`; grows in place while drawing (see draftOf). */
  readonly points: PathPoint[];
  /** Screen position of the last recorded point, for the spacing filter. */
  readonly lastScreen: Point;
};

/** Freehand drawing. A press with no movement draws nothing, like the other tools. */
export function createPenTool(store: EditorStore, reportError: (error: Error) => void): Tool {
  let stroke: Stroke | null = null;
  const world = createPoint();

  return {
    getCursor: () => 'crosshair',

    hover() {
      // The cursor is the same everywhere for this tool.
    },

    pointerDown(event) {
      const origin = screenToWorld(store.getState().camera, event.screen);
      stroke = {
        id: createShapeId(),
        origin,
        points: [{ x: 0, y: 0 }],
        lastScreen: { ...event.screen },
      };
    },

    pointerMove(event) {
      if (stroke === null || stroke.points.length >= MAX_PEN_POINTS) {
        return;
      }
      if (distance(stroke.lastScreen, event.screen) < MIN_POINT_SPACING_PX) {
        return;
      }
      screenToWorld(store.getState().camera, event.screen, world);
      stroke.points.push({ x: world.x - stroke.origin.x, y: world.y - stroke.origin.y });
      stroke.lastScreen.x = event.screen.x;
      stroke.lastScreen.y = event.screen.y;
      store.setState({ draft: draftOf(stroke) });
    },

    pointerUp() {
      const finished = stroke;
      stroke = null;
      if (finished === null || finished.points.length < 2) {
        return;
      }
      store.setState({ draft: null });
      const result = executeCommand(store, createShapeCommand(committedShape(finished)));
      if (!result.ok) {
        reportError(result.error);
      }
    },

    cancel() {
      if (stroke !== null && stroke.points.length > 1) {
        store.setState({ draft: null });
      }
      stroke = null;
    },
  };
}

/**
 * The draft shares the stroke's growing points array instead of copying it on every
 * move, which would be O(n²) over a long stroke. Safe because the draft is never part
 * of the document; committedShape makes the one real copy.
 */
function draftOf(stroke: Stroke): PenShape {
  return {
    id: stroke.id,
    type: 'pen',
    x: stroke.origin.x,
    y: stroke.origin.y,
    points: stroke.points,
    rotation: 0,
    style: DEFAULT_SHAPE_STYLE,
    zIndex: 0,
  };
}

/** Copies the points, shifted so (x, y) is the top-left of their box. */
function committedShape(stroke: Stroke): PenShape {
  let minX = Infinity;
  let minY = Infinity;
  for (const point of stroke.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
  }
  return {
    ...draftOf(stroke),
    x: stroke.origin.x + minX,
    y: stroke.origin.y + minY,
    points: stroke.points.map((point) => ({ x: point.x - minX, y: point.y - minY })),
  };
}
