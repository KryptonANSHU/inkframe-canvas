import type { ThemeName } from '../../design/tokens';
import type { EditorStore } from '../store';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Keeps the store's theme in step with the page: `data-theme` on <html> when set
 * (the M7 theme switch), otherwise the system preference. The same rules as the token
 * CSS, so the canvas and the UI always agree.
 */
export function watchThemeMode(store: EditorStore): () => void {
  const root = document.documentElement;
  const media = matchMedia(DARK_QUERY);
  const update = () => {
    const chosen = root.dataset['theme'];
    const theme: ThemeName =
      chosen === 'light' || chosen === 'dark' ? chosen : media.matches ? 'dark' : 'light';
    if (store.getState().theme !== theme) {
      store.setState({ theme });
    }
  };
  update();
  media.addEventListener('change', update);
  const observer = new MutationObserver(update);
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    media.removeEventListener('change', update);
    observer.disconnect();
  };
}
