import { assertNever } from '../assertNever';
import { pathWorldPoints, shapeGeometryBounds } from '../shapeGeometry';
import type { Shape } from '../shapes';

/** Longest text quoted in a description; the rest is cut with an ellipsis. */
const MAX_QUOTED = 60;

/**
 * A shape in words, for screen readers: what it is, how big, and where (world units,
 * rounded), e.g. "Rectangle, 120 × 80 at 200, 300, rotated 45°". Paths say where they
 * run instead; text quotes its words.
 */
export function describeShape(shape: Shape): string {
  return [what(shape), ...extras(shape)].join(', ');
}

/** The kind alone, for short announcements ("Rectangle selected"). */
export function shapeKind(shape: Shape): string {
  switch (shape.type) {
    case 'rectangle':
      return 'Rectangle';
    case 'ellipse':
      return 'Ellipse';
    case 'line':
      return 'Line';
    case 'arrow':
      return 'Arrow';
    case 'pen':
      return 'Freehand stroke';
    case 'text':
      return 'Text';
    default:
      return assertNever(shape);
  }
}

function what(shape: Shape): string {
  switch (shape.type) {
    case 'line':
    case 'arrow': {
      const [from, to] = pathWorldPoints(shape);
      return `${shapeKind(shape)} from ${point(from)} to ${point(to)}`;
    }
    case 'text':
      return `Text “${quoted(shape.text)}”`;
    case 'rectangle':
    case 'ellipse':
    case 'pen': {
      const { minX, minY, maxX, maxY } = shapeGeometryBounds(shape);
      return `${shapeKind(shape)}, ${round(maxX - minX)} × ${round(maxY - minY)} at ${round(minX)}, ${round(minY)}`;
    }
    default:
      return assertNever(shape);
  }
}

function extras(shape: Shape): string[] {
  const notes: string[] = [];
  // Paths already say where they run; turning them is part of that.
  const turned = shape.type !== 'line' && shape.type !== 'arrow' && shape.rotation !== 0;
  if (turned) notes.push(`rotated ${round((shape.rotation * 180) / Math.PI)}°`);
  if (shape.groupId !== undefined) notes.push('in a group');
  return notes;
}

function quoted(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_QUOTED ? `${flat.slice(0, MAX_QUOTED - 1)}…` : flat;
}

function point(at: Readonly<{ x: number; y: number }> | undefined): string {
  return at === undefined ? '?' : `${round(at.x)}, ${round(at.y)}`;
}

function round(value: number): string {
  // `+ 0` turns -0 into 0, so it never reads "minus zero".
  return String(Math.round(value) + 0);
}
