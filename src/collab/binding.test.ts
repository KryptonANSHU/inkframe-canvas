import * as Y from 'yjs';
import { describe, expect, it, vi } from 'vitest';
import { deleteCommand, reshapeCommand } from '../core/attachments';
import { createShapeCommand, executeCommand } from '../core/commands';
import { arrangeSelection } from '../core/arrange';
import { invariantViolations } from '../core/invariants';
import { documentFromShapes } from '../core/persistence/fileFormat';
import type { Shape } from '../core/shapes';
import { createEditorStore } from '../core/store';
import { makeArrow, makeRect, testShapeId } from '../core/testing/factories';
import { bindDocument } from './binding';
import { sharedShapes } from './sharedDocument';
import { replicas, snapshot, type Replica } from './testing';

const rect = (name: string, x = 0) =>
  makeRect({ id: testShapeId(name), x, width: 100, height: 50 });
const create = (replica: Replica, shape: Shape) =>
  executeCommand(replica.store, createShapeCommand(shape));
const shapeOf = (replica: Replica, name: string) =>
  replica.store.getState().document.shapes.get(testShapeId(name));

describe('binding', () => {
  it('seeds a room with the drawing, and a joiner sees it', () => {
    const { all } = replicas(2, { document: documentFromShapes([rect('a'), rect('b', 200)]) });
    const [, joiner] = all;
    expect(joiner && snapshot(joiner)).toBe(all[0] && snapshot(all[0]));
    expect(joiner?.store.getState().document.order).toEqual(['a', 'b']);
  });

  it('sends every local change to the other clients', () => {
    const { all } = replicas(2);
    const [a, b] = all as [Replica, Replica];
    create(a, rect('r'));
    const before = shapeOf(a, 'r') as Shape;
    executeCommand(
      a.store,
      reshapeCommand(a.store.getState().document, 'Move', [before], [{ ...before, x: 40 }]),
    );
    expect(shapeOf(b, 'r')).toMatchObject({ x: 40 });
    executeCommand(
      a.store,
      deleteCommand(a.store.getState().document, 'Delete', [shapeOf(a, 'r') as Shape]),
    );
    expect(b.store.getState().document.order).toEqual([]);
  });

  it('merges concurrent inserts into one order on every client', () => {
    const net = replicas(3);
    const [a, b, c] = net.all as [Replica, Replica, Replica];
    net.partition();
    create(a, rect('from-a'));
    create(b, rect('from-b'));
    create(c, rect('from-c'));
    net.sync();
    expect(snapshot(b)).toBe(snapshot(a));
    expect(snapshot(c)).toBe(snapshot(a));
    expect(a.store.getState().document.order).toHaveLength(3);
    for (const replica of net.all)
      expect(invariantViolations(replica.store.getState())).toEqual([]);
  });

  it('keeps reordering local to the moved shapes', () => {
    const { all } = replicas(2, {
      document: documentFromShapes([rect('a'), rect('b'), rect('c')]),
      selectedIds: new Set([testShapeId('a')]),
    });
    const [a, b] = all as [Replica, Replica];
    const writes = vi.fn<(count: number) => void>();
    sharedShapes(a.doc).observe((event) => {
      writes(event.keysChanged.size);
    });
    arrangeSelection(a.store, 'front', vi.fn());
    expect(writes).toHaveBeenCalledWith(1);
    expect(b.store.getState().document.order).toEqual(['b', 'c', 'a']);
  });

  it('repairs an arrow attached to a shape someone else deleted, on every client', () => {
    const target = rect('target', 300);
    const net = replicas(2, { document: documentFromShapes([target]) });
    const [a, b] = net.all as [Replica, Replica];
    net.partition();
    executeCommand(
      a.store,
      deleteCommand(a.store.getState().document, 'Delete', [shapeOf(a, 'target') as Shape]),
    );
    const arrow = makeArrow({
      id: testShapeId('arrow'),
      x: 0,
      y: 25,
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      end: { shapeId: target.id, anchor: 'left' },
    });
    create(b, arrow);
    net.sync();
    for (const replica of [a, b]) {
      expect(invariantViolations(replica.store.getState())).toEqual([]);
      const merged = shapeOf(replica, 'arrow');
      expect(merged && 'end' in merged).toBe(false);
    }
    expect(snapshot(b)).toBe(snapshot(a));
  });

  it('skips a remote shape that fails validation, and says so once', () => {
    const store = createEditorStore();
    const doc = new Y.Doc();
    const reportError = vi.fn();
    bindDocument(store, doc, { seed: false, reportError });
    doc.transact(() => {
      sharedShapes(doc).set('evil', {
        key: 'V',
        shape: { id: 'evil', type: 'rectangle', x: Number.NaN },
      } as never);
      sharedShapes(doc).set('ok', {
        key: 'W',
        shape: { ...rect('ok'), zIndex: undefined },
      } as never);
    }, 'remote');
    expect(store.getState().document.order).toEqual(['ok']);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
