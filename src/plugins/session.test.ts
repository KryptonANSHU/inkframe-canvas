import { describe, expect, it, vi } from 'vitest';
import { undo } from '../core/commands';
import { documentFromShapes } from '../core/persistence/fileFormat';
import { createEditorStore } from '../core/store';
import { fakeMeasurer, makeRect, testShapeId } from '../core/testing/factories';
import {
  LIMITS,
  PROTOCOL,
  PROTOCOL_VERSION,
  type HostMessage,
  type Manifest,
  type Permission,
} from './protocol';
import { createPluginSession, type Scheduler } from './session';

const manifest: Manifest = {
  id: 'grid-maker',
  name: 'Grid maker',
  version: '1.0.0',
  permissions: ['selection:read', 'shapes:create', 'notify'],
  commands: [{ id: 'small', label: 'Small grid' }],
};
const envelope = { protocol: PROTOCOL, version: PROTOCOL_VERSION };
const handshake = (apiVersion = 1) => ({ ...envelope, type: 'handshake', apiVersion, manifest });
const call = (id: number, method: string, params?: unknown) => ({
  ...envelope,
  type: 'call',
  id,
  method,
  params,
});
const rect = makeRect({ id: testShapeId('existing') });
/** A valid shape as a plugin would send it: no meaningful ID. */
const newRect = {
  type: 'rectangle',
  x: 10,
  y: 10,
  width: 50,
  height: 40,
  rotation: 0,
  style: rect.style,
};

function manualScheduler() {
  const timers: (() => void)[] = [];
  const scheduler: Scheduler = {
    setTimeout: (callback) => timers.push(callback),
    clearTimeout: (handle) => {
      const index = (handle as number) - 1;
      timers[index] = () => undefined;
    },
  };
  return {
    scheduler,
    fire: () => {
      for (const timer of timers) timer();
    },
  };
}

function setup(approve: (m: Manifest) => readonly Permission[] | null = (m) => m.permissions) {
  const store = createEditorStore({
    document: documentFromShapes([rect]),
    selectedIds: new Set([rect.id]),
  });
  const sent: HostMessage[] = [];
  const log = vi.fn<(message: string) => void>();
  const notify = vi.fn<(message: string) => void>();
  const timers = manualScheduler();
  let time = 0;
  const session = createPluginSession({
    send: (message) => sent.push(message),
    approve: (m) => Promise.resolve(approve(m)),
    api: { store, measurer: fakeMeasurer, notify },
    log,
    onChange: () => undefined,
    scheduler: timers.scheduler,
    now: () => time,
  });
  const results = () => sent.filter((message) => message.type === 'result');
  const lastResult = () => results().at(-1);
  const start = async () => {
    session.receive(handshake());
    await Promise.resolve();
  };
  return {
    store,
    session,
    sent,
    log,
    notify,
    timers,
    lastResult,
    start,
    tick: (ms: number) => {
      time += ms;
    },
  };
}

describe('plugin lifecycle', () => {
  it('handshake → approval → start, with only the approved permissions', async () => {
    const { session, sent, start } = setup(() => ['shapes:create', 'notify', 'shapes:update']);
    await start();
    expect(sent.map((message) => message.type)).toEqual(['handshake-ok', 'start']);
    // Granted = asked for ∩ approved: shapes:update was never requested.
    expect(session.state()).toMatchObject({
      kind: 'running',
      granted: ['shapes:create', 'notify'],
    });
  });

  it('stops a plugin that misses the handshake', () => {
    const { session, sent, timers } = setup();
    timers.fire();
    expect(session.state()).toMatchObject({ kind: 'stopped', reason: 'No handshake within 3 s.' });
    expect(sent).toEqual([expect.objectContaining({ type: 'refused' })]);
  });

  it('refuses an unsupported API version with a clear message', () => {
    const { session } = setup();
    session.receive(handshake(9));
    expect(session.state()).toMatchObject({
      kind: 'stopped',
      reason: expect.stringMatching(/API version 9; this Inkframe supports 1/) as unknown,
    });
  });

  it('refuses a plugin the user declines', async () => {
    const { session, start } = setup(() => null);
    await start();
    expect(session.state()).toMatchObject({
      kind: 'stopped',
      reason: "Grid maker wasn't allowed to run.",
    });
  });

  it('stops on a crash report and ignores everything after', async () => {
    const { session, sent, start } = setup();
    await start();
    session.receive({ ...envelope, type: 'crashed', message: 'TypeError' });
    session.receive(call(1, 'notify', { message: 'hi' }));
    expect(session.state()).toMatchObject({ kind: 'stopped', reason: 'Crashed: TypeError' });
    expect(sent.filter((message) => message.type === 'result')).toEqual([]);
  });
});

