export type BackingStoreSize = { readonly width: number; readonly height: number };

/**
 * Backing-store size in device pixels for a canvas of the given CSS size.
 * Prefer the browser's exact `devicePixelContentBoxSize` when it is available;
 * this is the fallback for browsers that don't report it.
 */
export function toBackingStoreSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): BackingStoreSize {
  return {
    width: Math.round(cssWidth * devicePixelRatio),
    height: Math.round(cssHeight * devicePixelRatio),
  };
}

/**
 * A media query that stops matching when devicePixelRatio changes
 * (e.g. the window moves to another monitor). Re-create it after each change.
 */
export function devicePixelRatioQuery(devicePixelRatio: number): string {
  return `(resolution: ${String(devicePixelRatio)}dppx)`;
}
