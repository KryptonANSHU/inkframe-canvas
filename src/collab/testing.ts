import * as Y from 'yjs';
import { vi } from 'vitest';
import { toFile } from '../core/persistence/fileFormat';
import { createEditorStore, type EditorStore } from '../core/store';
import { bindDocument } from './binding';

/** Replica origin for updates arriving from another replica in tests. */
const PEER = Symbol('peer');

export type Replica = { readonly store: EditorStore; readonly doc: Y.Doc };

/**
 * In-memory replicas of one shared drawing, like clients on a relay. While
 * partitioned, updates queue up; `sync` delivers them all, as a reconnect would.
 */
export function replicas(count: number, initial?: Parameters<typeof createEditorStore>[0]) {
  const all: Replica[] = Array.from({ length: count }, (_, i) => {
    const store = createEditorStore(
      i === 0 ? { ...initial, gridVisible: false } : { gridVisible: false },
    );
    const doc = new Y.Doc();
    bindDocument(store, doc, { seed: i === 0, reportError: vi.fn() });
    return { store, doc };
  });
  let partitioned = false;
  const queued: { to: Y.Doc; update: Uint8Array }[] = [];
  for (const from of all) {
    from.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === PEER) return;
      for (const to of all) {
        if (to === from) continue;
        if (partitioned) queued.push({ to: to.doc, update });
        else Y.applyUpdate(to.doc, update, PEER);
      }
    });
  }
  // Late joiners catch up on what the first replica seeded.
  const seedState = Y.encodeStateAsUpdate(all[0]?.doc ?? new Y.Doc());
  for (const replica of all.slice(1)) Y.applyUpdate(replica.doc, seedState, PEER);

  return {
    all,
    partition() {
      partitioned = true;
    },
    sync() {
      partitioned = false;
      // Deliver until quiet: repairs written on delivery are relayed too.
      while (queued.length > 0) {
        const next = queued.shift();
        if (next !== undefined) Y.applyUpdate(next.to, next.update, PEER);
      }
    },
  };
}

/**
 * A replica's drawing as its saved file, keys sorted (validation rebuilds objects in
 * schema order): equal strings mean identical drawings.
 */
export function snapshot(replica: Replica): string {
  return JSON.stringify(toFile(replica.store.getState().document), (_key, value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
}
