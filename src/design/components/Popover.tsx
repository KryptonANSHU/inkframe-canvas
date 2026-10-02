import type { ReactElement, ReactNode } from 'react';
import { Popover as RadixPopover } from 'radix-ui';
import { classes } from './classes';
import styles from './Popover.module.css';

type PopoverProps = {
  /** The button that opens it; it must forward refs and props. */
  readonly trigger: ReactElement;
  /** The popover's accessible name. */
  readonly label: string;
  readonly onOpenChange?: (open: boolean) => void;
  readonly align?: 'start' | 'center' | 'end';
  /** Where focus goes on close; call event.preventDefault() to move it yourself. */
  readonly onCloseAutoFocus?: (event: Event) => void;
  /** Lays out the content (size, padding, scrolling). */
  readonly className?: string | undefined;
  readonly children: ReactNode;
};

/** A floating panel anchored to a button, e.g. the plugin list. */
export function Popover({
  trigger,
  label,
  onOpenChange,
  align = 'center',
  onCloseAutoFocus,
  className,
  children,
}: PopoverProps) {
  return (
    <RadixPopover.Root {...(onOpenChange === undefined ? {} : { onOpenChange })}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className={classes(styles.content, className)}
          align={align}
          sideOffset={8}
          aria-label={label}
          {...(onCloseAutoFocus === undefined ? {} : { onCloseAutoFocus })}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
