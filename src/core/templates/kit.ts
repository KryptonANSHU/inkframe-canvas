import { anchorPoint } from '../attachments';
import type { Point } from '../geometry/point';
import {
  createGroupId,
  createShapeId,
  type Anchor,
  type ArrowShape,
  type BoxShape,
  type EllipseShape,
  type PenShape,
  type RectShape,
  type Shape,
  type ShapeStyle,
  type TextFont,
  type TextShape,
} from '../shapes';
import { DEFAULT_TEXT_FONT } from '../text/font';
import { withText } from '../text/textShape';
import type { TextMeasurer } from '../text/layout';
import { pathBetween } from '../tools/shapeBuilders';
import { fillSwatches, strokeSwatches } from '../../design/tokens';

export type StrokeName =
  'Ink' | 'Slate' | 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Violet';
export type FillName = 'Gray' | 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Violet';

/** How a shape looks, by swatch name, so templates use the palette (and its dark mode). */
export type Look = {
  readonly stroke?: StrokeName;
  readonly fill?: FillName;
  readonly width?: number;
};

/** Stored colors are the light swatches, lower case, as the style panel writes them. */
function swatch(swatches: readonly { name: string; light: string }[], name: string): string {
  const found = swatches.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`No swatch named ${name}.`);
  return found.light.toLowerCase();
}

function style(look: Look = {}): ShapeStyle {
  return {
    strokeColor: swatch(strokeSwatches, look.stroke ?? 'Ink'),
    fillColor: look.fill === undefined ? null : swatch(fillSwatches, look.fill),
    strokeWidth: look.width ?? 2,
    opacity: 1,
  };
}

/** Labels get a little room beyond their measured width, so they never wrap. */
const LABEL_SLACK = 1.1;

export type TemplateKit = {
  rect(x: number, y: number, width: number, height: number, look?: Look): RectShape;
  ellipse(x: number, y: number, width: number, height: number, look?: Look): EllipseShape;
  /** A decision diamond: a square of side `size` turned 45°, centered on (cx, cy). */
  diamond(cx: number, cy: number, size: number, look?: Look): RectShape;
  /** Left-aligned text at (x, y), on one line unless `width` makes it wrap. */
  text(content: string, x: number, y: number, options?: TextOptions): TextShape;
  /** Text centered on a shape. */
  label(content: string, on: BoxShape, options?: TextOptions): TextShape;
  /** An arrow attached at both ends, so it follows either shape when it moves. */
  arrow(
    from: BoxShape,
    fromAnchor: Anchor,
    to: BoxShape,
    toAnchor: Anchor,
    look?: Look,
  ): ArrowShape;
  /**
   * An arrow between two ends, each attached to a shape's anchor or free at a point
   * (e.g. a diamond's tip, which isn't an anchor).
   */
  connect(from: ArrowEnd, to: ArrowEnd, look?: Look): ArrowShape;
  /** A freehand stroke through the given points. */
  pen(points: readonly Point[], look?: Look): PenShape;
  /** The shapes as one group: a click selects them all, and they move together. */
  group(...shapes: Shape[]): Shape[];
};

export type ArrowEnd = { readonly shape: BoxShape; readonly anchor: Anchor } | Point;

export type TextOptions = {
  /** Hand-drawn unless said otherwise, like text typed in the editor. */
  readonly font?: TextFont;
  readonly size?: number;
  readonly color?: StrokeName;
  readonly width?: number;
};

/** Shape builders for templates. Text is measured with `measurer`, like typed text. */
export function createKit(measurer: TextMeasurer): TemplateKit {
  const base = { rotation: 0, zIndex: 0 };
  const connect = (from: ArrowEnd, to: ArrowEnd, look?: Look): ArrowShape => {
    const at = (end: ArrowEnd) => ('shape' in end ? anchorPoint(end.shape, end.anchor) : end);
    const attach = (end: ArrowEnd) =>
      'shape' in end ? { shapeId: end.shape.id, anchor: end.anchor } : undefined;
    const start = attach(from);
    const end = attach(to);
    return {
      ...base,
      id: createShapeId(),
      type: 'arrow',
      ...pathBetween(at(from), at(to)),
      style: style(look),
      ...(start === undefined ? {} : { start }),
      ...(end === undefined ? {} : { end }),
    };
  };
  const makeText = (content: string, x: number, y: number, options: TextOptions = {}) => {
    const fontSize = options.size ?? 18;
    const font = options.font ?? DEFAULT_TEXT_FONT;
    const width =
      options.width ?? Math.ceil(measurer.width(content, fontSize, font) * LABEL_SLACK) + 4;
    const shape: TextShape = {
      ...base,
      id: createShapeId(),
      type: 'text',
      x,
      y,
      width,
      height: 1,
      text: content,
      fontSize,
      font,
      style: style({ stroke: options.color ?? 'Ink' }),
    };
    const measured = withText(shape, content, measurer);
    if (measured === null) throw new Error('Template text must not be blank.');
    return measured;
  };

  return {
    rect: (x, y, width, height, look) => ({
      ...base,
      id: createShapeId(),
      type: 'rectangle',
      x,
      y,
      width,
      height,
      style: style(look),
    }),
    ellipse: (x, y, width, height, look) => ({
      ...base,
      id: createShapeId(),
      type: 'ellipse',
      x,
      y,
      width,
      height,
      style: style(look),
    }),
    diamond: (cx, cy, size, look) => ({
      ...base,
      id: createShapeId(),
      type: 'rectangle',
      x: cx - size / 2,
      y: cy - size / 2,
      width: size,
      height: size,
      rotation: Math.PI / 4,
      style: style(look),
    }),
    text: makeText,
    label(content, on, options) {
      const measured = makeText(content, 0, 0, options);
      // Centered on the text's own width; the box keeps a little slack to its right.
      const inked = measurer.width(content, measured.fontSize, measured.font);
      const centerX = on.x + on.width / 2;
      const centerY = on.y + on.height / 2;
      return { ...measured, x: centerX - inked / 2, y: centerY - measured.height / 2 };
    },
    arrow: (from, fromAnchor, to, toAnchor, look) =>
      connect({ shape: from, anchor: fromAnchor }, { shape: to, anchor: toAnchor }, look),
    connect,
    pen(points, look) {
      const minX = Math.min(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      return {
        ...base,
        id: createShapeId(),
        type: 'pen',
        x: minX,
        y: minY,
        points: points.map((point) => ({ x: point.x - minX, y: point.y - minY })),
        style: style(look),
      };
    },
    group(...shapes) {
      const groupId = createGroupId();
      return shapes.map((shape) => ({ ...shape, groupId }));
    },
  };
}
