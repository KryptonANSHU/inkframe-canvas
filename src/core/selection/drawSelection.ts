import { worldToScreen, type Camera } from '../camera';
import type { Bounds } from '../geometry/bounds';
import type { Point } from '../geometry/point';
import { rotatedBoxCorners } from '../geometry/transform';
import type { RenderContext } from '../renderer';
import { shapeBox } from '../shapeGeometry';
import type { EditorState } from '../store';
import { canvasTheme } from '../theme';
import {
  availableHandles,
  HANDLE_SIZE_PX,
  handlePosition,
  singleSegment,
  type HandleId,
} from './handles';
import { selectedShapes } from './selectedShapes';
import { selectionFrame, type SelectionFrame } from './selectionFrame';

/** Marquee fill opacity: enough to see the area, not enough to hide shapes. */
const MARQUEE_FILL_ALPHA = 0.08;
/** Radius of round handles (rotation, line ends), in screen pixels. */
const ROUND_HANDLE_RADIUS_PX = 4.5;

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
  const theme = canvasTheme(state.theme);
  context.strokeStyle = theme.selection;

  if (shapes.length > 1) {
    for (const shape of shapes) {
      const corners = rotatedBoxCorners(shapeBox(shape), shape.rotation);
      strokePolygon(context, project(corners, isAxisAligned(shape.rotation)));
    }
  }
  const frame = selectionFrame(shapes);
  // A lone line or arrow is edited by its ends; a box around it would only add noise.
  if (frame !== null && singleSegment(shapes) === null) {
    strokePolygon(context, project(frameCorners(frame), isAxisAligned(frame.rotation)));
  }
  // Handles are hidden mid-gesture: the shapes are moving under them.
  if (frame !== null && state.preview === null && state.marquee === null) {
    drawHandles(
      context,
      shapes,
      frame,
      state.camera,
      devicePixelRatio,
      lineWidth,
      theme.handleFill,
    );
  }
  if (state.marquee !== null) {
    drawMarquee(context, project(marqueeCorners(state.marquee), true), theme.selection);
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

function drawMarquee(
  context: RenderContext,
  points: readonly Readonly<Point>[],
  color: string,
): void {
  tracePolygon(context, points);
  context.fillStyle = color;
  context.globalAlpha = MARQUEE_FILL_ALPHA;
  context.fill();
  context.globalAlpha = 1;
  context.stroke();
}

function drawHandles(
  context: RenderContext,
  shapes: Parameters<typeof availableHandles>[0],
  frame: SelectionFrame,
  camera: Camera,
  devicePixelRatio: number,
  lineWidth: number,
  fill: string,
): void {
  context.fillStyle = fill;
  for (const handle of availableHandles(shapes, frame, camera.zoom)) {
    const screen = worldToScreen(camera, handlePosition(handle, shapes, frame, camera.zoom));
    const x = screen.x * devicePixelRatio;
    const y = screen.y * devicePixelRatio;
    context.beginPath();
    if (isRound(handle)) {
      context.arc(x, y, ROUND_HANDLE_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    } else {
      traceSquare(
        context,
        x,
        y,
        (HANDLE_SIZE_PX * devicePixelRatio) / 2,
        frame.rotation,
        lineWidth,
      );
    }
    context.fill();
    context.stroke();
  }
}

function isRound(handle: HandleId): boolean {
  return handle === 'rotate' || handle === 'start' || handle === 'end';
}

/** A square handle turned with the frame; unrotated squares are snapped to the pixel grid. */
function traceSquare(
  context: RenderContext,
  x: number,
  y: number,
  half: number,
  rotation: number,
  lineWidth: number,
): void {
  const offset = lineWidth % 2 === 1 ? 0.5 : 0;
  const snap = isAxisAligned(rotation);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ].forEach(([dx = 0, dy = 0], index) => {
    const px = x + dx * cos - dy * sin;
    const py = y + dx * sin + dy * cos;
    const sx = snap ? Math.round(px - offset) + offset : px;
    const sy = snap ? Math.round(py - offset) + offset : py;
    if (index === 0) {
      context.moveTo(sx, sy);
    } else {
      context.lineTo(sx, sy);
    }
  });
  context.closePath();
}
