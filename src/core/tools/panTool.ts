import { panBy } from '../camera';
import { createPoint } from '../geometry/point';
import type { EditorStore } from '../store';
import type { Tool, ToolPointerEvent } from './tool';

/** Drags the view (space + drag). Changes only the camera, never the document. */
export function createPanTool(store: EditorStore): Tool {
  let dragging = false;
  const last = createPoint();

  const panTo = (event: ToolPointerEvent) => {
    const { camera } = store.getState();
    store.setState({ camera: panBy(camera, event.screen.x - last.x, event.screen.y - last.y) });
    last.x = event.screen.x;
    last.y = event.screen.y;
  };

  return {
    getCursor: () => (dragging ? 'grabbing' : 'grab'),

    pointerDown(event) {
      dragging = true;
      last.x = event.screen.x;
      last.y = event.screen.y;
    },

    pointerMove(event) {
      if (dragging) {
        panTo(event);
      }
    },

    pointerUp(event) {
      // The release point can differ from the last move; include it so the pan ends exactly there.
      if (dragging) {
        panTo(event);
      }
      dragging = false;
    },

    cancel() {
      dragging = false;
    },
  };
}
