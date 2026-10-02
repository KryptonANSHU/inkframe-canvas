import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  alphaAt,
  canvas,
  chooseMenuItem,
  drag,
  EMPTY,
  FULL,
  nextFrame,
  notifications,
  openEditor,
} from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

/** A pixel on the top edge of the rectangle drawn by `drawRectangle`. */
const edge = [300, 200] as const;

async function drawRectangle(page: Page) {
  await page.keyboard.press('r');
  await drag(page, [200, 200], [400, 300]);
  await page.keyboard.press('Escape');
  await nextFrame(page);
}

async function edgeInk(page: Page) {
  await nextFrame(page);
  return alphaAt(page, ...edge);
}

test('the drawing survives a reload', async ({ page }) => {
  await drawRectangle(page);
  // Past the 500 ms autosave delay.
  await page.waitForTimeout(800);
  await page.reload();
  await expect.poll(() => edgeInk(page)).toBe(FULL);
});

test('Save as JSON, then Open brings the drawing back; undo un-opens it', async ({ page }) => {
  await drawRectangle(page);
  const download = page.waitForEvent('download');
  await chooseMenuItem(page, 'Save as JSON');
  const path = await (await download).path();

  // Undo the drawing, so the canvas is empty before opening the saved file.
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await edgeInk(page)).toBe(EMPTY);

  const chooser = page.waitForEvent('filechooser');
  await chooseMenuItem(page, 'Open…');
  await (await chooser).setFiles(path);
  await expect.poll(() => edgeInk(page)).toBe(FULL);
  expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({
    format: 'inkframe',
    version: 4,
  });

  await page.keyboard.press('ControlOrMeta+Z');
  expect(await edgeInk(page)).toBe(EMPTY);
});

test('a file Inkframe cannot open shows why, and leaves the drawing alone', async ({ page }) => {
  await drawRectangle(page);
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('ControlOrMeta+O');
  const shapes = Array.from({ length: 20_001 }, () => ({}));
  await (
    await chooser
  ).setFiles({
    name: 'huge.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'inkframe', version: 1, shapes })),
  });
  await expect(notifications(page)).toContainText('Inkframe opens up to 20,000');
  expect(await edgeInk(page)).toBe(FULL);
});

test.describe('without storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Like a private mode that blocks IndexedDB.
      IDBFactory.prototype.open = () => {
        throw new DOMException('Blocked', 'SecurityError');
      };
    });
    await page.reload();
  });

  test('shows the banner and keeps working in memory', async ({ page }) => {
    await expect(page.getByRole('alert')).toContainText('Autosave is off');
    await drawRectangle(page);
    expect(await edgeInk(page)).toBe(FULL);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save a copy' }).click();
    expect((await download).suggestedFilename()).toMatch(/^inkframe-\d{4}-\d{2}-\d{2}\.json$/);
    // The one expected console error: the editor saying why autosave is off.
    consoleProblems = consoleProblems.filter((problem) => !problem.includes('Autosave is off'));
  });
});
