import { CircleStop, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { useRef } from 'react';
import { useStore } from 'zustand';
import type { PluginEntry, PluginManager } from '../plugins/manager';
import { ICON_STROKE, size } from '../design/tokens';
import { BuiltinPlugins } from './BuiltinPlugins';
import { PERMISSION_LABEL, stateText } from './pluginCopy';
import styles from './PluginPanel.module.css';

type PluginPanelProps = { readonly manager: PluginManager };

/** Running plugins, their permissions and security log, and loading from a file. */
export function PluginPanel({ manager }: PluginPanelProps) {
  const entries = useStore(manager.state, (state) => state.entries);
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Plugins</h2>
      {entries.length === 0 ? (
        <p className={styles.empty}>
          Plugins run in a sandbox: they can&apos;t see this page, your files, or the network.
        </p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <PluginRow key={entry.key} entry={entry} manager={manager} />
          ))}
        </ul>
      )}
      <BuiltinPlugins manager={manager} />
      <button
        type="button"
        className={styles.load}
        onClick={() => {
          picker.current?.click();
        }}
      >
        <Upload size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
        Load plugin from file…
      </button>
      <input
        ref={picker}
        className={styles.picker}
        type="file"
        accept=".js,text/javascript"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file !== undefined) {
            void file.text().then((code) => manager.run(code, file.name, 'file'));
          }
        }}
      />
    </div>
  );
}

function PluginRow({
  entry,
  manager,
}: {
  readonly entry: PluginEntry;
  readonly manager: PluginManager;
}) {
  const { state } = entry;
  const manifest = state.kind === 'loading' ? null : state.manifest;
  const stopped = state.kind === 'stopped';
  return (
    <li className={styles.row}>
      <div className={styles.head}>
        <div className={styles.identity}>
          <p className={styles.name}>
            {manifest?.name ?? entry.label}
            {manifest !== null && <span className={styles.version}>{manifest.version}</span>}
          </p>
          <p className={stopped ? styles.stopped : styles.status}>
            {entry.source === 'file' ? 'From a file · ' : ''}
            {stateText(state)}
          </p>
        </div>
        <div className={styles.actions}>
          {stopped ? (
            <RowButton
              label="Restart"
              Icon={RotateCcw}
              onClick={() => {
                manager.restart(entry.key);
              }}
            />
          ) : (
            <RowButton
              label="Stop"
              Icon={CircleStop}
              onClick={() => {
                manager.stop(entry.key);
              }}
            />
          )}
          <RowButton
            label="Remove"
            Icon={Trash2}
            onClick={() => {
              manager.remove(entry.key);
            }}
          />
        </div>
      </div>
      {state.kind === 'running' && state.manifest.commands.length > 0 && (
        <div
          className={styles.commands}
          role="group"
          aria-label={`${state.manifest.name} commands`}
        >
          {state.manifest.commands.map((command) => (
            <button
              key={command.id}
              type="button"
              className={styles.command}
              onClick={() => {
                manager.command(entry.key, command.id);
              }}
            >
              {command.label}
            </button>
          ))}
        </div>
      )}
      {state.kind === 'running' && state.granted.length > 0 && (
        <ul className={styles.chips} aria-label="Permissions">
          {state.granted.map((permission) => (
            <li key={permission} className={styles.chip}>
              {PERMISSION_LABEL[permission]}
              <button
                type="button"
                className={styles.revoke}
                aria-label={`Revoke ${PERMISSION_LABEL[permission]}`}
                onClick={() => {
                  manager.revoke(entry.key, permission);
                }}
              >
                <X size={12} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {entry.log.length > 0 && (
        <details className={styles.log}>
          <summary>Security log ({entry.log.length})</summary>
          <ol className={styles.lines}>
            {entry.log.map((line) => (
              <li key={line.id}>
                {line.message}
                {line.count > 1 && <span className={styles.repeat}> ×{line.count}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}

type RowButtonProps = {
  readonly label: string;
  readonly Icon: typeof X;
  readonly onClick: () => void;
};

/** Small icon buttons that keep focus in the panel (the panel would close otherwise). */
function RowButton({ label, Icon, onClick }: RowButtonProps) {
  return (
    <button
      type="button"
      className={styles.action}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
    </button>
  );
}
