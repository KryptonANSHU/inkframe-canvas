import { panBy, zoomAt, type Camera } from '../camera';
import type { Point } from '../geometry/point';

export type WheelInput = {
  readonly deltaX: number;
  readonly deltaY: number;
  /** WheelEvent.deltaMode: 0 = pixels, 1 = lines, 2 = pages. */
  readonly deltaMode: number;
  /** Set for Ctrl + wheel and for trackpad pinch, which browsers report the same way. */
  readonly ctrlKey: boolean;
  /** CSS height of the canvas, used for deltas measured in pages. */
  readonly pageHeight: number;
};

const LINE_HEIGHT_PX = 16;
/** Zoom change per pixel of wheel delta: 1% per pixel, compounded. */
const ZOOM_PER_PIXEL = 0.01;
/**
 * A mouse wheel notch is about 100px; a pinch step is a few px. Capping the delta
 * keeps one notch at ~10% zoom while leaving pinch smooth and proportional.
 */
const MAX_ZOOM_DELTA_PX = 10;

export function wheelDeltaToPixels(delta: number, deltaMode: number, pageHeight: number): number {
  switch (deltaMode) {
    case 1:
      return delta * LINE_HEIGHT_PX;
    case 2:
      return delta * pageHeight;
    default:
      return delta;
  }
}

/** Ctrl + wheel (or pinch) zooms around the cursor; a plain wheel or two-finger scroll pans. */
export function applyWheel(camera: Camera, wheel: WheelInput, anchor: Readonly<Point>): Camera {
  const dx = wheelDeltaToPixels(wheel.deltaX, wheel.deltaMode, wheel.pageHeight);
  const dy = wheelDeltaToPixels(wheel.deltaY, wheel.deltaMode, wheel.pageHeight);
  if (wheel.ctrlKey) {
    const capped = Math.max(-MAX_ZOOM_DELTA_PX, Math.min(MAX_ZOOM_DELTA_PX, dy));
    return zoomAt(camera, anchor, Math.exp(-capped * ZOOM_PER_PIXEL));
  }
  return panBy(camera, -dx, -dy);
}
