import * as Y from 'yjs';
import { attachmentViolations, settleAttachments } from '../core/attachments';
import type { DocumentState } from '../core/document';
import type { Shape, ShapeId } from '../core/shapes';
import type { EditorStore } from '../core/store';
import { assignKeys, compareOrder } from './orderKeys';
import { readEntry, sharedShapes, toEntry, type SharedEntry } from './sharedDocument';

/** Transaction origins: the local user's edits (tracked for undo), and the rest. */
export const LOCAL_EDIT = Symbol('local edit');
export const REPAIR = Symbol('repair');
export const SEED = Symbol('seed');

export type BindingOptions = {
  /** Copies the store's drawing into the shared document (a new room). */
  readonly seed: boolean;
  /** Told once per remote shape that fails validation. */
  readonly reportError: (error: Error) => void;
};

export type DocumentBinding = { dispose(): void };

/**
 * Keeps the store and a Yjs document in step. The store stays what the editor reads
 * and commands write; every local document change is written to Yjs in one
 * transaction tagged LOCAL_EDIT, and every other transaction (remote edits, undo) is
 * validated, applied to the store, and repaired if the merge broke an invariant.
 */
export function bindDocument(
  store: EditorStore,
  doc: Y.Doc,
  { seed, reportError }: BindingOptions,
): DocumentBinding {
  const shared = sharedShapes(doc);
  /** The order key of every shape in the shared document (this client's view). */
  const keys = new Map<ShapeId, string>();
  const rejected = new Set<string>();
  let applying = false;

  const writeLocal = (before: DocumentState, after: DocumentState, origin: symbol) => {
    doc.transact(() => {
      for (const id of before.shapes.keys()) {
        if (!after.shapes.has(id)) {
          shared.delete(id);
          keys.delete(id);
        }
      }
      const rekeyed =
        before.order === after.order ? new Map<string, string>() : assignKeys(after.order, keys);
      for (const [id, shape] of after.shapes) {
        const newKey = rekeyed.get(id);
        const old = before.shapes.get(id);
        if (newKey === undefined && old !== undefined && sameExceptZIndex(old, shape)) continue;
        const key = newKey ?? keys.get(id);
        if (key === undefined) continue;
        keys.set(id, key);
        shared.set(id, toEntry(shape, key));
      }
    }, origin);
  };

  const applyShared = (changed: Iterable<string>) => {
    const { document, selectedIds } = store.getState();
    const shapes = new Map(document.shapes);
    for (const id of changed) {
      const raw = shared.get(id);
      const entry = raw === undefined ? null : readEntry(id, raw);
      if (entry === null) {
        if (raw !== undefined && !rejected.has(id)) {
          rejected.add(id);
          reportError(
            new Error(`A collaborator sent a shape Inkframe can't use (${id}); it was skipped.`),
          );
        }
        shapes.delete(id as ShapeId);
        keys.delete(id as ShapeId);
      } else {
        shapes.set(entry.shape.id, entry.shape);
        keys.set(entry.shape.id, entry.key);
      }
    }
    const next = repaired(ordered(shapes, keys));
    applying = true;
    store.setState({
      document: next.document,
      selectedIds: new Set([...selectedIds].filter((id) => next.document.shapes.has(id))),
    });
    applying = false;
    if (next.fixes.length > 0) {
      // Every client derives the same repair from the same merged state, so writing it
      // back converges; it is nobody's undo step.
      doc.transact(() => {
        for (const shape of next.fixes) {
          const key = keys.get(shape.id);
          if (key !== undefined) shared.set(shape.id, toEntry(shape, key));
        }
      }, REPAIR);
    }
  };

  const onShared = (event: Y.YMapEvent<SharedEntry>, transaction: Y.Transaction) => {
    if (transaction.origin !== LOCAL_EDIT) applyShared(event.keysChanged);
  };

  if (seed) {
    writeLocal({ shapes: new Map(), order: [] }, store.getState().document, SEED);
  } else {
    store.setState({ document: { shapes: new Map(), order: [] }, selectedIds: new Set() });
    applyShared(shared.keys());
  }
  shared.observe(onShared);
  const unsubscribe = store.subscribe((state, previous) => {
    if (!applying && state.document !== previous.document) {
      writeLocal(previous.document, state.document, LOCAL_EDIT);
    }
  });

  return {
    dispose() {
      unsubscribe();
      shared.unobserve(onShared);
    },
  };
}

/** The document with shapes in key order and each zIndex matching its place. */
function ordered(
  shapes: ReadonlyMap<ShapeId, Shape>,
  keys: ReadonlyMap<ShapeId, string>,
): DocumentState {
  const order = [...shapes.keys()]
    .map((id) => ({ id, key: keys.get(id) ?? '' }))
    .sort(compareOrder)
    .map(({ id }) => id);
  const numbered = new Map<ShapeId, Shape>();
  order.forEach((id, zIndex) => {
    const shape = shapes.get(id);
    if (shape !== undefined)
      numbered.set(id, shape.zIndex === zIndex ? shape : { ...shape, zIndex });
  });
  return { shapes: numbered, order };
}

/**
 * A merge can leave an arrow attached to a shape someone else deleted, or off an
 * anchor that moved concurrently. Only arrows that actually break the attachment
 * invariant are settled: re-aiming every arrow would rewrite them on each change, and
 * browsers' trig can differ in the last bits, so two clients could rewrite each other
 * forever. The fixed arrows are returned so they can be written back.
 */
function repaired(document: DocumentState): { document: DocumentState; fixes: Shape[] } {
  const broken = new Set<ShapeId>();
  for (const shape of document.shapes.values()) {
    if (
      shape.type === 'arrow' &&
      attachmentViolations(shape, (id) => document.shapes.get(id)).length > 0
    ) {
      broken.add(shape.id);
    }
  }
  if (broken.size === 0) return { document, fixes: [] };
  const all = document.order.flatMap((id) => document.shapes.get(id) ?? []);
  const fixes = settleAttachments(all).filter((shape) => broken.has(shape.id));
  const shapes = new Map(document.shapes);
  for (const shape of fixes) shapes.set(shape.id, shape);
  return { document: { shapes, order: document.order }, fixes };
}

/** Renumbering copies shapes with a new zIndex only; nothing else about them changed. */
function sameExceptZIndex(a: Shape, b: Shape): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a) as (keyof Shape)[];
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => key === 'zIndex' || a[key] === b[key]);
}
