import { describe, expect, it, vi } from 'vitest';
import { reshapeCommand } from '../core/attachments';
import { createShapeCommand, executeCommand } from '../core/commands';
import { documentFromShapes } from '../core/persistence/fileFormat';
import { nudgeSelection } from '../core/selection/selectedShapes';
import type { Shape } from '../core/shapes';
import { makeRect, testShapeId } from '../core/testing/factories';
import { replicas, snapshot, type Replica } from './testing';

const rect = (name: string, x = 0) =>
  makeRect({ id: testShapeId(name), x, width: 100, height: 50 });
const ids = (replica: Replica) => replica.store.getState().document.order;
const shapeOf = (replica: Replica, name: string) =>
  replica.store.getState().document.shapes.get(testShapeId(name));

describe('shared undo', () => {
  it("undoes only this user's changes, everywhere, and redoes them", () => {
    const { all } = replicas(2);
    const [a, b] = all as [Replica, Replica];
    executeCommand(a.store, createShapeCommand(rect('mine')));
    executeCommand(b.store, createShapeCommand(rect('theirs', 200)));
    a.undo.undo();
    expect(ids(a)).toEqual(['theirs']);
    expect(ids(b)).toEqual(['theirs']);
    expect(a.store.getState().sharedUndo).toEqual({ canUndo: false, canRedo: true });
    a.undo.redo();
    expect([...ids(b)].sort()).toEqual(['mine', 'theirs']);
    expect(snapshot(a)).toBe(snapshot(b));
  });

  it("keeps a collaborator's later edit to the same shape when undoing an earlier one", () => {
    const { all } = replicas(2, { document: documentFromShapes([rect('shared')]) });
    const [a, b] = all as [Replica, Replica];
    executeCommand(a.store, createShapeCommand(rect('mine', 300)));
    const shared = shapeOf(b, 'shared') as Shape;
    const document = b.store.getState().document;
    executeCommand(b.store, reshapeCommand(document, 'Move', [shared], [{ ...shared, x: 50 }]));
    a.undo.undo();
    expect(shapeOf(a, 'mine')).toBeUndefined();
    expect(shapeOf(a, 'shared')).toMatchObject({ x: 50 });
  });

  it('restores the selection on either side of a step', () => {
    const { all } = replicas(1, { document: documentFromShapes([rect('r')]) });
    const [a] = all as [Replica];
    a.store.setState({ selectedIds: new Set([testShapeId('r')]) });
    executeCommand(a.store, createShapeCommand(rect('new', 200)), {
      select: new Set([testShapeId('new')]),
    });
    a.undo.undo();
    expect([...a.store.getState().selectedIds]).toEqual(['r']);
    a.undo.redo();
    expect([...a.store.getState().selectedIds]).toEqual(['new']);
  });

  it('undoes a held arrow key as one step, like the local history', () => {
    const { all } = replicas(1, { document: documentFromShapes([rect('r')]) });
    const [a] = all as [Replica];
    a.store.setState({ selectedIds: new Set([testShapeId('r')]) });
    nudgeSelection(a.store, 1, 0, vi.fn());
    nudgeSelection(a.store, 1, 0, vi.fn(), true);
    nudgeSelection(a.store, 1, 0, vi.fn(), true);
    nudgeSelection(a.store, 0, 5, vi.fn());
    a.undo.undo();
    expect(shapeOf(a, 'r')).toMatchObject({ x: 3, y: 0 });
    a.undo.undo();
    expect(shapeOf(a, 'r')).toMatchObject({ x: 0, y: 0 });
    expect(a.store.getState().sharedUndo?.canUndo).toBe(false);
  });
});
