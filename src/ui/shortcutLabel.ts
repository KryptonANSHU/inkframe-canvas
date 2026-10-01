/** Apple platforms show ⌘ ⇧ ⌥ glyphs; everyone else gets Ctrl, Shift, Alt. */
const isApple = /Mac|iPhone|iPad/.test(navigator.userAgent);

const APPLE: Readonly<Record<string, string>> = { Mod: '⌘', Shift: '⇧', Alt: '⌥' };
const OTHER: Readonly<Record<string, string>> = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' };

/**
 * The keys of a shortcut written as "Mod+Shift+Z", one entry per key cap:
 * ["⇧", "⌘", "Z"] on a Mac (Apple's order), ["Ctrl", "Shift", "Z"] elsewhere.
 */
export function shortcutKeys(shortcut: string): string[] {
  const parts = shortcut.split('+');
  const names = isApple ? APPLE : OTHER;
  const keys = parts.map((part) => names[part] ?? part);
  // Apple lists Shift before Command.
  return isApple && parts[0] === 'Mod' && parts[1] === 'Shift'
    ? [keys[1] ?? '', keys[0] ?? '', ...keys.slice(2)]
    : keys;
}

/** A shortcut as plain text, for tooltips and aria-keyshortcuts. */
export function shortcutText(shortcut: string): string {
  return shortcutKeys(shortcut).join(isApple ? '' : '+');
}
