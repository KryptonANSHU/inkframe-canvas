import type { EditorStore } from '../store';

const STORAGE_KEY = 'inkframe.grid';

/** Remembers whether the grid is shown, per browser, like the theme. */
export function bindGridPreference(store: EditorStore): () => void {
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'on') {
      store.setState({ gridVisible: true });
    }
  } catch {
    // Storage blocked (private modes): the grid starts hidden, which is the default anyway.
  }
  return store.subscribe((state, previous) => {
    if (state.gridVisible === previous.gridVisible) {
      return;
    }
    try {
      if (state.gridVisible) {
        localStorage.setItem(STORAGE_KEY, 'on');
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Not remembered across reloads when storage is blocked; it still applies now.
    }
  });
}
