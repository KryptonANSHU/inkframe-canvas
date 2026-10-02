// The plugin SDK: runs inside the plugin's sandboxed iframe, before the plugin's code.
// Plain JavaScript (it is injected as source text, not bundled). It turns the
// postMessage protocol into promises; the host validates everything regardless, so
// nothing here is a security boundary.
(() => {
  const PROTOCOL = 'inkframe-plugin';
  const VERSION = 1;
  const API_VERSION = 1;
  const CALL_TIMEOUT_MS = 2000;
  let nextId = 0;
  let main = null;
  const pending = new Map();

  const post = (message) => {
    parent.postMessage({ protocol: PROTOCOL, version: VERSION, ...message }, '*');
  };
  const crash = (error) => {
    post({
      type: 'crashed',
      message: String(error && error.message ? error.message : error).slice(0, 500),
    });
  };

  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out after ${CALL_TIMEOUT_MS / 1000} s.`));
      }, CALL_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      post({ type: 'call', id, method, params });
    });

  addEventListener('message', (event) => {
    if (event.source !== parent) return;
    const message = event.data;
    if (!message || message.protocol !== PROTOCOL) return;
    if (message.type === 'result') {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.ok) request.resolve(message.value);
      else
        request.reject(
          Object.assign(new Error(message.error.message), { code: message.error.code }),
        );
    } else if (message.type === 'start' && main) {
      Promise.resolve()
        .then(() => main({ permissions: message.permissions }))
        .catch(crash);
    }
  });
  addEventListener('error', (event) => crash(event.error || event.message));
  addEventListener('unhandledrejection', (event) => crash(event.reason));

  globalThis.inkframe = Object.freeze({
    /** Declare the plugin and its main function, which runs once the user allows it. */
    register(manifest, run) {
      main = run;
      post({ type: 'handshake', apiVersion: API_VERSION, manifest });
    },
    selection: Object.freeze({ get: () => call('selection.get') }),
    shapes: Object.freeze({
      create: (shapes) => call('shapes.create', { shapes }),
      update: (updates) => call('shapes.update', { updates }),
    }),
    notify: (message) => call('notify', { message }),
  });
})();
