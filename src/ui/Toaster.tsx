import { useStore } from 'zustand';
import { Toast, ToastProvider, ToastViewport } from '@inkframe/design';
import { useEditor, useEditorState } from './EditorContext';
import { dismissNotice, notices } from './notifications';
import styles from './Toaster.module.css';

/**
 * Toasts, bottom center: file progress while it runs, and every error the user should
 * know about. Announced politely to screen readers (Radix's live region).
 */
export function Toaster() {
  const editor = useEditor();
  const fileStatus = useEditorState((state) => state.fileStatus);
  const list = useStore(notices, (state) => state.notices);

  return (
    <ToastProvider>
      {fileStatus.kind === 'busy' && (
        <Toast tone="progress">
          {fileStatus.label}
          {fileStatus.progress !== null && ` · ${String(Math.round(fileStatus.progress * 100))}%`}
        </Toast>
      )}
      {fileStatus.kind === 'error' && (
        <Toast
          tone="error"
          onClose={() => {
            editor.files.dismissStatus();
          }}
        >
          {fileStatus.message}
        </Toast>
      )}
      {list.map((notice) => (
        <Toast
          key={notice.id}
          tone={notice.kind}
          onClose={() => {
            dismissNotice(notice.id);
          }}
        >
          {notice.message}
        </Toast>
      ))}
      <ToastViewport className={styles.place} />
    </ToastProvider>
  );
}
