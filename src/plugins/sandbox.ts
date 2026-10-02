import sdkSource from './runtime/sdk.js?raw';
import type { HostMessage } from './protocol';
import type { PluginSession } from './session';

/**
 * Plugin code inside a sandboxed iframe: `allow-scripts` only, never
 * `allow-same-origin`, and loaded through `srcdoc`, so it gets an opaque origin and can
 * reach neither this page nor its storage. The page's CSP inside blocks all network
 * access as well; the only way out is postMessage, which the host validates.
 */
export function pluginDocument(code: string): string {
  return [
    '<!doctype html>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'">`,
    `<script>${scriptSafe(sdkSource)}</script>`,
    `<script>${scriptSafe(code)}</script>`,
  ].join('\n');
}

/** Code can't end its own <script> early: "</script" would break out of the element. */
function scriptSafe(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

export type SandboxedPlugin = {
  readonly session: PluginSession;
  /** Removes the iframe (ending the plugin) and stops the session. */
  dispose(reason: string): void;
};

/**
 * Starts `code` in a new sandboxed iframe inside `container`. Messages count only if
 * they come from that exact iframe's window: any other sender is ignored.
 */
export function runInSandbox(
  code: string,
  container: HTMLElement,
  createSession: (send: (message: HostMessage) => void) => PluginSession,
): SandboxedPlugin {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.title = 'Plugin sandbox';
  frame.hidden = true;
  frame.srcdoc = pluginDocument(code);
  // The sandboxed document has an opaque origin, so '*' is the only target that reaches
  // it; it only ever receives replies to its own calls.
  const session = createSession((message) => {
    frame.contentWindow?.postMessage(message, '*');
  });
  const onMessage = (event: MessageEvent) => {
    if (event.source !== null && event.source === frame.contentWindow) {
      session.receive(event.data);
    }
  };
  window.addEventListener('message', onMessage);
  container.append(frame);
  return {
    session,
    dispose(reason) {
      window.removeEventListener('message', onMessage);
      frame.remove();
      session.stop(reason);
    },
  };
}
