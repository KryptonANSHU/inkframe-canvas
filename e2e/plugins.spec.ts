import { expect, test } from '@playwright/test';
import { alphaAt, canvas, EMPTY, FULL, nextFrame, notifications, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

/** A plugin as a user would load it: plain JavaScript using the SDK. */
const SQUARE_PLUGIN = `
inkframe.register(
  { id: 'square-maker', name: 'Square maker', version: '1.0.0', permissions: ['shapes:create', 'notify'] },
  async () => {
    await inkframe.shapes.create([{
      type: 'rectangle', x: 200, y: 200, width: 200, height: 100, rotation: 0,
      style: { strokeColor: '#1e2430', fillColor: null, strokeWidth: 2, opacity: 1 },
    }]);
    await inkframe.notify('Square added');
  },
);
`;

test('a plugin from a file asks first, then adds a shape as one undo step', async ({ page }) => {
  await page.getByRole('button', { name: 'Plugins' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load plugin from file…' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'square.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(SQUARE_PLUGIN),
  });

  const dialog = page.getByRole('dialog', { name: 'Allow “Square maker” to run?' });
  await expect(dialog).toContainText('from a file you loaded');
  await expect(dialog).toContainText('Add shapes to your drawing');
  await dialog.getByRole('button', { name: 'Allow', exact: true }).click();

  await expect(notifications(page)).toContainText('Square maker: Square added');
  await nextFrame(page);
  await expect.poll(() => alphaAt(page, 300, 200)).toBe(FULL);

  await page.getByRole('button', { name: 'Plugins' }).click();
  await expect(page.getByText('From a file · Running')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Permissions' })).toContainText('Add shapes');
  // Toggle closed (Escape could go to the visible toast first).
  await page.getByRole('button', { name: 'Plugins' }).click();
  // The panel hands focus back to the canvas as it closes.
  await expect(canvas(page)).toBeFocused();

  await page.keyboard.press('ControlOrMeta+Z');
  await nextFrame(page);
  expect(await alphaAt(page, 300, 200)).toBe(EMPTY);
});
