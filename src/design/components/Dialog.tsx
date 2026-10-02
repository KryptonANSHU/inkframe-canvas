import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { ICON_STROKE, size } from '../tokens';
import styles from './Dialog.module.css';

type DialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly width?: 'narrow' | 'wide';
  /** A close button in the header. Without one, the actions must offer a way out. */
  readonly closable?: boolean;
  /** Buttons at the bottom; the main action goes last. */
  readonly actions?: ReactNode;
  /** Where focus goes on close; call event.preventDefault() to move it yourself. */
  readonly onCloseAutoFocus?: (event: Event) => void;
  readonly children: ReactNode;
};

/**
 * A modal dialog over a scrim. Focus starts on the dialog itself, so no ring shows on
 * a button the user didn't move to; Tab and Escape work as expected.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  width = 'narrow',
  closable = false,
  actions,
  onCloseAutoFocus,
  children,
}: DialogProps) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.scrim} />
        <RadixDialog.Content
          ref={content}
          className={styles.dialog}
          data-width={width}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.focus();
          }}
          {...(onCloseAutoFocus === undefined ? {} : { onCloseAutoFocus })}
        >
          <header className={styles.header}>
            <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            {closable && (
              <RadixDialog.Close className={styles.close} aria-label="Close">
                <X size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
              </RadixDialog.Close>
            )}
          </header>
          <RadixDialog.Description className={styles.description}>
            {description}
          </RadixDialog.Description>
          {children}
          {actions !== undefined && <div className={styles.actions}>{actions}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
