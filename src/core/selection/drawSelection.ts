import { anchorPoint, canAttachTo, type AnchorHint } from '../attachments';
import { worldToScreen, type Camera } from '../camera';
import type { Bounds } from '../geometry/bounds';
import type { Point } from '../geometry/point';
import { rotatedBoxCorners } from '../geometry/transform';
import type { RenderContext } from '../renderer';
import { shapeBox, shapeGeometryBounds } from '../shapeGeometry';
import { ANCHORS, type GroupId, type Shape } from '../shapes';
import type { Guide } from '../snapping';
import type { EditorState } from '../store';
import { canvasTheme } from '../theme';
import {
  availableHandles,
  HANDLE_SIZE_PX,
  TOUCH_HANDLE_SIZE_PX,
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
  if (
    shapes.length === 0 &&
    state.marquee === null &&
    state.guides.length === 0 &&
    state.anchorHint === null
  ) {
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

  // One outline per thing the user picked: a shape, or a whole group as one box. A lone
  // shape or group needs none; the frame already traces it.
  const units = selectionUnits(shapes);
  if (units.length > 1) {
    for (const unit of units) {
      if (unit.kind === 'group') {
        strokePolygon(context, project(marqueeCorners(unionBounds(unit.members)), true));
      } else {
        const corners = rotatedBoxCorners(shapeBox(unit.shape), unit.shape.rotation);
        strokePolygon(context, project(corners, isAxisAligned(unit.shape.rotation)));
      }
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
      state.touchMode ? TOUCH_HANDLE_SIZE_PX : HANDLE_SIZE_PX,
    );
  }
  if (state.marquee !== null) {
    drawMarquee(context, project(marqueeCorners(state.marquee), true), theme.selection);
  }
  for (const guide of state.guides) {
    const ends = guideEnds(guide);
    strokeLine(context, project(ends, true));
  }
  if (state.anchorHint !== null) {
    drawAnchors(context, state, state.anchorHint, devicePixelRatio, theme);
  }
}

/** Radius of an anchor dot, and of the one an arrow end is snapped to, in screen pixels. */
const ANCHOR_RADIUS_PX = 3.5;
const ACTIVE_ANCHOR_RADIUS_PX = 5;

/** A shape's anchors while an arrow end moves near it; the snapped one filled in. */
function drawAnchors(
  context: RenderContext,
  state: EditorState,
  hint: AnchorHint,
  devicePixelRatio: number,
  theme: ReturnType<typeof canvasTheme>,
): void {
  const shape = state.preview?.get(hint.shapeId) ?? state.document.shapes.get(hint.shapeId);
  if (shape === undefined || !canAttachTo(shape)) return;
  for (const anchor of ANCHORS) {
    const active = anchor === hint.anchor;
    const screen = worldToScreen(state.camera, anchorPoint(shape, anchor));
    const radius = (active ? ACTIVE_ANCHOR_RADIUS_PX : ANCHOR_RADIUS_PX) * devicePixelRatio;
    context.beginPath();
    context.arc(screen.x * devicePixelRatio, screen.y * devicePixelRatio, radius, 0, Math.PI * 2);
    context.fillStyle = active ? theme.selection : theme.handleFill;
    context.fill();
    context.stroke();
  }
}

type SelectionUnit =
  | { readonly kind: 'shape'; readonly shape: Shape }
  | { readonly kind: 'group'; readonly members: Shape[] };

/** Ungrouped shapes on their own, and each group's selected members together. */
function selectionUnits(shapes: readonly Shape[]): SelectionUnit[] {
  const groups = new Map<GroupId, Shape[]>();
  const units: SelectionUnit[] = [];
  for (const shape of shapes) {
    const members = shape.groupId === undefined ? undefined : groups.get(shape.groupId);
    if (shape.groupId === undefined) {
      units.push({ kind: 'shape', shape });
    } else if (members === undefined) {
      const created = [shape];
      groups.set(shape.groupId, created);
      units.push({ kind: 'group', members: created });
    } else {
      members.push(shape);
    }
  }
  return units;
}

function unionBounds(shapes: readonly Shape[]): Bounds {
  const bounds = shapes.map(shapeGeometryBounds);
  return {
    minX: Math.min(...bounds.map((b) => b.minX)),
    minY: Math.min(...bounds.map((b) => b.minY)),
    maxX: Math.max(...bounds.map((b) => b.maxX)),
    maxY: Math.max(...bounds.map((b) => b.maxY)),
  };
}

/** A guide's two ends in world space: vertical guides run along y, horizontal along x. */
function guideEnds(guide: Guide): Point[] {
  return guide.axis === 'x'
    ? [
        { x: guide.at, y: guide.from },
        { x: guide.at, y: guide.to },
      ]
    : [
        { x: guide.from, y: guide.at },
        { x: guide.to, y: guide.at },
      ];
}

function strokeLine(context: RenderContext, [from, to]: readonly Readonly<Point>[]): void {
  if (from === undefined || to === undefined) {
    return;
  }
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
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
  handleSize: number,
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
      traceSquare(context, x, y, (handleSize * devicePixelRatio) / 2, frame.rotation, lineWidth);
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
