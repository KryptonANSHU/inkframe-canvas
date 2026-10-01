import { screenToWorld } from '../camera';
import { createShapeId } from '../shapes';
import type { EditorStore } from '../store';
import type { Tool } from './tool';

type TextToolState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'placing'; readonly x: number; readonly y: number }
  /** This press only ends the text being edited (its textarea commits on blur). */
  | { readonly kind: 'endingEdit' };

/**
 * Click to place a text box. The tool only records where; the DOM text editor sees
 * `textEdit` in the store, opens a textarea there, and commits the shape.
 */
export function createTextTool(store: EditorStore): Tool {
  let state: TextToolState = { kind: 'idle' };

  return {
    getCursor: () => 'text',

    hover() {
      // The cursor is the same everywhere for this tool.
    },

    pointerDown(event) {
      const { textEdit, fontsReady, camera } = store.getState();
      if (textEdit !== null || !fontsReady) {
        state = { kind: 'endingEdit' };
        return;
      }
      const world = screenToWorld(camera, event.screen);
      state = { kind: 'placing', x: world.x, y: world.y };
    },

    pointerMove() {
      // Placement is a click; the box's width comes from the default for now (resize in M4).
    },

    pointerUp() {
      const finished = state;
      state = { kind: 'idle' };
      if (finished.kind === 'placing') {
        store.setState({ textEdit: { id: createShapeId(), x: finished.x, y: finished.y } });
      }
    },

    cancel() {
      state = { kind: 'idle' };
    },
  };
}
