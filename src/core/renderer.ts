import { assertNever } from './assertNever';
import { DEFAULT_CAMERA, worldToDeviceTransform } from './camera';
import type { RectShape, Shape } from './shapes';
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
  | 'fill'
  | 'stroke'
  | 'globalAlpha'
  | 'lineWidth'
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
  switch (shape.type) {
    // Shape has a single member until M3 adds the other shape types; remove this then.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case 'rectangle':
      drawRectangle(context, shape);
      return;
    default:
      assertNever(shape.type);
  }
}

function drawRectangle(context: RenderContext, shape: RectShape): void {
  const { style } = shape;
  context.save();
  // Rotate around the box center, then draw the box centered on the origin.
  context.translate(shape.x + shape.width / 2, shape.y + shape.height / 2);
  context.rotate(shape.rotation);
  context.globalAlpha = style.opacity;
  context.beginPath();
  context.rect(-shape.width / 2, -shape.height / 2, shape.width, shape.height);
  if (style.fillColor !== null) {
    context.fillStyle = style.fillColor;
    context.fill();
  }
  context.lineWidth = style.strokeWidth;
  context.strokeStyle = style.strokeColor;
  context.stroke();
  context.restore();
}
