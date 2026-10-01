import styles from './Kbd.module.css';
import { shortcutKeys } from './shortcutLabel';

type KbdProps = {
  /** "Mod+Shift+Z" style; Mod is ⌘ on Apple platforms and Ctrl elsewhere. */
  readonly shortcut: string;
  readonly tone?: 'plain' | 'inverse';
};

/** A shortcut as key caps. */
export function Kbd({ shortcut, tone = 'plain' }: KbdProps) {
  return (
    <span className={styles.keys}>
      {/* A shortcut never repeats a key, so each key names its cap. */}
      {shortcutKeys(shortcut).map((key) => (
        <kbd key={key} className={tone === 'inverse' ? styles.inverse : styles.key}>
          {key}
        </kbd>
      ))}
    </span>
  );
}
