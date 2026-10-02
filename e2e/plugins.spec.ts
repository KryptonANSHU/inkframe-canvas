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
  savedShapes,
} from './helpers';

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

async function drawRectangles(page: Page, ...boxes: [number, number, number, number][]) {
  for (const [x1, y1, x2, y2] of boxes) {
    await page.keyboard.press('r');
    await drag(page, [x1, y1], [x2, y2]);
  }
  await page.keyboard.press('ControlOrMeta+A');
}

/** Runs a built-in plugin and allows it; the panel stays open at its commands. */
async function runBuiltin(page: Page, name: string) {
  await page.getByRole('button', { name: 'Plugins' }).click();
  await page.getByRole('button', { name: `Run ${name}` }).click();
  const dialog = page.getByRole('dialog', { name: `Allow “${name}” to run?` });
  await expect(dialog).toContainText('built in');
  await dialog.getByRole('button', { name: 'Allow', exact: true }).click();
  return page.getByRole('group', { name: `${name} commands` });
}

/** Closes the panel with its toggle, which hands focus back to the canvas. */
async function closePanel(page: Page) {
  await page.getByRole('button', { name: 'Plugins' }).click();
  await expect(canvas(page)).toBeFocused();
}

test('Align and distribute lines up the selection as one undo step', async ({ page }) => {
  await drawRectangles(page, [200, 200, 300, 260], [450, 350, 600, 420], [700, 150, 760, 200]);
  const commands = await runBuiltin(page, 'Align and distribute');
  await commands.getByRole('button', { name: 'Align left' }).click();
  await closePanel(page);
  await expect.poll(async () => (await savedShapes(page)).map((s) => s.x)).toEqual([200, 200, 200]);

  await page.keyboard.press('ControlOrMeta+Z');
  expect((await savedShapes(page)).map((shape) => shape.x)).toEqual([200, 450, 700]);

  // Ends stay put; the 560-unit span less 310 of widths leaves two 125-unit gaps.
  await page.getByRole('button', { name: 'Plugins' }).click();
  await commands.getByRole('button', { name: 'Distribute horizontally' }).click();
  await closePanel(page);
  await expect.poll(async () => (await savedShapes(page)).map((s) => s.x)).toEqual([200, 425, 700]);
});

test('Random color palette recolors the selection', async ({ page }) => {
  await drawRectangles(page, [200, 200, 300, 260], [400, 200, 500, 260]);
  const commands = await runBuiltin(page, 'Random color palette');
  await commands.getByRole('button', { name: 'Recolor selection' }).click();
  await closePanel(page);
  await expect
    .poll(async () => new Set((await savedShapes(page)).map((s) => s.style.strokeColor)).size)
    .toBe(2);
  for (const shape of await savedShapes(page)) {
    expect(shape.style.strokeColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(shape.style.strokeColor).not.toBe('#1e2430');
    // No fill before, so none after.
    expect(shape.style.fillColor).toBeNull();
  }
});

test('Grid of shapes repeats the selection, and says how many it added', async ({ page }) => {
  await drawRectangles(page, [100, 100, 160, 140]);
  const commands = await runBuiltin(page, 'Grid of shapes');
  await commands.getByRole('button', { name: '3 × 3 grid' }).click();
  await expect(notifications(page)).toContainText('Grid of shapes: Added 8 shapes.');
  await closePanel(page);
  const shapes = await savedShapes(page);
  expect(shapes).toHaveLength(9);
  // Columns step by the width plus a 24-unit gap.
  expect(new Set(shapes.map((shape) => shape.x))).toEqual(new Set([100, 184, 268]));
});
