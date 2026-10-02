import { assertNever } from './assertNever';
import { DEFAULT_CAMERA, worldToDeviceTransform, type Transform } from './camera';
import { createPoint } from './geometry/point';
import { drawGrid } from './grid';
import { drawPresence } from './presence';
import { drawSelectionOverlay } from './selection/drawSelection';
import { ARROW_HEAD_SIDES, arrowHeadWing, isFilled, shapeBox } from './shapeGeometry';
import type { Bounds, Box } from './geometry/bounds';
import type { ArrowShape, PathPoint, Shape, ShapeId, TextShape } from './shapes';
import type { EditorState } from './store';
import { canvasTheme, type CanvasTheme } from './theme';
import { fontString } from './text/font';
import type { TextLayout } from './text/layout';

// Scratch point for arrowhead wings, so drawing allocates nothing per shape.
const wing = createPoint();

/** The part of CanvasRenderingContext2D the renderer uses, so tests can pass a fake. */
export type RenderContext = Pick<
  CanvasRenderingContext2D,
  | 'setTransform'
  | 'clearRect'
  | 'save'
  | 'restore'
  | 'translate'
  | 'rotate'
  | 'beginPath'
  | 'closePath'
  | 'rect'
  | 'ellipse'
  | 'arc'
  | 'moveTo'
  | 'lineTo'
  | 'quadraticCurveTo'
  | 'fill'
  | 'stroke'
  | 'globalAlpha'
  | 'lineWidth'
  | 'lineCap'
  | 'lineJoin'
  | 'strokeStyle'
  | 'fillStyle'
  | 'fillText'
  | 'font'
  | 'textBaseline'
  | 'measureText'
  | 'roundRect'
>;

/** Shapes drawn as a stroked (and maybe filled) path: everything except text. */
type OutlinedShape = Exclude<Shape, TextShape>;

type LayoutText = (shape: TextShape) => TextLayout;

export type Viewport = {
  /** Backing-store size in device pixels. */
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly devicePixelRatio: number;
};

export type Renderer = {
  draw(state: EditorState, viewport: Viewport): void;
};

/** Shapes whose bounds meet `area` (world units): the spatial index's query. */
export type VisibleShapes = (area: Bounds) => readonly ShapeId[];

/**
 * Full redraw every frame (dirty rectangles measured as unnecessary in M8). With
 * `visibleShapes`, only shapes in view are drawn. `layoutText` wraps text with the real
 * font; it is only called once fonts are ready.
 */
export function createRenderer(
  context: RenderContext,
  layoutText: LayoutText,
  visibleShapes?: VisibleShapes,
): Renderer {
  // Reused every frame so drawing allocates nothing for the camera transform.
  const transform = worldToDeviceTransform(DEFAULT_CAMERA, 1);

  return {
    draw(state, viewport) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, viewport.pixelWidth, viewport.pixelHeight);
      if (state.gridVisible) {
        drawGrid(context, state.camera, viewport, canvasTheme(state.theme));
      }

      const t = worldToDeviceTransform(state.camera, viewport.devicePixelRatio, transform);
      context.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

      // Text is never drawn with a fallback font: it waits for the real one.
      const layout = state.fontsReady ? layoutText : null;
      const theme = canvasTheme(state.theme);
      const { shapes } = state.document;
      // Text being edited is shown by the textarea instead, so it isn't drawn twice.
      const editing = state.textEdit?.id;
      for (const id of shapesToDraw(state, viewport, visibleShapes)) {
        // Shapes being moved, resized, or rotated are drawn as their preview versions.
        // Always present while document invariants hold (checked from M5).
        const shape = state.preview?.get(id) ?? shapes.get(id);
        if (shape !== undefined && id !== editing) {
          drawShape(context, shape, layout, theme, t);
        }
      }
      if (state.draft !== null) {
        drawShape(context, state.draft, layout, theme, t);
      }
      context.globalAlpha = 1;
      drawSelectionOverlay(context, state, viewport.devicePixelRatio);
      drawPresence(context, state, viewport.devicePixelRatio);
    },
  };
}

/**
 * Below this share of the drawing in view, drawing only the visible shapes (sorted
 * back into draw order) beats walking the whole order.
 */
const CULL_BELOW = 0.5;

/**
 * Draw order for this frame: every shape, or with `visibleShapes`, just those in view
 * plus any being dragged (they may have come from off-screen).
 */
function shapesToDraw(
  state: EditorState,
  viewport: Viewport,
  visibleShapes: VisibleShapes | undefined,
): readonly ShapeId[] {
  const { order, shapes } = state.document;
  if (visibleShapes === undefined) {
    return order;
  }
  const { camera } = state;
  const scale = camera.zoom * viewport.devicePixelRatio;
  const visible = visibleShapes({
    minX: camera.x,
    minY: camera.y,
    maxX: camera.x + viewport.pixelWidth / scale,
    maxY: camera.y + viewport.pixelHeight / scale,
  });
  if (visible.length >= order.length * CULL_BELOW) {
    return order;
  }
  const ids = new Set(visible);
  for (const id of state.preview?.keys() ?? []) ids.add(id);
  const zIndex = (id: ShapeId) => shapes.get(id)?.zIndex ?? 0;
  return [...ids].sort((a, b) => zIndex(a) - zIndex(b));
}

