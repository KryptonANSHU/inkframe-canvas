import { callApi, type ApiContext } from './api';
import {
  hostMessage,
  LIMITS,
  METHOD_PERMISSION,
  pluginMessageSchema,
  SUPPORTED_API_VERSIONS,
  type HostMessage,
  type Manifest,
  type Permission,
} from './protocol';

/** Where a plugin is in its lifecycle: load → handshake → approval → running → stopped. */
export type PluginState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'approving'; readonly manifest: Manifest }
  | {
      readonly kind: 'running';
      readonly manifest: Manifest;
      readonly granted: readonly Permission[];
    }
  | { readonly kind: 'stopped'; readonly reason: string; readonly manifest: Manifest | null };

export type Scheduler = {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type SessionOptions = {
  /** Sends to the plugin's iframe; the DOM bridge wires this to postMessage. */
  readonly send: (message: HostMessage) => void;
  /** Asks the user. Resolves to the permissions granted, or null if declined. */
  readonly approve: (manifest: Manifest) => Promise<readonly Permission[] | null>;
  readonly api: Omit<ApiContext, 'pluginName'>;
  /** Security log: every dropped or refused message, with the reason. */
  readonly log: (message: string) => void;
  readonly onChange: (state: PluginState) => void;
  readonly scheduler?: Scheduler;
  readonly now?: () => number;
};

export type PluginSession = {
  /** A message from the plugin's iframe (already checked to come from it). */
  receive(raw: unknown): void;
  revoke(permission: Permission): void;
  /** Runs one of the commands the plugin declared; ignored unless it is running. */
  command(id: string): void;
  stop(reason: string): void;
  state(): PluginState;
};

const realScheduler: Scheduler = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/**
 * One running plugin, as seen by the host. The iframe sandbox keeps the plugin away
 * from the page; this keeps it away from everything else: each message is validated,
 * size- and rate-limited, and checked against the permissions the user granted.
 */
export function createPluginSession(options: SessionOptions): PluginSession {
  const { send, log, onChange } = options;
  const scheduler = options.scheduler ?? realScheduler;
  const now = options.now ?? (() => performance.now());
  let state: PluginState = { kind: 'loading' };
  const recentCalls: number[] = [];

  // A getter, so checks after an await see changes made meanwhile.
  const current = (): PluginState => state;
  const setState = (next: PluginState) => {
    state = next;
    onChange(next);
  };
  const manifestOf = (current: PluginState) =>
    current.kind === 'approving' || current.kind === 'running' ? current.manifest : null;
  const stop = (reason: string) => {
    if (state.kind === 'stopped') return;
    scheduler.clearTimeout(handshakeTimer);
    setState({ kind: 'stopped', reason, manifest: manifestOf(state) });
  };
  const refuse = (reason: string) => {
    log(reason);
    send(hostMessage({ type: 'refused', reason }));
    stop(reason);
  };

  const handshakeTimer = scheduler.setTimeout(() => {
    if (state.kind === 'loading') {
      refuse(`No handshake within ${String(LIMITS.handshakeTimeoutMs / 1000)} s.`);
    }
  }, LIMITS.handshakeTimeoutMs);

  const handshake = async (apiVersion: number, manifest: Manifest) => {
    if (state.kind !== 'loading') {
      log('Dropped a second handshake.');
      return;
    }
    scheduler.clearTimeout(handshakeTimer);
    if (!SUPPORTED_API_VERSIONS.includes(apiVersion)) {
      refuse(
        `${manifest.name} needs plugin API version ${String(apiVersion)}; this Inkframe supports ${SUPPORTED_API_VERSIONS.join(', ')}.`,
      );
      return;
    }
    send(hostMessage({ type: 'handshake-ok', apiVersion }));
    setState({ kind: 'approving', manifest });
    const approved = await options.approve(manifest);
    // Read fresh: the plugin may have been stopped while the user was deciding.
    if (current().kind !== 'approving') return;
    if (approved === null) {
      refuse(`${manifest.name} wasn't allowed to run.`);
      return;
    }
    const granted = manifest.permissions.filter((permission) => approved.includes(permission));
    setState({ kind: 'running', manifest, granted });
    send(hostMessage({ type: 'start', permissions: granted }));
  };

  const call = (id: number, method: keyof typeof METHOD_PERMISSION, params: unknown) => {
    const time = now();
    recentCalls.push(time);
    while ((recentCalls[0] ?? time) <= time - 1000) recentCalls.shift();
    if (recentCalls.length > LIMITS.maxCallsPerSecond) {
      refuse(`Stopped for flooding: over ${String(LIMITS.maxCallsPerSecond)} calls in a second.`);
      return;
    }
    const reply = (result: ReturnType<typeof callApi>) => {
      send(hostMessage({ type: 'result', id, ...result }));
    };
    if (state.kind !== 'running') {
      reply({ ok: false, error: { code: 'not-ready', message: 'The plugin has not started.' } });
      return;
    }
    const needed = METHOD_PERMISSION[method];
    if (!state.granted.includes(needed)) {
      log(`Rejected ${method}: "${needed}" is not granted.`);
      reply({
        ok: false,
        error: {
          code: 'permission-denied',
          message: `${method} needs the "${needed}" permission.`,
        },
      });
      return;
    }
    const result = callApi(method, params, { ...options.api, pluginName: state.manifest.name });
    if (!result.ok) log(`Rejected ${method}: ${result.error.message}`);
    reply(result);
  };

  return {
    receive(raw) {
      if (state.kind === 'stopped') return;
      const size = sizeOf(raw);
      if (size === null) {
        log('Dropped a message that is not plain data.');
        return;
      }
      if (size > LIMITS.maxMessageBytes) {
        log(`Rejected a ${String(Math.round(size / 1024))} KB message (limit 256 KB).`);
        const id = callIdOf(raw);
        if (id !== null) {
          send(
            hostMessage({
              type: 'result',
              id,
              ok: false,
              error: { code: 'too-large', message: 'Messages are limited to 256 KB.' },
            }),
          );
        }
        return;
      }
      const parsed = pluginMessageSchema.safeParse(raw);
      if (!parsed.success) {
        log('Dropped a message that does not match the protocol.');
        return;
      }
      const message = parsed.data;
      switch (message.type) {
        case 'handshake':
          void handshake(message.apiVersion, message.manifest);
          return;
        case 'call':
          call(message.id, message.method, message.params);
          return;
        case 'crashed':
          log(`Crashed: ${message.message}`);
          stop(`Crashed: ${message.message}`);
          return;
      }
    },
    revoke(permission) {
      if (state.kind === 'running') {
        setState({ ...state, granted: state.granted.filter((p) => p !== permission) });
      }
    },
    command(id) {
      if (state.kind !== 'running') return;
      if (!state.manifest.commands.some((command) => command.id === id)) {
        log(`Ignored unknown command "${id}".`);
        return;
      }
      send(hostMessage({ type: 'command', id }));
    },
    stop,
    state: () => state,
  };
}

/** Approximate bytes as JSON; null for data JSON can't hold (cycles, functions, …). */
function sizeOf(raw: unknown): number | null {
  try {
    // Typed as always a string, but undefined for undefined and functions.
    const json = JSON.stringify(raw) as string | undefined;
    return json === undefined ? null : json.length;
  } catch {
    return null;
  }
}

/** The call ID of an oversized message, so the plugin hears why it failed. */
function callIdOf(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { type, id } = raw as Record<string, unknown>;
  return type === 'call' && typeof id === 'number' && Number.isInteger(id) ? id : null;
}
