import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import type { CollabStatus } from '../core/collabState';
import { EMPTY_DOCUMENT } from '../core/document';
import type { SharedHistory } from '../core/editActions';
import { EMPTY_HISTORY } from '../core/history';
import { EMPTY_SELECTION, type EditorStore } from '../core/store';
import { bindDocument } from './binding';
import { loadIdentity } from './identity';
import { bindPresence, type PresenceSource } from './presence';
import { createSharedUndo } from './sharedUndo';

/** What a session needs from the editor (core/dom/createEditor's Editor fits). */
export type CollabEditor = {
  readonly store: EditorStore;
  readonly setSharedHistory: (history: SharedHistory | null) => void;
  readonly saveNow: () => Promise<void>;
  readonly reloadDrawing: () => Promise<void>;
  readonly reportError: (error: Error) => void;
  readonly onPointerMove: PresenceSource['onPointerMove'];
};

export type SessionOptions = {
  /** The relay, e.g. wss://inkframe-relay.onrender.com. */
  readonly url: string;
  readonly room: string;
  /** True for a new room: the current drawing becomes the room's. */
  readonly seed: boolean;
};

export type CollabSession = {
  /** Leaves the room and brings this device's own drawing back. */
  leave(): Promise<void>;
};

/** Reconnect attempts back off up to this, so a returning network is noticed quickly. */
const MAX_BACKOFF_MS = 2500;

/**
 * Joins a shared room: binds the drawing to a Yjs document synced through the relay,
 * routes undo to per-user history, and keeps `store.collab` current. Autosave pauses
 * while in the room (see persistence/autosave), so this device's drawing is untouched.
 */
export async function joinRoom(
  editor: CollabEditor,
  options: SessionOptions,
): Promise<CollabSession> {
  const { store } = editor;
  await editor.saveNow();
  const self = loadIdentity();
  store.setState({
    collab: { room: options.room, status: 'connecting', peers: [], self },
    history: EMPTY_HISTORY,
  });

  const doc = new Y.Doc();
  const undo = createSharedUndo(store, doc);
  const binding = bindDocument(store, doc, {
    seed: options.seed,
    reportError: editor.reportError,
    onLocalEdit: undo.onLocalEdit,
  });
  editor.setSharedHistory(undo);
  const provider = new WebsocketProvider(options.url, options.room, doc, {
    maxBackoffTime: MAX_BACKOFF_MS,
  });

  let connected = false;
  let everConnected = false;
  const publishStatus = () => {
    const collab = store.getState().collab;
    if (collab === null) return;
    const status: CollabStatus = !navigator.onLine
      ? 'offline'
      : connected
        ? 'connected'
        : everConnected
          ? 'reconnecting'
          : 'connecting';
    if (status !== collab.status) store.setState({ collab: { ...collab, status } });
  };
  provider.on('status', ({ status }: { status: string }) => {
    connected = status === 'connected';
    everConnected ||= connected;
    publishStatus();
  });
  window.addEventListener('online', publishStatus);
  window.addEventListener('offline', publishStatus);
  const unbindPresence = bindPresence(editor, provider.awareness, self);

  return {
    async leave() {
      window.removeEventListener('online', publishStatus);
      window.removeEventListener('offline', publishStatus);
      unbindPresence();
      provider.destroy();
      binding.dispose();
      undo.dispose();
      doc.destroy();
      editor.setSharedHistory(null);
      store.setState({
        collab: null,
        document: EMPTY_DOCUMENT,
        selectedIds: EMPTY_SELECTION,
        history: EMPTY_HISTORY,
      });
      await editor.reloadDrawing();
    },
  };
}
