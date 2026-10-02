import { expect, test, type Page } from '@playwright/test';
import {
  alphaAt,
  canvas,
  drag,
  EMPTY,
  FULL,
  nextFrame,
  notifications,
  openEditor,
} from './helpers';

/**
 * What the browser itself prints when the sandbox blocks a plugin: expected here, and
 * proof the block happened. Anything else in the console still fails the test.
 */
const SANDBOX_BLOCKS = [
  /violates the following Content Security Policy directive/,
  /Refused to connect because it violates the document's Content Security Policy/,
  /Unsafe attempt to initiate navigation .* sandboxed/,
];

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  const unexpected = consoleProblems.filter(
    (problem) => !SANDBOX_BLOCKS.some((pattern) => pattern.test(problem)),
  );
  expect(unexpected).toEqual([]);
});

const panel = (page: Page) => page.getByRole('dialog', { name: 'Plugins' });
const emptyHint = (page: Page) => page.getByText('Pick a tool or press');

async function openPanel(page: Page) {
  if (!(await panel(page).isVisible())) await page.getByRole('button', { name: 'Plugins' }).click();
  await expect(panel(page)).toBeVisible();
}

async function loadPlugin(page: Page, code: string, name = 'plugin.js') {
  await openPanel(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load plugin from file…' }).click();
  await (await chooser).setFiles({ name, mimeType: 'text/javascript', buffer: Buffer.from(code) });
}

/** Allows the pending plugin, then makes sure the panel is open again. */
async function allow(page: Page) {
  const dialog = page.getByRole('dialog', { name: /^Allow/ });
  await dialog.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await openPanel(page);
}

async function securityLog(page: Page) {
  await openPanel(page);
  const log = panel(page).locator('details');
  if ((await log.getAttribute('open')) === null) await log.locator('summary').click();
  return log;
}

test('the malicious plugin is blocked at every step, and the editor keeps working', async ({
  page,
}) => {
  // Something worth stealing, where a plugin with page access would find it.
  await page.evaluate(() => {
    localStorage.setItem('inkframe.secret', 'TOP-SECRET-7731');
    document.body.dataset['secret'] = 'TOP-SECRET-7731';
  });
  const url = page.url();

  await openPanel(page);
  await page.getByRole('button', { name: 'Run Security test (malicious)' }).click();
  await allow(page);
  await expect(notifications(page)).toContainText('All 19 attacks were blocked');
  await expect(panel(page)).toContainText('Stopped for flooding: over 50 calls in a second.');

  const log = await securityLog(page);
  for (const line of [
    'Rejected selection.get: "selection:read" is not granted.',
    'Rejected shapes.update: "shapes:update" is not granted.',
    'Rejected shapes.create: shapes[0]: x:',
    'Rejected shapes.create: shapes[0]: style.strokeColor:',
    'Rejected shapes.create: One call may change at most 500 shapes.',
    'Rejected a 300 KB message (limit 256 KB).',
    'Dropped a message that does not match the protocol. ×3',
    'Dropped a second handshake.',
  ]) {
    await expect(log).toContainText(line);
  }

  // Nothing leaked, ran, or changed on the host side.
  await expect(notifications(page)).not.toContainText('LEAKED');
  await expect(notifications(page)).not.toContainText('TOP-SECRET');
  await expect(notifications(page).locator('img')).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      pwned: document.body.dataset['pwned'] ?? null,
      polluted: (Object.prototype as Record<string, unknown>)['polluted'] ?? null,
      iframes: document.querySelectorAll('iframe').length,
    })),
  ).toEqual({ pwned: null, polluted: null, iframes: 0 });
  expect(page.url()).toBe(url);
  await expect(emptyHint(page)).toBeVisible();

  // The editor still draws and undoes.
  await page.getByRole('button', { name: 'Plugins' }).click();
  await expect(canvas(page)).toBeFocused();
  await page.keyboard.press('r');
  await drag(page, [200, 200], [400, 300]);
  await nextFrame(page);
  expect(await alphaAt(page, 300, 200)).toBe(FULL);
  await page.keyboard.press('ControlOrMeta+Z');
  await nextFrame(page);
  expect(await alphaAt(page, 300, 200)).toBe(EMPTY);
});

test('a plugin that never says hello is stopped after 3 s', async ({ page }) => {
  await loadPlugin(page, '// Never calls inkframe.register.', 'silent.js');
  await expect(panel(page)).toContainText('From a file · No handshake within 3 s.', {
    timeout: 5000,
  });
  expect(await page.locator('iframe').count()).toBe(0);
});

test('a plugin asking for an unsupported API version is refused', async ({ page }) => {
  await loadPlugin(
    page,
    `parent.postMessage({ protocol: 'inkframe-plugin', version: 1, type: 'handshake', apiVersion: 99,
      manifest: { id: 'future', name: 'Future plugin', version: '1.0.0', permissions: [] } }, '*');`,
  );
  await expect(panel(page)).toContainText(
    'Future plugin needs plugin API version 99; this Inkframe supports 1.',
  );
});

/** Adds a square on its command, and reports what happened. */
const SQUARE_COMMAND = `
inkframe.register({
  id: 'square-command', name: 'Square command', version: '1.0.0',
  permissions: ['shapes:create', 'notify'], commands: [{ id: 'add', label: 'Add square' }],
});
inkframe.onCommand(async () => {
  try {
    await inkframe.shapes.create([{ type: 'rectangle', x: 200, y: 200, width: 200, height: 100,
      rotation: 0, style: { strokeColor: '#1e2430', fillColor: null, strokeWidth: 2, opacity: 1 } }]);
    await inkframe.notify('Added');
  } catch (error) {
    await inkframe.notify('Blocked: ' + error.code);
  }
});
`;

test('a revoked permission fails the next call at once', async ({ page }) => {
  await loadPlugin(page, SQUARE_COMMAND);
  await allow(page);
  await page.getByRole('button', { name: 'Revoke Add shapes' }).click();
  await page.getByRole('button', { name: 'Add square' }).click();
  await expect(notifications(page)).toContainText('Square command: Blocked: permission-denied');
  await expect(await securityLog(page)).toContainText(
    'Rejected shapes.create: "shapes:create" is not granted.',
  );
  await expect(emptyHint(page)).toBeVisible();
});

test('messages from any other window are ignored', async ({ page }) => {
  await loadPlugin(page, SQUARE_COMMAND);
  await allow(page);
  await expect(panel(page)).toContainText('From a file · Running');
  // A forged call from the page itself and from an ordinary (unsandboxed) iframe.
  await page.evaluate(async () => {
    const forged = {
      protocol: 'inkframe-plugin',
      version: 1,
      type: 'call',
      id: 1,
      method: 'shapes.create',
      params: {
        shapes: [
          {
            type: 'rectangle',
            x: 200,
            y: 200,
            width: 200,
            height: 100,
            rotation: 0,
            style: { strokeColor: '#1e2430', fillColor: null, strokeWidth: 2, opacity: 1 },
          },
        ],
      },
    };
    window.postMessage(forged, '*');
    const other = document.createElement('iframe');
    document.body.append(other);
    other.contentWindow?.parent.postMessage(forged, '*');
    await new Promise((resolve) => setTimeout(resolve, 200));
    other.remove();
  });
  await expect(emptyHint(page)).toBeVisible();
  await expect(panel(page).locator('details')).toHaveCount(0);
});
