import { boundsIntersect, isFiniteBounds, type Bounds } from '../geometry/bounds';
import { shapeBounds } from '../shapeGeometry';
import type { Shape, ShapeId } from '../shapes';

export const DEFAULT_CELL_SIZE = 256;
/** A shape covering more cells than this goes in one "oversized" list instead. */
const MAX_CELLS_PER_SHAPE = 64;
/** A query covering more cells than this scans every entry instead. */
const MAX_CELLS_PER_QUERY = 256;
/** Cell coordinates are clamped to ±2^20, so keys fit exactly in a double. */
const CELL_LIMIT = 2 ** 20;

type Entry = {
  readonly bounds: Bounds;
  /** null when the shape is in the oversized list. */
  readonly cellKeys: readonly number[] | null;
};

/** The index's full contents in a canonical order, for comparing against a rebuild. */
export type IndexSnapshot = {
  readonly entries: readonly (readonly [ShapeId, Bounds, readonly number[] | 'oversized'])[];
  readonly cells: readonly (readonly [number, readonly ShapeId[]])[];
};

export type SpatialIndex = {
  /** Adds the shape, or re-indexes it if its bounds changed. The only way in. */
  update(shape: Shape): void;
  /** The only way out. Removing an unknown ID does nothing. */
  remove(id: ShapeId): void;
  /** IDs of shapes whose bounds intersect `area`, in no particular order. */
  query(area: Bounds): ShapeId[];
  size(): number;
  snapshot(): IndexSnapshot;
};

export type SpatialIndexOptions = {
  readonly cellSize?: number;
  /** Swappable so text bounds can depend on font metrics (M3d). */
  readonly getBounds?: (shape: Shape) => Bounds;
};

/** A uniform grid over world space. Each shape is filed under every cell its bounds touch. */
export function createSpatialIndex(options: SpatialIndexOptions = {}): SpatialIndex {
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  const getBounds = options.getBounds ?? shapeBounds;
  const entries = new Map<ShapeId, Entry>();
  const cells = new Map<number, Set<ShapeId>>();
  const oversized = new Set<ShapeId>();
  const toCells = (bounds: Bounds) => cellRange(bounds, cellSize);

  const remove = (id: ShapeId) => {
    const entry = entries.get(id);
    if (entry === undefined) {
      return;
    }
    entries.delete(id);
    oversized.delete(id);
    for (const key of entry.cellKeys ?? []) {
      const cell = cells.get(key);
      cell?.delete(id);
      if (cell?.size === 0) {
        cells.delete(key);
      }
    }
  };

  return {
    update(shape) {
      const bounds = getBounds(shape);
      const existing = entries.get(shape.id);
      if (existing !== undefined && sameBounds(existing.bounds, bounds)) {
        return;
      }
      remove(shape.id);
      const range = isFiniteBounds(bounds) ? toCells(bounds) : null;
      if (range === null || range.count > MAX_CELLS_PER_SHAPE) {
        // Non-finite bounds can't be placed in cells; keeping them here means queries
        // still return them, and the exact hit-test rejects them.
        oversized.add(shape.id);
        entries.set(shape.id, { bounds, cellKeys: null });
        return;
      }
      const cellKeys = keysInRange(range);
      for (const key of cellKeys) {
        const cell = cells.get(key);
        if (cell === undefined) {
          cells.set(key, new Set([shape.id]));
        } else {
          cell.add(shape.id);
        }
      }
      entries.set(shape.id, { bounds, cellKeys });
    },

    remove,

    query(area) {
      const range = toCells(area);
      const candidates =
        range.count > MAX_CELLS_PER_QUERY
          ? entries.keys()
          : collectCandidates(cells, keysInRange(range), oversized);
      const found: ShapeId[] = [];
      for (const id of candidates) {
        const entry = entries.get(id);
        if (entry !== undefined && boundsIntersect(entry.bounds, area)) {
          found.push(id);
        }
      }
      return found;
    },

    size: () => entries.size,

    snapshot: () => createSnapshot(entries, cells),
  };
}

type CellRange = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly count: number;
};

function cellRange(bounds: Bounds, cellSize: number): CellRange {
  const minX = clampCell(Math.floor(bounds.minX / cellSize));
  const minY = clampCell(Math.floor(bounds.minY / cellSize));
  const maxX = clampCell(Math.floor(bounds.maxX / cellSize));
  const maxY = clampCell(Math.floor(bounds.maxY / cellSize));
  return { minX, minY, maxX, maxY, count: (maxX - minX + 1) * (maxY - minY + 1) };
}

function clampCell(cell: number): number {
  return Math.max(-CELL_LIMIT, Math.min(CELL_LIMIT - 1, cell));
}

function keysInRange(range: CellRange): number[] {
  const keys: number[] = [];
  for (let x = range.minX; x <= range.maxX; x++) {
    for (let y = range.minY; y <= range.maxY; y++) {
      keys.push((x + CELL_LIMIT) * 2 * CELL_LIMIT + (y + CELL_LIMIT));
    }
  }
  return keys;
}

function collectCandidates(
  cells: ReadonlyMap<number, ReadonlySet<ShapeId>>,
  keys: readonly number[],
  oversized: ReadonlySet<ShapeId>,
): Set<ShapeId> {
  const candidates = new Set(oversized);
  for (const key of keys) {
    for (const id of cells.get(key) ?? []) {
      candidates.add(id);
    }
  }
  return candidates;
}

function sameBounds(a: Bounds, b: Bounds): boolean {
  return a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY;
}

function createSnapshot(
  entries: ReadonlyMap<ShapeId, Entry>,
  cells: ReadonlyMap<number, ReadonlySet<ShapeId>>,
): IndexSnapshot {
  const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return {
    entries: [...entries]
      .sort(([a], [b]) => byId(a, b))
      .map(([id, entry]) => [id, entry.bounds, entry.cellKeys ?? 'oversized'] as const),
    cells: [...cells]
      .sort(([a], [b]) => a - b)
      .map(([key, ids]) => [key, [...ids].sort(byId)] as const),
  };
}
