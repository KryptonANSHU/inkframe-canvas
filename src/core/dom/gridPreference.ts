import type { EditorStore } from '../store';

const STORAGE_KEY = 'inkframe.grid';

/**
 * Remembers whether the grid is shown, per browser, like the theme. The grid is on by
 * default, so only turning it off is stored.
 */
export function bindGridPreference(store: EditorStore): () => void {
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'off') {
      store.setState({ gridVisible: false });
    }
  } catch {
    // Storage blocked (private modes): the grid starts shown, which is the default anyway.
  }
  return store.subscribe((state, previous) => {
    if (state.gridVisible === previous.gridVisible) {
      return;
    }
    try {
      if (state.gridVisible) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, 'off');
      }
    } catch {
      // Not remembered across reloads when storage is blocked; it still applies now.
    }
  });
}
