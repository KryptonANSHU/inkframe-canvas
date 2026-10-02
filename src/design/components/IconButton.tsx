import type { LucideIcon } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type MouseEvent } from 'react';
import { ICON_STROKE, size as sizes } from '../tokens';
import { classes } from './classes';
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

type IconTriggerProps = Omit<ComponentPropsWithoutRef<'button'>, 'type' | 'children'> & {
  readonly label: string;
  readonly Icon: LucideIcon;
};

/**
 * The icon-only button that opens a Menu or Popover. No tooltip: the panel explains
 * itself, and a tooltip shown on focus would outlive it.
 */
export const IconTrigger = forwardRef<HTMLButtonElement, IconTriggerProps>(function IconTrigger(
  { label, Icon, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={classes(styles.button, className)}
      aria-label={label}
      {...rest}
    >
      <Icon size={sizes.icon} strokeWidth={ICON_STROKE} aria-hidden />
    </button>
  );
});
