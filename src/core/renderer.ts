import { assertNever } from './assertNever';
import { DEFAULT_CAMERA, worldToDeviceTransform } from './camera';
import { createPoint } from './geometry/point';
import { drawSelectionOverlay } from './selection/drawSelection';
import { ARROW_HEAD_SIDES, arrowHeadWing, isFilled, shapeBox } from './shapeGeometry';
import type { Box } from './geometry/bounds';
import type { ArrowShape, PathPoint, Shape, TextShape } from './shapes';
import type { EditorState } from './store';
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

/**
 * Full redraw every frame. Dirty rectangles only if profiling proves they help (M8).
 * `layoutText` wraps text with the real font; it is only called once fonts are ready.
 */
export function createRenderer(context: RenderContext, layoutText: LayoutText): Renderer {
  // Reused every frame so drawing allocates nothing for the camera transform.
  const transform = worldToDeviceTransform(DEFAULT_CAMERA, 1);

  return {
    draw(state, viewport) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, viewport.pixelWidth, viewport.pixelHeight);

      const t = worldToDeviceTransform(state.camera, viewport.devicePixelRatio, transform);
      context.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

      // Text is never drawn with a fallback font: it waits for the real one (PRD 1B).
      const layout = state.fontsReady ? layoutText : null;
      const { shapes, order } = state.document;
      for (const id of order) {
        // Shapes being moved, resized, or rotated are drawn as their preview versions.
        // Always present while document invariants hold (checked from M5).
        const shape = state.preview?.get(id) ?? shapes.get(id);
        if (shape !== undefined) {
          drawShape(context, shape, layout);
        }
      }
      if (state.draft !== null) {
        drawShape(context, state.draft, layout);
      }
      drawSelectionOverlay(context, state, viewport.devicePixelRatio);
    },
  };
}

function drawShape(context: RenderContext, shape: Shape, layoutText: LayoutText | null): void {
  const box = shapeBox(shape);
  context.save();
  // Every shape is drawn centered on the origin, so rotation is always around its center.
  context.translate(box.x + box.width / 2, box.y + box.height / 2);
  context.rotate(shape.rotation);
  context.globalAlpha = shape.style.opacity;
  if (shape.type !== 'text') {
    drawOutlined(context, shape, box);
  } else if (layoutText !== null) {
    drawText(context, shape, layoutText(shape));
  }
  context.restore();
}

function drawOutlined(context: RenderContext, shape: OutlinedShape, box: Box): void {
  const { style } = shape;
  context.lineWidth = style.strokeWidth;
  context.strokeStyle = style.strokeColor;
  context.lineJoin = shape.type === 'rectangle' ? 'miter' : 'round';
  context.lineCap = 'round';
  context.beginPath();
  // Path points are relative to (x, y); this offset makes them relative to the center.
  const offsetX = shape.x - (box.x + box.width / 2);
  const offsetY = shape.y - (box.y + box.height / 2);
  traceShape(context, shape, box.width, box.height, offsetX, offsetY);
  if (isFilled(shape) && style.fillColor !== null) {
    context.fillStyle = style.fillColor;
    context.fill();
  }
  context.stroke();
}

/** Lines from the top-left of the box, each on its baseline (top + ascent + n × lineHeight). */
function drawText(context: RenderContext, shape: TextShape, layout: TextLayout): void {
  context.fillStyle = shape.style.strokeColor;
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
