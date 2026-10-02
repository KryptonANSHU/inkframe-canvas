import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { arrangeSelection } from '../core/arrange';
import { anchorPoint, deleteCommand, reshapeCommand } from '../core/attachments';
import { createShapeCommand, executeCommand } from '../core/commands';
import { groupSelection } from '../core/groups';
import { invariantViolations } from '../core/invariants';
import type { Shape, ShapeId } from '../core/shapes';
import { makeArrow, makeRect, testShapeId } from '../core/testing/factories';
import { replicas, snapshot, type Replica } from './testing';

/** One user action on one client, or a network event. */
type Step =
  | { readonly kind: 'rect'; readonly on: number; readonly x: number }
  | { readonly kind: 'arrow'; readonly on: number; readonly pick: number }
  | { readonly kind: 'move'; readonly on: number; readonly pick: number; readonly dx: number }
  | { readonly kind: 'delete'; readonly on: number; readonly pick: number }
  | { readonly kind: 'front'; readonly on: number; readonly pick: number }
  | { readonly kind: 'group'; readonly on: number; readonly picks: readonly [number, number] }
  | { readonly kind: 'partition' }
  | { readonly kind: 'sync' };

const on = fc.integer({ min: 0, max: 2 });
const pick = fc.nat();
const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ kind: fc.constant('rect'), on, x: fc.integer({ min: -500, max: 500 }) }),
  fc.record({ kind: fc.constant('arrow'), on, pick }),
  fc.record({ kind: fc.constant('move'), on, pick, dx: fc.integer({ min: -50, max: 50 }) }),
  fc.record({ kind: fc.constant('delete'), on, pick }),
  fc.record({ kind: fc.constant('front'), on, pick }),
  fc.record({ kind: fc.constant('group'), on, picks: fc.tuple(pick, pick) }),
  fc.record({ kind: fc.constant('partition') }),
  fc.record({ kind: fc.constant('sync') }),
);

let created = 0;

function nth(replica: Replica, index: number): Shape | undefined {
  const { order, shapes } = replica.store.getState().document;
  const id = order.length === 0 ? undefined : order[index % order.length];
  return id === undefined ? undefined : shapes.get(id);
}

function run(replica: Replica, s: Exclude<Step, { kind: 'partition' | 'sync' }>): void {
  const { store } = replica;
  const document = () => store.getState().document;
  const target = 'pick' in s ? nth(replica, s.pick) : undefined;
  switch (s.kind) {
    case 'rect':
      executeCommand(
        store,
        createShapeCommand(makeRect({ id: testShapeId(`r${String(created++)}`), x: s.x })),
      );
      return;
    case 'arrow': {
      if (target?.type !== 'rectangle') return;
      const from = anchorPoint(target, 'right');
      const arrow = makeArrow({
        id: testShapeId(`a${String(created++)}`),
        x: from.x,
        y: from.y,
        rotation: 0,
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
        ],
        start: { shapeId: target.id, anchor: 'right' },
      });
      executeCommand(store, createShapeCommand(arrow));
      return;
    }
    case 'move':
      if (target === undefined) return;
      executeCommand(
        store,
        reshapeCommand(document(), 'Move', [target], [{ ...target, x: target.x + s.dx }]),
      );
      return;
    case 'delete':
      if (target === undefined) return;
      // As the Delete action does: the deleted shape leaves the selection.
      executeCommand(store, deleteCommand(document(), 'Delete', [target]), {
        select: new Set([...store.getState().selectedIds].filter((id) => id !== target.id)),
      });
      return;
    case 'front':
      if (target === undefined) return;
      store.setState({ selectedIds: new Set([target.id]) });
      arrangeSelection(store, 'front', vi.fn());
      return;
    case 'group': {
      const picked = s.picks
        .map((p) => nth(replica, p)?.id)
        .filter((id): id is ShapeId => id !== undefined);
      store.setState({ selectedIds: new Set(picked) });
      groupSelection(store, vi.fn());
      return;
    }
  }
}

describe('collaboration (property)', () => {
  it('replicas editing concurrently converge to one valid drawing', () => {
    fc.assert(
      fc.property(fc.array(step, { minLength: 1, maxLength: 40 }), (steps) => {
        const net = replicas(3);
        for (const s of steps) {
          if (s.kind === 'partition') net.partition();
          else if (s.kind === 'sync') net.sync();
          else {
            const replica = net.all[s.on];
            if (replica !== undefined) run(replica, s);
          }
        }
        net.sync();
        const [first, ...rest] = net.all.map(snapshot);
        for (const other of rest) expect(other).toBe(first);
        for (const replica of net.all) {
          expect(invariantViolations(replica.store.getState())).toEqual([]);
        }
      }),
      { numRuns: 150 },
    );
  });
});
