export type ShapeId = string & { readonly __brand: 'ShapeId' };

export function createShapeId(): ShapeId {
  // The brand exists only at the type level, so minting an ID needs this one cast.
  return crypto.randomUUID() as ShapeId;
}

export type ShapeStyle = {
  readonly strokeColor: string;
  /** null means no fill: the shape is hit and drawn only on its stroke. */
  readonly fillColor: string | null;
  readonly strokeWidth: number;
  readonly opacity: number;
};

type ShapeBase = {
  readonly id: ShapeId;
  /** Top-left corner of the unrotated bounding box, in world units. */
  readonly x: number;
  readonly y: number;
  /** Radians around the box center, normalized to 0–2π. */
  readonly rotation: number;
  readonly style: ShapeStyle;
  /** Position in the document's draw order: 0 is the bottom. */
  readonly zIndex: number;
};

type BoxShapeBase = ShapeBase & {
  readonly width: number;
  readonly height: number;
};

export type RectShape = BoxShapeBase & { readonly type: 'rectangle' };

export type EllipseShape = BoxShapeBase & { readonly type: 'ellipse' };

/** A point relative to the shape's (x, y), so moving a shape never touches its points. */
export type PathPoint = { readonly x: number; readonly y: number };

export type LineShape = ShapeBase & {
  readonly type: 'line';
  readonly points: readonly [PathPoint, PathPoint];
};

export type ArrowShape = ShapeBase & {
  readonly type: 'arrow';
  /** The arrowhead is drawn at the second point. */
  readonly points: readonly [PathPoint, PathPoint];
};

export type PenShape = ShapeBase & {
  readonly type: 'pen';
  readonly points: readonly PathPoint[];
};

/**
 * Plain text wrapped inside `width`. `height` is the laid-out height, measured with the
 * loaded font when the text is committed, so bounds never depend on re-measuring.
 * Drawn in the stroke color.
 */
export type TextShape = BoxShapeBase & {
  readonly type: 'text';
  readonly text: string;
  /** In world units. */
  readonly fontSize: number;
};

export type BoxShape = RectShape | EllipseShape | TextShape;
export type PathShape = LineShape | ArrowShape | PenShape;
export type Shape = BoxShape | PathShape;

export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
  strokeColor: '#1e2430',
  fillColor: null,
  strokeWidth: 2,
  opacity: 1,
};

/** Smallest width or height a shape may have, in world units. */
export const MIN_SHAPE_SIZE = 1;

/** Most points a freehand path may have. */
export const MAX_PEN_POINTS = 10_000;