describe('message checks', () => {
  it.each([
    ['another protocol', { ...handshake(), protocol: 'evil' }],
    ['an unknown type', { ...envelope, type: 'eval', code: 'alert(1)' }],
    ['an unknown method', call(1, 'document.cookie')],
    ['a bad manifest', { ...handshake(), manifest: { ...manifest, id: 'Bad ID!' } }],
    ['a non-object', 'hello'],
  ])('drops %s and logs it', (_name, raw) => {
    const { session, sent, log } = setup();
    session.receive(raw);
    expect(sent).toEqual([]);
    expect(log).toHaveBeenCalledWith('Dropped a message that does not match the protocol.');
  });

  it('drops messages that are not plain data', () => {
    const { session, log } = setup();
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    session.receive(cyclic);
    expect(log).toHaveBeenCalledWith('Dropped a message that is not plain data.');
  });

  it('rejects calls before the plugin has started', () => {
    const { session, lastResult } = setup();
    session.receive(call(1, 'notify', { message: 'early' }));
    expect(lastResult()).toMatchObject({ id: 1, ok: false, error: { code: 'not-ready' } });
  });

  it('rejects calls outside the granted permissions, and after a revoke', async () => {
    const { session, lastResult, log, notify, start } = setup();
    await start();
    session.receive(call(1, 'shapes.update', { updates: [] }));
    expect(lastResult()).toMatchObject({ id: 1, ok: false, error: { code: 'permission-denied' } });
    expect(log).toHaveBeenCalledWith('Rejected shapes.update: "shapes:update" is not granted.');

    session.revoke('notify');
    session.receive(call(2, 'notify', { message: 'hi' }));
    expect(lastResult()).toMatchObject({ id: 2, error: { code: 'permission-denied' } });
    expect(notify).not.toHaveBeenCalled();
  });

  it('rejects oversized messages, telling the plugin why', async () => {
    const { session, lastResult, start } = setup();
    await start();
    session.receive(call(7, 'notify', { message: 'x'.repeat(LIMITS.maxMessageBytes) }));
    expect(lastResult()).toMatchObject({ id: 7, ok: false, error: { code: 'too-large' } });
  });

  it('stops a plugin that floods the host', async () => {
    const { session, start, tick } = setup();
    await start();
    for (let i = 0; i <= LIMITS.maxCallsPerSecond; i++) {
      session.receive(call(i, 'selection.get'));
      tick(5);
    }
    expect(session.state()).toMatchObject({
      kind: 'stopped',
      reason: expect.stringMatching(/flooding/) as unknown,
    });
  });

  it('allows a steady rate under the limit', async () => {
    const { session, start, tick } = setup();
    await start();
    for (let i = 0; i < LIMITS.maxCallsPerSecond * 3; i++) {
      session.receive(call(i, 'selection.get'));
      tick(25);
    }
    expect(session.state().kind).toBe('running');
  });
});

