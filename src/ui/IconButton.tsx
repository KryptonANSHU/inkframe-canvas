import type { LucideIcon } from 'lucide-react';
import { ICON_STROKE, size } from '../design/tokens';
import { useEditor } from './EditorContext';
import styles from './IconButton.module.css';
import { shortcutText } from './shortcutLabel';
import { Tip } from './Tip';

type IconButtonProps = {
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly onClick: () => void;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  /** For toggles: pressed shows the selected look and is announced as on. */
  readonly pressed?: boolean;
  readonly tipSide?: 'top' | 'bottom' | 'left' | 'right';
};

/**
 * An icon-only button with an accessible name and a tooltip naming its shortcut.
 * After a pointer click, focus returns to the canvas so shortcuts keep working;
 * keyboard users stay where they are.
 */
export function IconButton({
  label,
  Icon,
  onClick,
  shortcut,
  disabled,
  pressed,
  tipSide,
}: IconButtonProps) {
  const editor = useEditor();
  return (
    <Tip label={label} {...(shortcut === undefined ? {} : { shortcut })} side={tipSide ?? 'top'}>
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        {...(shortcut === undefined ? {} : { 'aria-keyshortcuts': shortcutText(shortcut) })}
        disabled={disabled}
        {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
        onClick={(event) => {
          onClick();
          if (event.detail > 0) editor.focus();
        }}
      >
        <Icon size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </Tip>
  );
}
