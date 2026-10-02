import { CircleAlert, Info, LoaderCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Toast as RadixToast } from 'radix-ui';
import { ICON_STROKE, size } from '../tokens';
import { classes } from './classes';
import styles from './Toast.module.css';

/** Long enough to read a two-line error; errors that need action stay until closed. */
const DURATION_MS = 8000;

/** Wraps the toasts and their viewport; toasts are announced through Radix's live region. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  return (
    <RadixToast.Provider swipeDirection="down" duration={DURATION_MS}>
      {children}
    </RadixToast.Provider>
  );
}

/** Where toasts stack. `className` places it. */
export function ToastViewport({ className }: { readonly className?: string | undefined }) {
  return (
    <RadixToast.Viewport
      className={classes(styles.viewport, className)}
      label="Notifications ({hotkey})"
    />
  );
}

const ICONS = { info: Info, error: CircleAlert, progress: LoaderCircle } as const;

type ToastProps = {
  /**
   * error interrupts (announced assertively); info waits its turn; progress stays up
   * until the work ends and has no close button.
   */
  readonly tone: 'info' | 'error' | 'progress';
  readonly children: ReactNode;
  /** Called when the toast is dismissed or times out. */
  readonly onClose?: () => void;
};

export function Toast({ tone, children, onClose }: ToastProps) {
  const Icon = ICONS[tone];
  const closable = tone !== 'progress';
  return (
    <RadixToast.Root
      className={styles.toast}
      data-closable={closable}
      type={tone === 'error' ? 'foreground' : 'background'}
      {...(tone === 'progress' ? { duration: Infinity } : {})}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <Icon
        className={styles.icon}
        data-tone={tone}
        size={size.icon}
        strokeWidth={ICON_STROKE}
        aria-hidden
      />
      <RadixToast.Description className={styles.message}>{children}</RadixToast.Description>
      {closable && (
        <RadixToast.Close className={styles.close} aria-label="Dismiss">
          <X size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
        </RadixToast.Close>
      )}
    </RadixToast.Root>
  );
}