describe('plugin API', () => {
  it('reads the selection', async () => {
    const { session, lastResult, start } = setup();
    await start();
    session.receive(call(1, 'selection.get'));
    expect(lastResult()).toMatchObject({ ok: true, value: [rect] });
  });

  it('creates shapes with fresh IDs, as one undo step named after the plugin', async () => {
    const { session, store, lastResult, start } = setup();
    await start();
    session.receive(call(1, 'shapes.create', { shapes: [{ ...newRect, id: rect.id }, newRect] }));
    const result = lastResult();
    expect(result).toMatchObject({ ok: true });
    const ids = result?.type === 'result' && result.ok ? (result.value as string[]) : [];
    expect(ids).toHaveLength(2);
    // The plugin claimed an existing ID; the host ignored it.
    expect(ids).not.toContain(rect.id);
    expect(store.getState().document.order).toHaveLength(3);
    expect(store.getState().history.past.at(-1)?.command.label).toBe('Grid maker: Create shapes');
    undo(store);
    expect(store.getState().document.order).toEqual([rect.id]);
  });

  it('refuses invalid shapes, unsafe colors, and too many shapes, changing nothing', async () => {
    const { session, store, lastResult, start } = setup();
    await start();
    session.receive(call(1, 'shapes.create', { shapes: [{ ...newRect, width: -5 }] }));
    expect(lastResult()).toMatchObject({
      error: {
        code: 'invalid-params',
        message: expect.stringMatching(/shapes\[0\].*width/) as unknown,
      },
    });
    const injected = { ...newRect, style: { ...newRect.style, strokeColor: 'red"/><script>' } };
    session.receive(call(2, 'shapes.create', { shapes: [injected] }));
    expect(lastResult()).toMatchObject({ error: { code: 'invalid-params' } });
    const many = Array.from({ length: LIMITS.maxShapesPerCall + 1 }, () => newRect);
    session.receive(call(3, 'shapes.create', { shapes: many }));
    expect(lastResult()).toMatchObject({ error: { code: 'too-many-shapes' } });
    expect(store.getState().document.order).toEqual([rect.id]);
  });

  it("updates shapes by patch, but never a shape's ID, type, or order", async () => {
    const { session, store, lastResult } = setup(() => ['shapes:update']);
    session.receive({ ...handshake(), manifest: { ...manifest, permissions: ['shapes:update'] } });
    await Promise.resolve();
    const patch = { x: 300, type: 'ellipse', id: 'hijack', style: { strokeColor: '#d63a45' } };
    session.receive(call(1, 'shapes.update', { updates: [{ id: rect.id, patch }] }));
    expect(lastResult()).toMatchObject({ ok: true });
    expect(store.getState().document.shapes.get(rect.id)).toMatchObject({
      type: 'rectangle',
      x: 300,
      style: { strokeColor: '#d63a45', strokeWidth: rect.style.strokeWidth },
    });
    session.receive(call(2, 'shapes.update', { updates: [{ id: 'missing', patch: {} }] }));
    expect(lastResult()).toMatchObject({ error: { code: 'not-found' } });
  });

  it('passes notifications to the user', async () => {
    const { session, notify, start } = setup();
    await start();
    session.receive(call(1, 'notify', { message: 'Grid ready' }));
    expect(notify).toHaveBeenCalledWith('Grid ready');
  });
});

describe('plugin commands', () => {
  it('sends a declared command to a running plugin only', async () => {
    const { session, sent, log, start } = setup();
    session.command('small');
    expect(sent).toEqual([]);
    await start();
    session.command('small');
    session.command('delete-everything');
    expect(sent.filter((message) => message.type === 'command')).toEqual([
      expect.objectContaining({ id: 'small' }),
    ]);
    expect(log).toHaveBeenCalledWith('Ignored unknown command "delete-everything".');
  });

  it('refuses a manifest with duplicate or too many commands', () => {
    const { session, log } = setup();
    const commands = Array.from({ length: 9 }, (_, i) => ({ id: `c${String(i)}`, label: 'C' }));
    session.receive({ ...handshake(), manifest: { ...manifest, commands } });
    const twice = [commands[0], commands[0]];
    session.receive({ ...handshake(), manifest: { ...manifest, commands: twice } });
    expect(session.state().kind).toBe('loading');
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('gives selected shapes their world bounds', async () => {
    const { session, start, lastResult } = setup();
    await start();
    session.receive(call(1, 'selection.get'));
    expect(lastResult()).toMatchObject({
      value: [{ id: rect.id, bounds: { x: rect.x, y: rect.y, width: 100, height: 50 } }],
    });
  });
});
