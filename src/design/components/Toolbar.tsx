import type { LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { Toolbar as RadixToolbar } from 'radix-ui';
import { ICON_STROKE, size } from '../tokens';
import { classes } from './classes';
import styles from './Toolbar.module.css';
import { Tooltip } from './Tooltip';

type ToolbarProps = {
  readonly label: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
};

/**
 * A floating toolbar: one Tab stop, arrow keys move between its controls (Radix
 * roving focus). `className` places it.
 */
export function Toolbar({ label, className, children }: ToolbarProps) {
  return (
    <RadixToolbar.Root className={classes(styles.toolbar, className)} aria-label={label}>
      {children}
    </RadixToolbar.Root>
  );
}

type ToolbarChoiceProps<T extends string> = {
  readonly label: string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly children: ReactNode;
};

/** Pick one of several (the drawing tools): a choice always stays chosen. */
export function ToolbarChoice<T extends string>({
  label,
  value,
  onChange,
  children,
}: ToolbarChoiceProps<T>) {
  return (
    <RadixToolbar.ToggleGroup
      type="single"
      className={styles.group}
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        // Radix sends "" when the chosen item is clicked again.
        if (next !== '') onChange(next as T);
      }}
    >
      {children}
    </RadixToolbar.ToggleGroup>
  );
}

type ItemProps = {
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly shortcut?: string;
  /** The tooltip's text, when it should differ from the accessible name. */
  readonly tip?: string;
  readonly onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

/** One option of a ToolbarChoice, icon-only with a tooltip. */
export function ToolbarOption({
  value,
  label,
  Icon,
  shortcut,
  onClick,
}: ItemProps & { readonly value: string }) {
  return (
    <Tooltip label={label} {...(shortcut === undefined ? {} : { shortcut })}>
      <RadixToolbar.ToggleItem
        value={value}
        className={styles.item}
        aria-label={label}
        {...(shortcut === undefined ? {} : { 'aria-keyshortcuts': shortcut })}
        {...(onClick === undefined ? {} : { onClick })}
      >
        <Icon size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
      </RadixToolbar.ToggleItem>
    </Tooltip>
  );
}

/** An on/off toolbar button, icon-only with a tooltip. */
export function ToolbarToggle({
  label,
  Icon,
  shortcut,
  tip,
  pressed,
  onClick,
}: ItemProps & { readonly pressed: boolean }) {
  return (
    <Tooltip label={tip ?? label} {...(shortcut === undefined ? {} : { shortcut })}>
      <RadixToolbar.Button
        className={styles.item}
        aria-label={label}
        aria-pressed={pressed}
        {...(shortcut === undefined ? {} : { 'aria-keyshortcuts': shortcut })}
        {...(onClick === undefined ? {} : { onClick })}
      >
        <Icon size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
      </RadixToolbar.Button>
    </Tooltip>
  );
}

export function ToolbarSeparator() {
  return <RadixToolbar.Separator className={styles.separator} />;
}
