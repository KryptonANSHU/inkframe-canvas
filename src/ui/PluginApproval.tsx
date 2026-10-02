import { ShieldCheck } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useStore } from 'zustand';
import type { PluginManager } from '../plugins/manager';
import { ICON_STROKE, size } from '../design/tokens';
import { useEditor } from './EditorContext';
import { PERMISSION_TEXT } from './pluginCopy';
import styles from './PluginApproval.module.css';

type PluginApprovalProps = { readonly manager: PluginManager };

/**
 * Asks before a plugin's first run (and again when its permissions change). Names come
 * from the plugin itself, so the dialog also says where the plugin came from.
 */
export function PluginApproval({ manager }: PluginApprovalProps) {
  const editor = useEditor();
  const approval = useStore(manager.state, (state) => state.approval);
  const source = useStore(manager.state, (state) =>
    state.approval === null
      ? null
      : (state.entries.find((entry) => entry.key === state.approval?.key)?.source ?? null),
  );
  const manifest = approval?.manifest;

  return (
    <Dialog.Root
      open={approval !== null}
      onOpenChange={(open) => {
        if (!open && approval !== null) manager.decide(approval.key, false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content
          className={styles.dialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor.focus();
          }}
        >
          <Dialog.Title className={styles.title}>Allow “{manifest?.name}” to run?</Dialog.Title>
          <Dialog.Description className={styles.meta}>
            Version {manifest?.version} ·{' '}
            {source === 'file' ? 'from a file you loaded' : 'built in'}
          </Dialog.Description>
          {manifest !== undefined && manifest.permissions.length > 0 ? (
            <>
              <p className={styles.lead}>It asks to:</p>
              <ul className={styles.permissions}>
                {manifest.permissions.map((permission) => (
                  <li key={permission}>{PERMISSION_TEXT[permission]}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.lead}>It asks for no permissions.</p>
          )}
          <p className={styles.note}>
            <ShieldCheck size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
            It runs in a sandbox: it can&apos;t see this page, your files, or the network, and you
            can revoke any permission later.
          </p>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                if (approval !== null) manager.decide(approval.key, false);
              }}
            >
              Don&apos;t allow
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                if (approval !== null) manager.decide(approval.key, true);
              }}
            >
              Allow
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
