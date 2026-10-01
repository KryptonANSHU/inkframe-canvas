import type { Bounds } from './geometry/bounds';

/** How close, in screen pixels, an edge or center must come to snap (PRD 1C). */
export const SNAP_THRESHOLD_PX = 6;
/** How far around the moving shapes, in screen pixels, to look for snap targets. */
export const SNAP_REACH_PX = 1200;

/**
 * A guide line to draw while snapped: vertical (axis 'x', at x = `at`) or horizontal
 * (axis 'y'), spanning `from`–`to` along the other axis to cover every aligned shape.
 */
export type Guide = {
  readonly axis: 'x' | 'y';
  readonly at: number;
  readonly from: number;
  readonly to: number;
};

export type SnapResult = { readonly dx: number; readonly dy: number; readonly guides: Guide[] };

/** Below this (world units), two lines count as the same line when drawing guides. */
const SAME_LINE = 1e-6;

type Axis = {
  readonly lines: readonly number[];
  readonly spanMin: number;
  readonly spanMax: number;
};

/** min, center, and max along one axis, plus the extent along the other. */
function axisOf(bounds: Bounds, axis: 'x' | 'y'): Axis {
  const [min, max, spanMin, spanMax] =
    axis === 'x'
      ? [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]
      : [bounds.minY, bounds.maxY, bounds.minX, bounds.maxX];
  return { lines: [min, (min + max) / 2, max], spanMin, spanMax };
}

/**
 * Snaps a moving box to other shapes' edges and centers. Each axis snaps on its own,
 * to the closest line within `threshold` (world units); then guides are drawn for every
 * line that now coincides, so equal-distance matches all show.
 */
export function snapMove(
  moving: Bounds,
  targets: readonly Bounds[],
  threshold: number,
): SnapResult {
  const dx = closestOffset(axisOf(moving, 'x').lines, targets, 'x', threshold);
  const dy = closestOffset(axisOf(moving, 'y').lines, targets, 'y', threshold);
  const moved: Bounds = {
    minX: moving.minX + dx,
    maxX: moving.maxX + dx,
    minY: moving.minY + dy,
    maxY: moving.maxY + dy,
  };
  const guides = [...guidesFor(moved, targets, 'x'), ...guidesFor(moved, targets, 'y')];
  return { dx, dy, guides };
}

function closestOffset(
  lines: readonly number[],
  targets: readonly Bounds[],
  axis: 'x' | 'y',
  threshold: number,
): number {
  let best = 0;
  let bestDistance = threshold;
  for (const target of targets) {
    for (const to of axisOf(target, axis).lines) {
      for (const from of lines) {
        const distance = Math.abs(to - from);
        if (distance <= bestDistance) {
          best = to - from;
          bestDistance = distance;
        }
      }
    }
  }
  return best;
}

/** One guide per aligned line, spanning the moving box and every target on that line. */
function guidesFor(moved: Bounds, targets: readonly Bounds[], axis: 'x' | 'y'): Guide[] {
  const own = axisOf(moved, axis);
  const guides: Guide[] = [];
  for (const at of own.lines) {
    let from = own.spanMin;
    let to = own.spanMax;
    let aligned = false;
    for (const target of targets) {
      const other = axisOf(target, axis);
      if (other.lines.some((line) => Math.abs(line - at) < SAME_LINE)) {
        aligned = true;
        from = Math.min(from, other.spanMin);
        to = Math.max(to, other.spanMax);
      }
    }
    if (aligned) {
      guides.push({ axis, at, from, to });
    }
  }
  return guides;
}
