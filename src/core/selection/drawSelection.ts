import { worldToScreen, type Camera } from '../camera';
import type { Bounds } from '../geometry/bounds';
import type { Point } from '../geometry/point';
import { rotatedBoxCorners } from '../geometry/transform';
import type { RenderContext } from '../renderer';
import { shapeBox } from '../shapeGeometry';
import type { EditorState } from '../store';
import { selectedShapes } from './selectedShapes';
import { selectionFrame, type SelectionFrame } from './selectionFrame';

/** Selection blue, the UI's only accent. Moves to theme tokens in M7. */
export const SELECTION_COLOR = '#3d5afe';
/** Marquee fill opacity: enough to see the area, not enough to hide shapes. */
const MARQUEE_FILL_ALPHA = 0.08;

/**
 * Draws selection outlines, the selection frame, and the marquee in device pixels,
 * after the shapes. Outlines are whole device pixels wide and axis-aligned edges sit
 * on pixel centers, so they stay crisp at every zoom and DPR.
 */
export function drawSelectionOverlay(
  context: RenderContext,
  state: EditorState,
  devicePixelRatio: number,
): void {
  const shapes = selectedShapes(state);
  if (shapes.length === 0 && state.marquee === null) {
    return;
  }
  const lineWidth = Math.max(1, Math.round(devicePixelRatio));
  const project = (corners: readonly Readonly<Point>[], axisAligned: boolean) =>
    toDevice(corners, state.camera, devicePixelRatio, axisAligned ? lineWidth : null);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.lineWidth = lineWidth;
  context.lineJoin = 'miter';
  context.strokeStyle = SELECTION_COLOR;

  if (shapes.length > 1) {
    for (const shape of shapes) {
      const corners = rotatedBoxCorners(shapeBox(shape), shape.rotation);
      strokePolygon(context, project(corners, isAxisAligned(shape.rotation)));
    }
  }
  const frame = selectionFrame(shapes);
  if (frame !== null) {
    strokePolygon(context, project(frameCorners(frame), isAxisAligned(frame.rotation)));
  }
  if (state.marquee !== null) {
    drawMarquee(context, project(marqueeCorners(state.marquee), true));
  }
}

function frameCorners(frame: SelectionFrame): Point[] {
  const box = {
    x: frame.centerX - frame.width / 2,
    y: frame.centerY - frame.height / 2,
    width: frame.width,
    height: frame.height,
  };
  return rotatedBoxCorners(box, frame.rotation);
}

function marqueeCorners(area: Bounds): Point[] {
  return [
    { x: area.minX, y: area.minY },
    { x: area.maxX, y: area.minY },
    { x: area.maxX, y: area.maxY },
    { x: area.minX, y: area.maxY },
  ];
}

function isAxisAligned(rotation: number): boolean {
  const quarterTurns = rotation / (Math.PI / 2);
  return Math.abs(quarterTurns - Math.round(quarterTurns)) < 1e-9;
}

/**
 * World corners → device pixels. With `snapWidth`, coordinates are snapped so a line
 * of that width covers whole pixels: odd widths centered on pixel centers (n + 0.5).
 */
function toDevice(
  corners: readonly Readonly<Point>[],
  camera: Camera,
  devicePixelRatio: number,
  snapWidth: number | null,
): Point[] {
  const offset = snapWidth !== null && snapWidth % 2 === 1 ? 0.5 : 0;
  return corners.map((corner) => {
    const screen = worldToScreen(camera, corner);
    const x = screen.x * devicePixelRatio;
    const y = screen.y * devicePixelRatio;
    return snapWidth === null
      ? { x, y }
      : { x: Math.round(x - offset) + offset, y: Math.round(y - offset) + offset };
  });
}

function tracePolygon(context: RenderContext, points: readonly Readonly<Point>[]): void {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
}

function strokePolygon(context: RenderContext, points: readonly Readonly<Point>[]): void {
  tracePolygon(context, points);
  context.stroke();
}

function drawMarquee(context: RenderContext, points: readonly Readonly<Point>[]): void {
  tracePolygon(context, points);
  context.fillStyle = SELECTION_COLOR;
  context.globalAlpha = MARQUEE_FILL_ALPHA;
  context.fill();
  context.globalAlpha = 1;
  context.stroke();
}
