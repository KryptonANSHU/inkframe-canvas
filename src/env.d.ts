/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The collaboration relay's WebSocket URL (wss://…); defaults to a local relay in dev. */
  readonly VITE_COLLAB_URL?: string;
}
