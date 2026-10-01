import { assertNever } from './assertNever';
import { DEFAULT_CAMERA, fitBounds, MAX_ZOOM, MIN_ZOOM, zoomAt } from './camera';
import { exportBounds } from './export/exportArea';
import type { Shape } from './shapes';
import type { EditorStore } from './store';

export type ZoomAction = 'in' | 'out' | 'reset' | 'fit';

/** Zoom buttons and keys step through these, like a design tool's zoom menu. */
export const ZOOM_LEVELS = [MIN_ZOOM, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, MAX_ZOOM] as const;
/** Screen pixels kept clear around the drawing when zooming to fit. */
const FIT_PADDING_PX = 64;
/** Tolerance so a zoom of 0.9999999 counts as being on the 100% step. */
const EPSILON = 1e-6;

/** The next zoom level above (or below) `zoom`. */
export function steppedZoom(zoom: number, direction: 1 | -1): number {
  const levels = direction === 1 ? ZOOM_LEVELS : [...ZOOM_LEVELS].reverse();
  const next = levels.find((level) =>
    direction === 1 ? level > zoom + EPSILON : level < zoom - EPSILON,
  );
  return next ?? zoom;
}

/**
 * Zooms around the middle of a `width` × `height` view (CSS pixels), or fits every
 * shape in it. Fitting an empty canvas goes back to the origin at 100%.
 */
export function zoomView(
  store: EditorStore,
  action: ZoomAction,
  width: number,
  height: number,
): void {
  const { camera, document } = store.getState();
  const center = { x: width / 2, y: height / 2 };
  const to = (zoom: number) => zoomAt(camera, center, zoom / camera.zoom);
  switch (action) {
    case 'in':
      store.setState({ camera: to(steppedZoom(camera.zoom, 1)) });
      return;
    case 'out':
      store.setState({ camera: to(steppedZoom(camera.zoom, -1)) });
      return;
    case 'reset':
      store.setState({ camera: to(1) });
      return;
    case 'fit': {
      const shapes = document.order.flatMap((id): Shape[] => {
        const shape = document.shapes.get(id);
        return shape === undefined ? [] : [shape];
      });
      const area = exportBounds(shapes);
      store.setState({
        camera: area === null ? DEFAULT_CAMERA : fitBounds(area, width, height, FIT_PADDING_PX),
      });
      return;
    }
    default:
      assertNever(action);
  }
}
