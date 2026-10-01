/** "system" follows the OS; the others pin the theme with data-theme on <html>. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Also read by the inline script in index.html, which applies it before first paint. */
const STORAGE_KEY = 'inkframe.theme';

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    // Storage can be blocked (private modes); the system theme is the right fallback.
    return 'system';
  }
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') {
    delete root.dataset['theme'];
  } else {
    root.dataset['theme'] = preference;
  }
  try {
    if (preference === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
    // Not remembered across reloads when storage is blocked; the choice still applies now.
  }
}
