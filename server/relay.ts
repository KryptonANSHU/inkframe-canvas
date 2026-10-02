/**
 * Inkframe's collaboration relay: the y-websocket protocol over plain WebSockets. Each
 * room's Yjs document and presence live in memory while anyone is in the room (and
 * for a grace period after), and every update is passed on to the room's other
 * clients. No database, no accounts, no business logic: clients validate everything
 * they receive. Run with `npm run relay` (Node runs this TypeScript file directly).
 */
import { createServer } from 'node:http';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocketServer, type WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const PORT = Number(process.env['PORT'] ?? 1234);
/** y-websocket message types. */
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
/** Matches the app's import limit, so a full 20 MB drawing can sync. */
const MAX_MESSAGE_BYTES = 20 * 1024 * 1024;
const MAX_ROOMS = 500;
const MAX_CLIENTS_PER_ROOM = 50;
/** An empty room is kept this long, so a reload or a brief drop doesn't lose it. */
const EMPTY_ROOM_GRACE_MS = 10 * 60 * 1000;
const PING_INTERVAL_MS = 30_000;
const ROOM_NAME = /^[A-Za-z0-9_-]{6,64}$/;

type Room = {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  /** Each connection, with the presence client IDs it controls. */
  readonly clients: Map<WebSocket, Set<number>>;
  expiry: ReturnType<typeof setTimeout> | null;
};

const rooms = new Map<string, Room>();

function roomFor(name: string): Room | null {
  const existing = rooms.get(name);
  if (existing !== undefined) return existing;
  if (rooms.size >= MAX_ROOMS) return null;
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);
  const room: Room = { doc, awareness, clients: new Map(), expiry: null };
  doc.on('update', (update: Uint8Array) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    broadcast(room, encoding.toUint8Array(encoder));
  });
  awareness.on(
    'update',
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      const controlled = room.clients.get(origin as WebSocket);
      if (controlled !== undefined) {
        for (const id of added) controlled.add(id);
        for (const id of removed) controlled.delete(id);
      }
      const changed = [...added, ...updated, ...removed];
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
      );
      broadcast(room, encoding.toUint8Array(encoder));
    },
  );
  rooms.set(name, room);
  return room;
}

function broadcast(room: Room, message: Uint8Array): void {
  for (const client of room.clients.keys()) send(client, message);
}

function send(client: WebSocket, message: Uint8Array): void {
  if (client.readyState === client.OPEN) client.send(message);
}

function onMessage(room: Room, client: WebSocket, data: Uint8Array): void {
  const decoder = decoding.createDecoder(data);
  const type = decoding.readVarUint(decoder);
  if (type === MESSAGE_SYNC) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(decoder, encoder, room.doc, client);
    // Only replies (sync step 2) have content past the type byte.
    if (encoding.length(encoder) > 1) send(client, encoding.toUint8Array(encoder));
  } else if (type === MESSAGE_AWARENESS) {
    awarenessProtocol.applyAwarenessUpdate(
      room.awareness,
      decoding.readVarUint8Array(decoder),
      client,
    );
  }
}

function join(name: string, room: Room, client: WebSocket): void {
  if (room.expiry !== null) clearTimeout(room.expiry);
  room.expiry = null;
  room.clients.set(client, new Set());
  client.on('message', (data: Buffer) => {
    try {
      onMessage(room, client, new Uint8Array(data));
    } catch {
      // A malformed message: drop the client rather than the room.
      client.close(1003, 'Malformed message');
    }
  });
  client.on('close', () => {
    const controlled = room.clients.get(client);
    room.clients.delete(client);
    if (controlled !== undefined && controlled.size > 0) {
      awarenessProtocol.removeAwarenessStates(room.awareness, [...controlled], null);
    }
    if (room.clients.size === 0) {
      room.expiry = setTimeout(() => {
        rooms.delete(name);
        room.doc.destroy();
      }, EMPTY_ROOM_GRACE_MS);
    }
  });
  // Start syncing: the client answers with what we lack and asks for what it lacks.
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, room.doc);
  send(client, encoding.toUint8Array(encoder));
  const present = [...room.awareness.getStates().keys()];
  if (present.length > 0) {
    const update = encoding.createEncoder();
    encoding.writeVarUint(update, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      update,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, present),
    );
    send(client, encoding.toUint8Array(update));
  }
}

// Plain HTTP answers health checks (Render pings "/").
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' }).end('Inkframe relay\n');
});
const sockets = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });
const alive = new WeakSet<WebSocket>();

sockets.on('connection', (client, request) => {
  const name = decodeURIComponent((request.url ?? '/').slice(1).split('?')[0] ?? '');
  const room = ROOM_NAME.test(name) ? roomFor(name) : null;
  if (room === null) {
    client.close(1008, ROOM_NAME.test(name) ? 'Too many rooms' : 'Invalid room name');
    return;
  }
  if (room.clients.size >= MAX_CLIENTS_PER_ROOM) {
    client.close(1013, 'Room is full');
    return;
  }
  alive.add(client);
  client.on('pong', () => alive.add(client));
  join(name, room, client);
});

// Drops connections that stopped answering (a closed laptop lid, a dead network).
const heartbeat = setInterval(() => {
  for (const client of sockets.clients) {
    if (!alive.has(client)) {
      client.terminate();
      continue;
    }
    alive.delete(client);
    client.ping();
  }
}, PING_INTERVAL_MS);

sockets.on('close', () => {
  clearInterval(heartbeat);
});

server.listen(PORT, () => {
  process.stdout.write(`Inkframe relay listening on port ${String(PORT)}\n`);
});
