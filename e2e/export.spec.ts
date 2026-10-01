import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { canvas, drag, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

async function exportAs(page: Page, name: 'Export PNG' | 'Export SVG') {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name }).click();
  const file = await download;
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): [number, number] {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('PNG and SVG export the selection, or the whole drawing', async ({ page }) => {
  await page.keyboard.press('r');
  await drag(page, [200, 200], [400, 300]);
  await page.keyboard.press('t');
  await page.mouse.click(500, 200);
  await page.keyboard.type('Hello <world>');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Whole drawing: rectangle (200 × 100) and text, plus stroke and padding, at 2×.
  const all = await exportAs(page, 'Export PNG');
  expect(all.name).toMatch(/^inkframe-\d{4}-\d{2}-\d{2}\.png$/);
  const [allWidth] = pngSize(all.bytes);
  expect(allWidth).toBeGreaterThan(2 * 500);

  const svg = (await exportAs(page, 'Export SVG')).bytes.toString('utf8');
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  expect(svg).toContain('Hello &lt;world&gt;</tspan>');
  expect(svg).toContain('font/woff2;base64,');

  // Just the rectangle: 200 × 100, plus 2 of stroke and 16 of padding on each side, at 2×.
  await page.mouse.click(300, 200);
  expect(pngSize((await exportAs(page, 'Export PNG')).bytes)).toEqual([2 * 236, 2 * 136]);
});

test('exporting an empty canvas says there is nothing to export', async ({ page }) => {
  await page.getByRole('button', { name: 'Export PNG' }).click();
  await expect(page.getByRole('alert')).toContainText('nothing to export');
});
