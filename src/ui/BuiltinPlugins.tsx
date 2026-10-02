import { Button } from '@inkframe/design';
import { useStore } from 'zustand';
import type { PluginManager } from '../plugins/manager';
import styles from './PluginPanel.module.css';

type BuiltinPluginsProps = { readonly manager: PluginManager };

/** The plugins that ship with Inkframe, minus any already in the panel's list. */
export function BuiltinPlugins({ manager }: BuiltinPluginsProps) {
  const added = useStore(manager.state, (state) =>
    state.entries
      .filter((entry) => entry.source === 'builtin')
      .map((entry) => entry.label)
      .join('\n'),
  );
  const available = manager.builtins.filter((plugin) => !added.split('\n').includes(plugin.name));
  if (available.length === 0) return null;

  return (
    <section className={styles.builtins} aria-labelledby="builtin-plugins">
      <h3 id="builtin-plugins" className={styles.subtitle}>
        Built in
      </h3>
      <ul className={styles.list}>
        {available.map((plugin) => (
          <li key={plugin.name} className={styles.builtin}>
            <div className={styles.identity}>
              <p className={styles.name}>{plugin.name}</p>
              <p className={styles.status}>{plugin.description}</p>
            </div>
            <Button
              size="sm"
              aria-label={`Run ${plugin.name}`}
              onClick={() => {
                manager.run(plugin.code, plugin.name, 'builtin');
              }}
            >
              Run
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
