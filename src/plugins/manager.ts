import { createStore, type StoreApi } from 'zustand/vanilla';
import type { EditorStore } from '../core/store';
import type { TextMeasurer } from '../core/text/layout';
import { PERMISSIONS, type Manifest, type Permission } from './protocol';
import { BUILTIN_PLUGINS, type BuiltinPlugin } from './samples/builtins';
import { runInSandbox, type SandboxedPlugin } from './sandbox';
import { createPluginSession, type PluginState } from './session';

/** Most recent security-log lines kept per plugin, for the panel. */
const LOG_LIMIT = 50;
/** Approvals are remembered per plugin ID and version, in this browser. */
const APPROVALS_KEY = 'inkframe.plugins.approvals';

export type PluginSource = 'builtin' | 'file';

export type PluginEntry = {
  readonly key: number;
  /** The file or built-in name, until the plugin introduces itself. */
  readonly label: string;
  readonly source: PluginSource;
  readonly state: PluginState;
  readonly log: readonly LogLine[];
};

/** One security-log line; the ID keys it in lists. */
export type LogLine = { readonly id: number; readonly message: string };

export type ManagerState = {
  readonly entries: readonly PluginEntry[];
  /** A plugin waiting for the user to allow or deny its permissions. */
  readonly approval: { readonly key: number; readonly manifest: Manifest } | null;
};

export type PluginManagerOptions = {
  readonly store: EditorStore;
  readonly measurer: TextMeasurer;
  /** Where plugin iframes live (hidden). */
  readonly container: HTMLElement;
  readonly notify: (pluginName: string, message: string) => void;
};

export type PluginManager = {
  readonly state: StoreApi<ManagerState>;
  /** Plugins shipped with Inkframe; here so their code loads with the manager, lazily. */
  readonly builtins: readonly BuiltinPlugin[];
  run(code: string, label: string, source: PluginSource): number;
  /** Runs the same code again in a fresh sandbox, e.g. after a crash. */
  restart(key: number): void;
  stop(key: number): void;
  remove(key: number): void;
  revoke(key: number, permission: Permission): void;
  /** Asks a running plugin to run one of its commands. */
  command(key: number, id: string): void;
  /** The user's answer to the pending approval. */
  decide(key: number, allow: boolean): void;
  dispose(): void;
};

type Running = { readonly code: string; sandbox: SandboxedPlugin | null };

export function createPluginManager(options: PluginManagerOptions): PluginManager {
  const state = createStore<ManagerState>()(() => ({ entries: [], approval: null }));
  const running = new Map<number, Running>();
  const pendingApprovals = new Map<number, (granted: readonly Permission[] | null) => void>();
  let nextKey = 1;
  let nextLogId = 1;

  const update = (key: number, change: (entry: PluginEntry) => PluginEntry) => {
    state.setState({
      entries: state.getState().entries.map((entry) => (entry.key === key ? change(entry) : entry)),
    });
  };
  const log = (key: number, line: string) => {
    const entry: LogLine = { id: nextLogId++, message: line };
    update(key, (current) => ({ ...current, log: [...current.log, entry].slice(-LOG_LIMIT) }));
  };

  const approve = (key: number, manifest: Manifest) => {
    const remembered = readApprovals()[approvalId(manifest)];
    if (remembered !== undefined && manifest.permissions.every((p) => remembered.includes(p))) {
      return Promise.resolve<readonly Permission[] | null>(remembered);
    }
    state.setState({ approval: { key, manifest } });
    return new Promise<readonly Permission[] | null>((resolve) => {
      pendingApprovals.set(key, resolve);
    });
  };

  const start = (key: number) => {
    const entry = running.get(key);
    if (entry === undefined) return;
    entry.sandbox = runInSandbox(entry.code, options.container, (send) =>
      createPluginSession({
        send,
        approve: (manifest) => approve(key, manifest),
        api: {
          store: options.store,
          measurer: options.measurer,
          notify: (message) => {
            const current = entry.sandbox?.session.state();
            const name =
              current !== undefined && 'manifest' in current ? current.manifest?.name : null;
            options.notify(name ?? 'A plugin', message);
          },
        },
        log: (line) => {
          log(key, line);
        },
        onChange: (next) => {
          update(key, (current) => ({ ...current, state: next }));
          if (next.kind === 'stopped') {
            settleApproval(key, null);
            entry.sandbox?.dispose(next.reason);
          }
        },
      }),
    );
  };

  const settleApproval = (key: number, granted: readonly Permission[] | null) => {
    pendingApprovals.get(key)?.(granted);
    pendingApprovals.delete(key);
    if (state.getState().approval?.key === key) {
      state.setState({ approval: null });
    }
  };

  const stop = (key: number, reason = 'Stopped by you.') => {
    running.get(key)?.sandbox?.dispose(reason);
  };

  return {
    state,
    builtins: BUILTIN_PLUGINS,
    run(code, label, source) {
      const key = nextKey++;
      running.set(key, { code, sandbox: null });
      state.setState({
        entries: [
          ...state.getState().entries,
          { key, label, source, state: { kind: 'loading' }, log: [] },
        ],
      });
      start(key);
      return key;
    },
    restart(key) {
      stop(key, 'Restarted.');
      update(key, (entry) => ({ ...entry, state: { kind: 'loading' }, log: [] }));
      start(key);
    },
    stop: (key) => {
      stop(key);
    },
    remove(key) {
      stop(key);
      running.delete(key);
      state.setState({ entries: state.getState().entries.filter((entry) => entry.key !== key) });
    },
    revoke(key, permission) {
      const session = running.get(key)?.sandbox?.session;
      const current = session?.state();
      session?.revoke(permission);
      // Revoked for next time too: running it again asks the user afresh.
      if (current?.kind === 'running') {
        const id = approvalId(current.manifest);
        writeApprovals(
          Object.fromEntries(Object.entries(readApprovals()).filter(([key]) => key !== id)),
        );
      }
    },
    command(key, id) {
      running.get(key)?.sandbox?.session.command(id);
    },
    decide(key, allow) {
      const approval = state.getState().approval;
      if (approval?.key !== key) return;
      if (allow) {
        writeApprovals({
          ...readApprovals(),
          [approvalId(approval.manifest)]: approval.manifest.permissions,
        });
      }
      settleApproval(key, allow ? approval.manifest.permissions : null);
    },
    dispose() {
      for (const key of running.keys()) stop(key, 'The editor was closed.');
    },
  };
}

function approvalId(manifest: Manifest): string {
  return `${manifest.id}@${manifest.version}`;
}

/**
 * Stored approvals are our own data, but a hand-edited value must not break anything:
 * entries that aren't a list of known permissions are ignored.
 */
function readApprovals(): Record<string, readonly Permission[]> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(APPROVALS_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    const known = (value: unknown): value is Permission =>
      typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, Permission[]] =>
          Array.isArray(entry[1]) && entry[1].every(known),
      ),
    );
  } catch {
    // Storage blocked or corrupt: nothing is remembered, so the user is asked again.
    return {};
  }
}

function writeApprovals(approvals: Record<string, readonly Permission[]>): void {
  try {
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(approvals));
  } catch {
    // Not remembered when storage is blocked; the plugin still runs this time.
  }
}
