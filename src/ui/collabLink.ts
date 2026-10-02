/** Room names the relay accepts (see server/relay.ts). */
const ROOM_NAME = /^[A-Za-z0-9_-]{6,64}$/;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** The relay, from the build's environment; in dev, a relay on this machine. */
export const RELAY_URL: string | null =
  import.meta.env.VITE_COLLAB_URL ?? (import.meta.env.DEV ? 'ws://localhost:1234' : null);

/** A new room's name: 12 random characters, unguessable enough for a share link. */
export function newRoomName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((byte) => ALPHABET.charAt(byte % ALPHABET.length)).join('');
}

/** The room in this page's link (?room=…), if it's a valid one. */
export function roomInLink(): string | null {
  const room = new URLSearchParams(location.search).get('room');
  return room !== null && ROOM_NAME.test(room) ? room : null;
}

/** The share link for a room, and puts it in the address bar (or takes it out). */
export function setRoomInLink(room: string | null): string {
  const url = new URL(location.href);
  if (room === null) url.searchParams.delete('room');
  else url.searchParams.set('room', room);
  history.replaceState(null, '', url);
  return url.href;
}
