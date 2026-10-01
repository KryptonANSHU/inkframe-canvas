import type { Point } from '../geometry/point';
import type { Viewport } from '../renderer';
import { chooseBackingStoreSize, devicePixelRatioQuery, toBackingStoreSize } from '../viewport';

export type CanvasSurface = {
  readonly viewport: () => Viewport;
  /** CSS height of the canvas, for wheel deltas measured in pages. */
  readonly cssHeight: () => number;
  /** Client (viewport) coordinates → screen space, using the rect cached on resize. */
  readonly toScreen: (clientX: number, clientY: number, out: Point) => Point;
  readonly dispose: () => void;
};

/**
 * Keeps the canvas backing store at CSS size × devicePixelRatio, re-measuring on
 * resize and when the DPR changes (e.g. moving the window to another monitor).
 */
export function observeCanvasSurface(
  canvas: HTMLCanvasElement,
  onChange: () => void,
): CanvasSurface {
  let viewport: Viewport = { pixelWidth: 0, pixelHeight: 0, devicePixelRatio: 1 };
  let cssRect = { left: 0, top: 0, width: 0, height: 0 };
  let hasExactPixelSize = false;

  const applyPixelSize = (pixelWidth: number, pixelHeight: number) => {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    viewport = { pixelWidth, pixelHeight, devicePixelRatio: window.devicePixelRatio };
    onChange();
  };

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry === undefined) {
      return;
    }
    // Layout is already up to date inside a ResizeObserver callback, so this read is free.
    const rect = canvas.getBoundingClientRect();
    cssRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    // Safari doesn't report device-pixel sizes; chooseBackingStoreSize then rounds CSS size × DPR.
    const reported =
      'devicePixelContentBoxSize' in entry ? entry.devicePixelContentBoxSize[0] : undefined;
    const exact =
      reported === undefined
        ? undefined
        : { width: reported.inlineSize, height: reported.blockSize };
    const size = chooseBackingStoreSize(rect.width, rect.height, window.devicePixelRatio, exact);
    hasExactPixelSize = size === exact;
    applyPixelSize(size.width, size.height);
  });
  observeDevicePixels(resizeObserver, canvas);

  const stopWatchingDpr = watchDevicePixelRatio(() => {
    if (hasExactPixelSize) {
      // The ResizeObserver also fires with the exact new size; only the scale changes here.
      viewport = { ...viewport, devicePixelRatio: window.devicePixelRatio };
      onChange();
      return;
    }
    const size = toBackingStoreSize(cssRect.width, cssRect.height, window.devicePixelRatio);
    applyPixelSize(size.width, size.height);
  });

  return {
    viewport: () => viewport,
    cssHeight: () => cssRect.height,
    toScreen: (clientX, clientY, out) => {
      out.x = clientX - cssRect.left;
      out.y = clientY - cssRect.top;
      return out;
    },
    dispose: () => {
      resizeObserver.disconnect();
      stopWatchingDpr();
    },
  };
}

function observeDevicePixels(observer: ResizeObserver, canvas: HTMLCanvasElement): void {
  try {
    // Fires when the device-pixel size changes too, including DPR changes.
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch (error) {
    // Browsers without this box option throw; the content box plus the DPR watcher covers them.
    if (!(error instanceof TypeError)) {
      throw error;
    }
    observer.observe(canvas, { box: 'content-box' });
  }
}

/** Calls `onChange` whenever devicePixelRatio changes. Returns a function that stops watching. */
function watchDevicePixelRatio(onChange: () => void): () => void {
  let query: MediaQueryList | null = null;

  const handleChange = () => {
    listen();
    onChange();
  };
  // A resolution query matches only the current DPR, so re-create it after every change.
  const listen = () => {
    query?.removeEventListener('change', handleChange);
    query = window.matchMedia(devicePixelRatioQuery(window.devicePixelRatio));
    query.addEventListener('change', handleChange);
  };

  listen();
  return () => {
    query?.removeEventListener('change', handleChange);
  };
}
