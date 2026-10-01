import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import { Toast } from 'radix-ui';
import { useStore } from 'zustand';
import { ICON_STROKE, size } from '../design/tokens';
import { useEditor, useEditorState } from './EditorContext';
import { dismissNotice, notices } from './notifications';
import styles from './Toaster.module.css';

/** Long enough to read a two-line error; errors that need action stay until closed. */
const TOAST_DURATION_MS = 8000;

/**
 * Toasts, bottom center: file progress while it runs, and every error the user should
 * know about. Announced politely to screen readers (Radix's live region).
 */
export function Toaster() {
  const editor = useEditor();
  const fileStatus = useEditorState((state) => state.fileStatus);
  const list = useStore(notices, (state) => state.notices);

  return (
    <Toast.Provider swipeDirection="down" duration={TOAST_DURATION_MS}>
      {fileStatus.kind === 'busy' && (
        <Toast.Root className={styles.toast} duration={Infinity} type="background">
          <LoaderCircle
            className={styles.spinner}
            size={size.icon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <Toast.Description className={styles.message}>
            {fileStatus.label}
            {fileStatus.progress !== null && ` · ${String(Math.round(fileStatus.progress * 100))}%`}
          </Toast.Description>
        </Toast.Root>
      )}
      {fileStatus.kind === 'error' && (
        <ErrorToast
          message={fileStatus.message}
          onClose={() => {
            editor.files.dismissStatus();
          }}
        />
      )}
      {list.map((notice) => (
        <ErrorToast
          key={notice.id}
          message={notice.message}
          onClose={() => {
            dismissNotice(notice.id);
          }}
        />
      ))}
      <Toast.Viewport className={styles.viewport} label="Notifications ({hotkey})" />
    </Toast.Provider>
  );
}

function ErrorToast({
  message,
  onClose,
}: {
  readonly message: string;
  readonly onClose: () => void;
}) {
  return (
    <Toast.Root
      className={styles.error}
      type="foreground"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <CircleAlert
        className={styles.alert}
        size={size.icon}
        strokeWidth={ICON_STROKE}
        aria-hidden
      />
      <Toast.Description className={styles.message}>{message}</Toast.Description>
      <Toast.Close className={styles.close} aria-label="Dismiss">
        <X size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
      </Toast.Close>
    </Toast.Root>
  );
}
