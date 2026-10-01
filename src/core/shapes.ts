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
  /** Top-left corner of the unrotated box, in world units. */
  readonly x: number;
  readonly y: number;
  /** Radians around the box center, normalized to 0–2π. */
  readonly rotation: number;
  readonly style: ShapeStyle;
  /** Position in the document's draw order: 0 is the bottom. */
  readonly zIndex: number;
};

export type RectShape = ShapeBase & {
  readonly type: 'rectangle';
  readonly width: number;
  readonly height: number;
};

export type Shape = RectShape;

export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
  strokeColor: '#1e2430',
  fillColor: null,
  strokeWidth: 2,
  opacity: 1,
};

/** Smallest width or height a shape may have, in world units. */
export const MIN_SHAPE_SIZE = 1;
