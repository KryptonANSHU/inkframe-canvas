import type { Point } from './geometry/point';
import type { ShapeId } from './shapes';

/** How the connection to a shared room is doing, as the status badge says it. */
export type CollabStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** Someone else in the room, as their presence says: plain data, never the scene. */
export type Peer = {
  /** Their Yjs client ID: stable for the session, unique in the room. */
  readonly id: number;
  readonly name: string;
  /** A CSS color from the peer palette. */
  readonly color: string;
  /** Their pointer in world units, or null when it is off the canvas. */
  readonly cursor: Readonly<Point> | null;
  readonly selection: readonly ShapeId[];
};

/** A shared room, while in one. */
export type CollabState = {
  readonly room: string;
  readonly status: CollabStatus;
  readonly peers: readonly Peer[];
  /** This user, as others see them. */
  readonly self: { readonly name: string; readonly color: string };
};
