import { assertNever } from './assertNever';
import { DEFAULT_CAMERA, worldToDeviceTransform } from './camera';
import { ARROW_HEAD_ANGLE, arrowHeadLength, isFilled, shapeBox } from './shapeGeometry';
import type { ArrowShape, PathPoint, Shape } from './shapes';
import type { EditorState } from './store';

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
  | 'rect'
  | 'ellipse'
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
>;

export type Viewport = {
  /** Backing-store size in device pixels. */
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly devicePixelRatio: number;
};

export type Renderer = {
  draw(state: EditorState, viewport: Viewport): void;
};

/** Full redraw every frame. Dirty rectangles only if profiling proves they help (M8). */
export function createRenderer(context: RenderContext): Renderer {
  // Reused every frame so drawing allocates nothing for the camera transform.
  const transform = worldToDeviceTransform(DEFAULT_CAMERA, 1);

  return {
    draw(state, viewport) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, viewport.pixelWidth, viewport.pixelHeight);

      const t = worldToDeviceTransform(state.camera, viewport.devicePixelRatio, transform);
      context.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

      const { shapes, order } = state.document;
      for (const id of order) {
        // Always present while document invariants hold (checked from M5).
        const shape = shapes.get(id);
        if (shape !== undefined) {
          drawShape(context, shape);
        }
      }
      if (state.draft !== null) {
        drawShape(context, state.draft);
      }
    },
  };
}

function drawShape(context: RenderContext, shape: Shape): void {
  const box = shapeBox(shape);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const { style } = shape;

  context.save();
  // Every shape is drawn centered on the origin, so rotation is always around its center.
  context.translate(centerX, centerY);
  context.rotate(shape.rotation);
  context.globalAlpha = style.opacity;
  context.lineWidth = style.strokeWidth;
  context.strokeStyle = style.strokeColor;
  context.lineJoin = shape.type === 'rectangle' ? 'miter' : 'round';
  context.lineCap = 'round';
  context.beginPath();
  // Path points are relative to (x, y); this offset makes them relative to the center.
  traceShape(context, shape, box.width, box.height, shape.x - centerX, shape.y - centerY);
  if (isFilled(shape) && style.fillColor !== null) {
    context.fillStyle = style.fillColor;
    context.fill();
  }
  context.stroke();
  context.restore();
}

function traceShape(
  context: RenderContext,
  shape: Shape,
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
  const [start, end] = shape.points;
  const length = arrowHeadLength(shape);
  const shaftAngle = Math.atan2(end.y - start.y, end.x - start.x);
  const tipX = end.x + offsetX;
  const tipY = end.y + offsetY;
  for (const side of [-1, 1]) {
    const angle = shaftAngle + Math.PI + side * ARROW_HEAD_ANGLE;
    context.moveTo(tipX, tipY);
    context.lineTo(tipX + Math.cos(angle) * length, tipY + Math.sin(angle) * length);
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
