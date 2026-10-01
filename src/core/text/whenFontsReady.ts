import type { EditorStore } from '../store';

/**
 * Runs `action` now if the text font is ready, otherwise as soon as it is. Text typed
 * before the font loads is measured with the real font, so its stored height is right.
 */
export function whenFontsReady(store: EditorStore, action: () => void): void {
  if (store.getState().fontsReady) {
    action();
    return;
  }
  const unsubscribe = store.subscribe((state) => {
    if (state.fontsReady) {
      unsubscribe();
      action();
    }
  });
}
