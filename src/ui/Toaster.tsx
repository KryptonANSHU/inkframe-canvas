import { CircleAlert, Info, LoaderCircle, X } from 'lucide-react';
import { Toast } from 'radix-ui';
import { useStore } from 'zustand';
import { ICON_STROKE, size } from '../design/tokens';
import { useEditor, useEditorState } from './EditorContext';
import { dismissNotice, notices, type NoticeKind } from './notifications';
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
        <NoticeToast
          kind="error"
          message={fileStatus.message}
          onClose={() => {
            editor.files.dismissStatus();
          }}
        />
      )}
      {list.map((notice) => (
        <NoticeToast
          key={notice.id}
          kind={notice.kind}
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

type NoticeToastProps = {
  readonly message: string;
  readonly kind: NoticeKind;
  readonly onClose: () => void;
};

/** Errors interrupt (announced assertively); news like "Canvas cleared" waits its turn. */
function NoticeToast({ message, kind, onClose }: NoticeToastProps) {
  const Icon = kind === 'error' ? CircleAlert : Info;
  return (
    <Toast.Root
      className={styles.notice}
      type={kind === 'error' ? 'foreground' : 'background'}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Icon
        className={kind === 'error' ? styles.alert : styles.info}
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
