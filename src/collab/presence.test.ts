import { describe, expect, it } from 'vitest';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';
import { createEditorStore } from '../core/store';
import { testShapeId } from '../core/testing/factories';
import { peerColors } from '../design/tokens';
import { bindPresence } from './presence';

const [first = '', second = ''] = peerColors;

/** This client, bound to a store, and a raw "remote" awareness to send from. */
function setup() {
  const self = { name: 'Lucky fox', color: first };
  const store = createEditorStore({
    collab: { room: 'room-1', status: 'connected', peers: [], self },
  });
  const local = new awarenessProtocol.Awareness(new Y.Doc());
  bindPresence({ store, onPointerMove: () => () => undefined }, local, self);
  const remote = new awarenessProtocol.Awareness(new Y.Doc());
  const send = () => {
    const update = awarenessProtocol.encodeAwarenessUpdate(remote, [remote.clientID]);
    awarenessProtocol.applyAwarenessUpdate(local, update, 'relay');
  };
  return { store, local, remote, send };
}

describe('presence', () => {
  it('shows valid collaborators as peers', () => {
    const { store, remote, send } = setup();
    remote.setLocalState({
      user: { name: 'Quiet otter', color: second },
      cursor: { x: 10, y: 20 },
      selection: ['a'],
    });
    send();
    expect(store.getState().collab?.peers).toEqual([
      expect.objectContaining({ name: 'Quiet otter', cursor: { x: 10, y: 20 }, selection: ['a'] }),
    ]);
  });

  it('ignores presence that is not plain, bounded data', () => {
    const { store, remote, send } = setup();
    remote.setLocalState({
      user: { name: 'x'.repeat(500), color: 'url(javascript:alert(1))' },
      cursor: null,
      selection: [],
    });
    send();
    expect(store.getState().collab?.peers).toEqual([]);
  });

  it('publishes the selection, and switches color when an earlier peer has it', () => {
    const { store, local, remote, send } = setup();
    store.setState({ selectedIds: new Set([testShapeId('r')]) });
    expect(local.getLocalState()).toMatchObject({ selection: ['r'] });
    remote.setLocalState({ user: { name: 'Twin', color: first }, cursor: null, selection: [] });
    send();
    const self = store.getState().collab?.self;
    // Only the later joiner (higher client ID) switches.
    if (remote.clientID < local.clientID) expect(self?.color).not.toBe(first);
    else expect(self?.color).toBe(first);
  });
});
