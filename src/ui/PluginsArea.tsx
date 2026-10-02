import { Puzzle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Popover } from 'radix-ui';
import type { PluginManager } from '../plugins/manager';
import { ICON_STROKE, size } from '../design/tokens';
import { useEditor } from './EditorContext';
import { notify } from './notifications';
import { PluginApproval } from './PluginApproval';
import { PluginPanel } from './PluginPanel';
import styles from './PluginsArea.module.css';

/**
 * The plugins button, top right. The plugin system (and the Zod schemas it validates
 * with) loads the first time the panel opens, so nobody pays for it up front.
 */
export function PluginsArea() {
  const editor = useEditor();
  const [manager, setManager] = useState<PluginManager | null>(null);
  const loading = useRef<Promise<void> | null>(null);

  const loadManager = () => {
    loading.current ??= import('../plugins/manager').then(({ createPluginManager }) => {
      setManager(
        createPluginManager({
          store: editor.store,
          measurer: editor.measurer,
          container: document.body,
          notify: (name, message) => {
            notify(`${name}: ${message}`, 'info');
          },
        }),
      );
    });
  };

  // Stops every plugin when the editor goes away.
  useEffect(() => () => manager?.dispose(), [manager]);

  return (
    <>
      <Popover.Root
        onOpenChange={(open) => {
          if (open) loadManager();
        }}
      >
        <div className={styles.bar}>
          {/* No tooltip: the panel explains itself (see the main menu). */}
          <Popover.Trigger className={styles.trigger} aria-label="Plugins">
            <Puzzle size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
          </Popover.Trigger>
        </div>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            aria-label="Plugins"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              editor.focus();
            }}
          >
            {manager === null ? (
              <p className={styles.loading}>Loading plugins…</p>
            ) : (
              <PluginPanel manager={manager} />
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {manager !== null && <PluginApproval manager={manager} />}
    </>
  );
}