/**
 * Draws a shape centered on the origin, so rotation is always around its center. One
 * setTransform per shape (camera × translate × rotate), instead of save / translate /
 * rotate / restore: copying the whole context state per shape was measurable at 10k.
 */
function drawShape(
  context: RenderContext,
  shape: Shape,
  layoutText: LayoutText | null,
  theme: CanvasTheme,
  t: Readonly<Transform>,
): void {
  const box = shapeBox(shape);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const cos = Math.cos(shape.rotation);
  const sin = Math.sin(shape.rotation);
  context.setTransform(
    t.a * cos + t.c * sin,
    t.b * cos + t.d * sin,
    t.c * cos - t.a * sin,
    t.d * cos - t.b * sin,
    t.a * centerX + t.c * centerY + t.e,
    t.b * centerX + t.d * centerY + t.f,
  );
  context.globalAlpha = shape.style.opacity;
  if (shape.type !== 'text') {
    drawOutlined(context, shape, box, theme);
  } else if (layoutText !== null) {
    drawText(context, shape, layoutText(shape), theme);
  }
}

function drawOutlined(
  context: RenderContext,
  shape: OutlinedShape,
  box: Box,
  theme: CanvasTheme,
): void {
  const { style } = shape;
  context.lineWidth = style.strokeWidth;
  context.strokeStyle = theme.shapeColor(style.strokeColor);
  context.lineJoin = shape.type === 'rectangle' ? 'miter' : 'round';
  context.lineCap = 'round';
  context.beginPath();
  // Path points are relative to (x, y); this offset makes them relative to the center.
  const offsetX = shape.x - (box.x + box.width / 2);
  const offsetY = shape.y - (box.y + box.height / 2);
  traceShape(context, shape, box.width, box.height, offsetX, offsetY);
  if (isFilled(shape) && style.fillColor !== null) {
    context.fillStyle = theme.shapeColor(style.fillColor);
    context.fill();
  }
  context.stroke();
}

/** Lines from the top-left of the box, each on its baseline (top + ascent + n × lineHeight). */
function drawText(
  context: RenderContext,
  shape: TextShape,
  layout: TextLayout,
  theme: CanvasTheme,
): void {
  context.fillStyle = theme.shapeColor(shape.style.strokeColor);
  context.font = fontString(shape.fontSize);
  context.textBaseline = 'alphabetic';
  const left = -shape.width / 2;
  const top = -shape.height / 2 + layout.ascent;
  layout.lines.forEach((line, index) => {
    context.fillText(line.text, left, top + index * layout.lineHeight);
  });
}

function traceShape(
  context: RenderContext,
  shape: OutlinedShape,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): void {
  switch (shape.type) {
    case 'rectangle':
      context.rect(-width / 2, -height / 2, width, height);
      return;
    case 'ellipse':
      context.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      return;
    case 'line':
      tracePolyline(context, shape.points, offsetX, offsetY);
      return;
    case 'arrow':
      tracePolyline(context, shape.points, offsetX, offsetY);
      traceArrowHead(context, shape, offsetX, offsetY);
      return;
    case 'pen':
      traceSmoothPath(context, shape.points, offsetX, offsetY);
      return;
    default:
      assertNever(shape);
  }
}

function tracePolyline(
  context: RenderContext,
  points: readonly PathPoint[],
  offsetX: number,
  offsetY: number,
): void {
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x + offsetX, point.y + offsetY);
    } else {
      context.lineTo(point.x + offsetX, point.y + offsetY);
    }
  });
}

function traceArrowHead(
  context: RenderContext,
  shape: ArrowShape,
  offsetX: number,
  offsetY: number,
): void {
  const tip = shape.points[1];
  for (const side of ARROW_HEAD_SIDES) {
    arrowHeadWing(shape, side, wing);
    context.moveTo(tip.x + offsetX, tip.y + offsetY);
    context.lineTo(wing.x + offsetX, wing.y + offsetY);
  }
}

/** Smooths freehand input by curving through the midpoints between captured points. */
function traceSmoothPath(
  context: RenderContext,
  points: readonly PathPoint[],
  offsetX: number,
  offsetY: number,
): void {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) {
    return;
  }
  context.moveTo(first.x + offsetX, first.y + offsetY);
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const next = points[i + 1];
    if (point !== undefined && next !== undefined) {
      const midX = (point.x + next.x) / 2 + offsetX;
      const midY = (point.y + next.y) / 2 + offsetY;
      context.quadraticCurveTo(point.x + offsetX, point.y + offsetY, midX, midY);
    }
  }
  // Also draws a single-point path as a dot, thanks to the round line cap.
  context.lineTo(last.x + offsetX, last.y + offsetY);
}
