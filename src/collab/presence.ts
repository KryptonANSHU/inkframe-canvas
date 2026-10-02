import type { Awareness } from 'y-protocols/awareness';
import { z } from 'zod';
import type { Peer } from '../core/collabState';
import type { Point } from '../core/geometry/point';
import type { ShapeId } from '../core/shapes';
import type { EditorStore } from '../core/store';
import { peerColors } from '../design/tokens';
import type { Identity } from './identity';

/** Cursor updates at most this often: smooth enough to follow, light on the relay. */
const CURSOR_INTERVAL_MS = 50;
/** Presence carries a selection, never the scene: a long selection is cut off. */
const MAX_SELECTION = 500;

/** What another client's presence must look like; anything else is ignored. */
const presenceSchema = z.object({
  user: z.object({
    name: z.string().min(1).max(40),
    color: z.enum(peerColors as [string, ...string[]]),
  }),
  cursor: z.object({ x: z.number(), y: z.number() }).nullable(),
  selection: z.array(z.string().max(200)).max(MAX_SELECTION),
});

export type PresenceSource = {
  readonly store: EditorStore;
  readonly onPointerMove: (listener: (world: Readonly<Point> | null) => void) => () => void;
};

/**
 * Presence through Yjs awareness: this user's name, color, cursor (world units) and
 * selection go out; everyone else's come in, validated, as `store.collab.peers`.
 * Awareness carries nothing else: shapes travel only through the shared document.
 */
export function bindPresence(
  source: PresenceSource,
  awareness: Awareness,
  self: Identity,
): () => void {
  const { store } = source;
  awareness.setLocalState({ user: self, cursor: null, selection: [] });

  let pending: Readonly<Point> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const sendCursor = () => {
    timer = null;
    awareness.setLocalStateField(
      'cursor',
      pending === null ? null : { x: pending.x, y: pending.y },
    );
  };
  const stopPointer = source.onPointerMove((world) => {
    pending = world === null ? null : { x: world.x, y: world.y };
    // Leaving the canvas is sent at once; moves at most every CURSOR_INTERVAL_MS.
    if (world === null) sendCursor();
    else timer ??= setTimeout(sendCursor, CURSOR_INTERVAL_MS);
  });

  const stopSelection = store.subscribe((state, previous) => {
    if (state.selectedIds !== previous.selectedIds) {
      awareness.setLocalStateField('selection', [...state.selectedIds].slice(0, MAX_SELECTION));
    }
  });

  const onChange = () => {
    const collab = store.getState().collab;
    if (collab === null) return;
    const peers: Peer[] = [];
    for (const [id, state] of awareness.getStates()) {
      if (id === awareness.clientID) continue;
      const parsed = presenceSchema.safeParse(state);
      if (!parsed.success) continue;
      const { user, cursor, selection } = parsed.data;
      peers.push({
        id,
        name: user.name,
        color: user.color,
        cursor,
        selection: selection as ShapeId[],
      });
    }
    peers.sort((a, b) => a.id - b.id);
    // Two people in one color can't be told apart: whoever joined later switches.
    const self = collab.self;
    const clash = peers.some((peer) => peer.color === self.color && peer.id < awareness.clientID);
    const free = peerColors.find((color) => !peers.some((peer) => peer.color === color));
    const next = clash && free !== undefined ? { ...self, color: free } : self;
    if (next !== self) awareness.setLocalStateField('user', next);
    store.setState({ collab: { ...collab, peers, self: next } });
  };
  awareness.on('change', onChange);

  return () => {
    stopPointer();
    stopSelection();
    if (timer !== null) clearTimeout(timer);
    awareness.off('change', onChange);
    awareness.setLocalState(null);
  };
}
