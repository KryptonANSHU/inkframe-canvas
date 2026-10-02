import type * as Y from 'yjs';
import { z } from 'zod';
import { shapeSchema } from '../core/persistence/schema';
import type { Shape, ShapeId } from '../core/shapes';

/**
 * The shared drawing, as stored in Yjs: one map entry per shape, keyed by shape ID.
 * An entry is replaced whole on every change, so concurrent edits to one shape resolve
 * last-writer-wins, and edits to different shapes never conflict. `zIndex` isn't
 * stored; draw order comes from each entry's fractional `key`.
 */
export type SharedEntry = {
  readonly shape: Omit<Shape, 'zIndex'>;
  readonly key: string;
};

export type SharedShapes = Y.Map<SharedEntry>;

export function sharedShapes(doc: Y.Doc): SharedShapes {
  return doc.getMap<SharedEntry>('shapes');
}

export function toEntry(shape: Shape, key: string): SharedEntry {
  const { zIndex: _zIndex, ...rest } = shape;
  return { shape: rest, key };
}

const entrySchema = z.object({
  key: z.string().regex(/^[0-9A-Za-z]{0,63}[1-9A-Za-z]$/),
  shape: z.record(z.string(), z.unknown()),
});

/**
 * Validates an entry from another client like any outside input: the shape schema the
 * file format uses, the order key's form, and the shape's ID matching its map key.
 * Returns null for anything else, which is then treated as absent.
 */
export function readEntry(id: string, raw: unknown): { shape: Shape; key: string } | null {
  const entry = entrySchema.safeParse(raw);
  if (!entry.success) return null;
  const shape = shapeSchema.safeParse({ ...entry.data.shape, zIndex: 0 });
  if (!shape.success || shape.data.id !== (id as ShapeId)) return null;
  return { shape: shape.data, key: entry.data.key };
}
