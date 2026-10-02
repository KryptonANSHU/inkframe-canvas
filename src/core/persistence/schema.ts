import { z } from 'zod';
import { simplifyPath } from '../geometry/simplify';
import {
  ANCHORS,
  MAX_PEN_POINTS,
  MIN_SHAPE_SIZE,
  TEXT_FONTS,
  type GroupId,
  type Shape,
  type ShapeId,
} from '../shapes';
import { normalizeAngle } from '../transform/angles';

// zod 4's z.number() already rejects NaN and ±Infinity.
const coordinate = z.number();
const size = z.number().min(MIN_SHAPE_SIZE);
/**
 * Colors are written into exported SVG markup, so only plain hex colors are allowed:
 * anything else could inject markup.
 */
const color = z.string().regex(/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
const point = z.object({ x: coordinate, y: coordinate });

const style = z.object({
  strokeColor: color,
  fillColor: color.nullable(),
  strokeWidth: z.number().positive().max(1000),
  opacity: z.number().min(0).max(1),
});

// The brand exists only at the type level, so a validated string needs this one cast.
const shapeId = z
  .string()
  .min(1)
  .max(200)
  .transform((id) => id as ShapeId);

// Absent rather than undefined when an end is free, matching the Shape type.
const attachment = z.object({ shapeId, anchor: z.enum(ANCHORS) }).exactOptional();

/** Shared by every shape. Rotation is normalized rather than refused. */
const base = {
  id: shapeId,
  x: coordinate,
  y: coordinate,
  rotation: coordinate.transform(normalizeAngle),
  style,
  zIndex: z.number().int().nonnegative(),
  // Absent rather than undefined when a shape isn't grouped, matching the Shape type.
  groupId: z
    .string()
    .min(1)
    .max(200)
    .transform((id) => id as GroupId)
    .exactOptional(),
};

function shapeSchemaWith(penPoints: z.ZodType<Readonly<{ x: number; y: number }>[]>) {
  return z.discriminatedUnion('type', [
    z.object({ ...base, type: z.literal('rectangle'), width: size, height: size }),
    z.object({ ...base, type: z.literal('ellipse'), width: size, height: size }),
    z.object({ ...base, type: z.literal('line'), points: z.tuple([point, point]) }),
    z.object({
      ...base,
      type: z.literal('arrow'),
      points: z.tuple([point, point]),
      start: attachment,
      end: attachment,
    }),
    z.object({ ...base, type: z.literal('pen'), points: penPoints }),
    z.object({
      ...base,
      type: z.literal('text'),
      width: size,
      height: size,
      text: z.string().max(100_000),
      fontSize: z.number().min(1).max(1000),
      font: z.enum(TEXT_FONTS).exactOptional(),
    }),
  ]);
}

/** A shape as the document holds it. The invariants checker validates against this. */
export const shapeSchema = shapeSchemaWith(
  z.array(point).min(2).max(MAX_PEN_POINTS),
) satisfies z.ZodType<Shape>;

/**
 * A shape from a file. Freehand paths over the point limit are simplified to fit
 * rather than refused.
 */
export const importedShapeSchema = shapeSchemaWith(
  z
    .array(point)
    .min(2)
    .transform((points) => simplifyPath(points, MAX_PEN_POINTS)),
) satisfies z.ZodType<Shape>;

/** "points.3.x: Invalid input: expected number" for the first problem found. */
export function describeIssue(error: z.ZodError): string {
  const [issue] = error.issues;
  if (issue === undefined) {
    return 'Invalid data.';
  }
  const path = issue.path.map(String).join('.');
  return path === '' ? issue.message : `${path}: ${issue.message}`;
}
