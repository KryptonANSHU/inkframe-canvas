import type { Camera } from './camera';
import type { RenderContext, Viewport } from './renderer';
import type { CanvasTheme } from './theme';

/** World units between grid lines at 100%. Snap to grid will use the same. */
export const GRID_SIZE = 20;
/** Every fifth line is stronger, so distances can be counted at a glance. */
const MAJOR_EVERY = 5;
/** Lines closer than this on screen merge into fives, so the grid never turns to noise. */
const MIN_SPACING_PX = 8;

/**
 * Draws the grid behind the shapes, in device pixels so every line is one crisp pixel
 * at any zoom and DPR. Spacing grows by fives as you zoom out.
 */
export function drawGrid(
  context: RenderContext,
  camera: Camera,
  viewport: Viewport,
  theme: CanvasTheme,
): void {
  const { pixelWidth, pixelHeight, devicePixelRatio: dpr } = viewport;
  let spacing = GRID_SIZE;
  while (spacing * camera.zoom < MIN_SPACING_PX) {
    spacing *= MAJOR_EVERY;
  }
  const scale = camera.zoom * dpr;
  const lineWidth = Math.max(1, Math.round(dpr));
  // Odd widths sit on pixel centers to stay sharp.
  const offset = lineWidth % 2 === 1 ? 0.5 : 0;
  const minor: number[][] = [[], []];
  const major: number[][] = [[], []];
  const axes = [
    { from: camera.x, length: pixelWidth },
    { from: camera.y, length: pixelHeight },
  ] as const;
  axes.forEach(({ from, length }, axis) => {
    const first = Math.ceil(from / spacing);
    const last = Math.floor((from + length / scale) / spacing);
    for (let n = first; n <= last; n++) {
      const device = Math.round((n * spacing - from) * scale - offset) + offset;
      (n % MAJOR_EVERY === 0 ? major : minor)[axis]?.push(device);
    }
  });

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.lineWidth = lineWidth;
  strokeLines(context, minor, pixelWidth, pixelHeight, theme.gridMinor);
  strokeLines(context, major, pixelWidth, pixelHeight, theme.gridMajor);
}

/** One path per weight: [vertical x positions, horizontal y positions]. */
function strokeLines(
  context: RenderContext,
  [xs = [], ys = []]: number[][],
  width: number,
  height: number,
  color: string,
): void {
  context.beginPath();
  for (const x of xs) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (const y of ys) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.strokeStyle = color;
  context.stroke();
}
