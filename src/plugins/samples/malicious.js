// Security test plugin: a hostile plugin that tries every forbidden action. Every attempt
// must fail while the editor keeps working; the host's security log records each one.
// It reports a tally, then floods the host, which must stop it.
const MANIFEST = {
  id: 'malicious-test',
  name: 'Security test (malicious)',
  version: '1.0.0',
  // Deliberately not selection:read or shapes:update: it tries those anyway.
  permissions: ['shapes:create', 'notify'],
};
const ENVELOPE = { protocol: 'inkframe-plugin', version: 1 };

/** Each attack resolves to what it got: anything but undefined is a leak. */
const ATTACKS = {
  'read the host page': () => parent.document.title,
  'read the host URL': () => top.location.href,
  'read cookies': () => document.cookie,
  'read local storage': () => localStorage.getItem('inkframe.plugins.approvals'),
  'open IndexedDB': () => indexedDB.open('inkframe'),
  'reach the network': () => fetch('https://example.com/').then((response) => response.status),
  'navigate the editor away': () => {
    top.location.href = 'https://example.com/';
    return top.location.href;
  },
  'read the selection without permission': () => inkframe.selection.get(),
  'change shapes without permission': () =>
    inkframe.shapes.update([{ id: 'any', patch: { x: 0 } }]),
  'create a shape with NaN geometry': () =>
    inkframe.shapes.create([{ ...square(), x: Number.NaN }]),
  'inject markup through a color': () =>
    inkframe.shapes.create([
      { ...square(), style: { ...square().style, strokeColor: 'url(javascript:alert(1))' } },
    ]),
  'pollute Object.prototype': () =>
    inkframe.shapes.create([
      { ...square(), ...JSON.parse('{"__proto__": {"polluted": true}, "width": -5}') },
    ]),
  'create 501 shapes in one call': () =>
    inkframe.shapes.create(Array.from({ length: 501 }, square)),
  'send a 300 KB message': () => inkframe.notify('x'.repeat(300 * 1024)),
  'send HTML for the host to render': () =>
    inkframe.notify('<img src=x onerror="document.body.dataset.pwned = 1">').then(() => undefined),
};

/** Messages that bypass the SDK: each must be dropped, not answered. */
function sendForgedMessages() {
  parent.postMessage(
    {
      ...ENVELOPE,
      version: 99,
      type: 'call',
      id: 900,
      method: 'notify',
      params: { message: 'old protocol' },
    },
    '*',
  );
  parent.postMessage({ ...ENVELOPE, type: 'eval', code: 'alert(1)' }, '*');
  parent.postMessage({ ...ENVELOPE, type: 'call', id: 901, method: 'document.clear' }, '*');
  parent.postMessage(
    {
      ...ENVELOPE,
      type: 'handshake',
      apiVersion: 1,
      manifest: { ...MANIFEST, permissions: ['selection:read', 'shapes:update'] },
    },
    '*',
  );
}

function square() {
  return {
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    style: { strokeColor: '#1e2430', fillColor: null, strokeWidth: 2, opacity: 1 },
  };
}

/** Whether an attack got anything back. Errors and rejections count as blocked. */
async function attempt(attack) {
  try {
    const got = await attack();
    return got === undefined ? null : JSON.stringify(got).slice(0, 80);
  } catch {
    return null;
  }
}

inkframe.register(MANIFEST, async () => {
  const leaks = [];
  for (const [name, attack] of Object.entries(ATTACKS)) {
    const got = await attempt(attack);
    if (got !== null) leaks.push(`${name} (${got})`);
  }
  sendForgedMessages();
  const total = Object.keys(ATTACKS).length + 4;
  await inkframe.notify(
    leaks.length === 0
      ? `All ${total} attacks were blocked. Flooding the host next.`
      : `LEAKED: ${leaks.join('; ')}`.slice(0, 200),
  );
  // Last: more calls in a burst than the host allows. The host must stop this plugin.
  for (let i = 0; i < 200; i++) inkframe.selection.get().catch(() => undefined);
});
