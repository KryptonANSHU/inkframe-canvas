import type { LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { ICON_STROKE, size as sizes } from '../tokens';
import styles from './IconButton.module.css';
import { shortcutText } from './shortcuts';
import { Tooltip } from './Tooltip';

type IconButtonProps = {
  /** The accessible name, also shown in the tooltip. */
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  /** For toggles: pressed shows the selected look and is announced as on. */
  readonly pressed?: boolean;
  readonly size?: 'md' | 'sm';
  readonly tipSide?: 'top' | 'bottom' | 'left' | 'right';
};

/** An icon-only button with an accessible name and a tooltip naming its shortcut. */
export function IconButton({
  label,
  Icon,
  onClick,
  shortcut,
  disabled,
  pressed,
  size = 'md',
  tipSide = 'top',
}: IconButtonProps) {
  return (
    <Tooltip label={label} {...(shortcut === undefined ? {} : { shortcut })} side={tipSide}>
      <button
        type="button"
        className={styles.button}
        data-size={size}
        aria-label={label}
        {...(shortcut === undefined ? {} : { 'aria-keyshortcuts': shortcutText(shortcut) })}
        disabled={disabled}
        {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
        onClick={onClick}
      >
        <Icon size={sizes.icon} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </Tooltip>
  );
}
