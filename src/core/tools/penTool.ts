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
/** Stroke width range, as a multiple of the default width, that pressure can reach. */
const MIN_PRESSURE_SCALE = 0.25;
const MAX_PRESSURE_SCALE = 2;

type Stroke = {
  readonly id: ShapeId;
  readonly origin: Readonly<Point>;
  /** Relative to `origin`; grows in place while drawing (see draftOf). */
  readonly points: PathPoint[];
  /** Screen position of the last recorded point, for the spacing filter. */
  readonly lastScreen: Point;
  /** Sum of the pressures of the recorded points; their average sets the width. */
  pressureSum: number;
};

/**
 * Freehand drawing. A press with no movement draws nothing, like the other tools.
 * Pen pressure sets the stroke's width: one width per stroke, from its average.
 */
export function createPenTool(store: EditorStore, reportError: (error: Error) => void): Tool {
  let stroke: Stroke | null = null;
  const world = createPoint();

  return {
    // Fast strokes would otherwise lose the points between frames and turn angular.
    wantsEveryMove: true,

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
        pressureSum: event.pressure,
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
      stroke.pressureSum += event.pressure;
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
    style: {
      ...DEFAULT_SHAPE_STYLE,
      strokeWidth: pressureWidth(stroke.pressureSum / stroke.points.length),
    },
    zIndex: 0,
  };
}

/** The default width at 0.5 pressure, which is what a mouse reports. */
export function pressureWidth(averagePressure: number): number {
  const scale = Math.min(MAX_PRESSURE_SCALE, Math.max(MIN_PRESSURE_SCALE, averagePressure * 2));
  return DEFAULT_SHAPE_STYLE.strokeWidth * scale;
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
