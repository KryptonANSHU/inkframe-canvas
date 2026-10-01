import { panBy, zoomAt, type Camera } from '../camera';
import { distance, type Point } from '../geometry/point';

/** Two touch points in screen space. */
export type TouchPair = readonly [Readonly<Point>, Readonly<Point>];

/**
 * The camera after two fingers moved from `start` to `now`. The world point that was
 * between them stays between them, and zoom follows the change in their distance, so
 * the content feels held by both fingers. Always computed from the start of the pinch,
 * so small errors never build up over a long gesture.
 */
export function pinchCamera(startCamera: Camera, start: TouchPair, now: TouchPair): Camera {
  const startMid = midpoint(start);
  const mid = midpoint(now);
  // zoomAt ignores a non-finite factor, which covers two fingers starting on one point.
  const zoomed = zoomAt(startCamera, startMid, distance(...now) / distance(...start));
  return panBy(zoomed, mid.x - startMid.x, mid.y - startMid.y);
}

function midpoint([a, b]: TouchPair): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** What a new finger means: the first one gestures, the second one starts a pinch. */
export type FingerRole = 'first' | 'second' | 'extra';

/**
 * Tracks fingers on the canvas. One finger is an ordinary gesture; a second finger
 * turns the pair into a pinch (pan and zoom) until either of them lifts. More fingers
 * are ignored.
 */
export type TouchTracker = {
  pinching(): boolean;
  down(pointerId: number, screen: Readonly<Point>, camera: Camera): FingerRole;
  /** The camera for this move while pinching, otherwise null. */
  move(pointerId: number, screen: Readonly<Point>): Camera | null;
  /** True when the finger belonged to a pinch, so it must not reach a tool. */
  up(pointerId: number): boolean;
  reset(): void;
};

type Pinch = {
  readonly ids: readonly [number, number];
  readonly start: TouchPair;
  readonly camera: Camera;
};

export function createTouchTracker(): TouchTracker {
  const fingers = new Map<number, Point>();
  let pinch: Pinch | null = null;

  return {
    pinching: () => pinch !== null,

    down(pointerId, screen, camera) {
      const [other] = fingers;
      if (pinch !== null || fingers.size >= 2) {
        return 'extra';
      }
      fingers.set(pointerId, { ...screen });
      if (other === undefined) {
        return 'first';
      }
      const [otherId, otherAt] = other;
      pinch = { ids: [otherId, pointerId], start: [{ ...otherAt }, { ...screen }], camera };
      return 'second';
    },

    move(pointerId, screen) {
      const finger = fingers.get(pointerId);
      if (finger !== undefined) {
        finger.x = screen.x;
        finger.y = screen.y;
      }
      const a = pinch === null ? undefined : fingers.get(pinch.ids[0]);
      const b = pinch === null ? undefined : fingers.get(pinch.ids[1]);
      return pinch === null || a === undefined || b === undefined
        ? null
        : pinchCamera(pinch.camera, pinch.start, [a, b]);
    },

    up(pointerId) {
      fingers.delete(pointerId);
      if (pinch === null) {
        return false;
      }
      if (pinch.ids.includes(pointerId)) {
        pinch = null;
      }
      return true;
    },

    reset() {
      fingers.clear();
      pinch = null;
    },
  };
}
