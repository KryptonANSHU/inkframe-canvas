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
 * Prefers the browser's exact device-pixel size, which avoids rounding blur at
 * fractional DPRs, but only when it agrees with CSS size × DPR to within rounding.
 * The renderer scales by devicePixelRatio, so the backing store must match it; some
 * environments (Chromium's emulated device scale factor) report CSS pixels here.
 */
export function chooseBackingStoreSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  exact: BackingStoreSize | undefined,
): BackingStoreSize {
  const rounded = toBackingStoreSize(cssWidth, cssHeight, devicePixelRatio);
  const agrees =
    exact !== undefined &&
    Math.abs(exact.width - rounded.width) <= 1 &&
    Math.abs(exact.height - rounded.height) <= 1;
  return agrees ? exact : rounded;
}

/**
 * A media query that stops matching when devicePixelRatio changes
 * (e.g. the window moves to another monitor). Re-create it after each change.
 */
export function devicePixelRatioQuery(devicePixelRatio: number): string {
  return `(resolution: ${String(devicePixelRatio)}dppx)`;
}
