import { expect, test, type Page } from '@playwright/test';
import { canvas, inkedPixels, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
  await page.keyboard.press('t');
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

const textbox = (page: Page) => page.getByRole('textbox', { name: 'Text' });
/** Ink in the first line of a text box placed at (200, 200). */
const firstLineInk = (page: Page) => inkedPixels(page, 200, 200, 200, 26);

test('loads Instrument Sans with the FontFace API', async ({ page }) => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts].some(
          (face) => face.family.includes('Instrument Sans') && face.status === 'loaded',
        ),
      ),
    )
    .toBe(true);
});

test('click, type, Escape: the text is drawn and the canvas has focus again', async ({ page }) => {
  await page.mouse.click(200, 200);
  await expect(textbox(page)).toBeFocused();
  await page.keyboard.type('Hello world');
  await page.keyboard.press('Escape');

  await expect(textbox(page)).toHaveCount(0);
  await expect.poll(() => firstLineInk(page)).toBeGreaterThan(100);
  await expect(canvas(page)).toBeFocused();
});

test('the textarea sits exactly where the text will be drawn', async ({ page }) => {
  await page.mouse.click(200, 200);
  const box = await textbox(page).boundingBox();
  expect(box?.x).toBe(200);
  expect(box?.y).toBe(200);
  expect(box?.width).toBe(240);
  await expect(textbox(page)).toHaveCSS('font-size', '20px');
});

test('clicking away commits the text without opening another box', async ({ page }) => {
  await page.mouse.click(200, 200);
  await page.keyboard.type('Hi');
  await page.mouse.click(600, 400);

  await expect(textbox(page)).toHaveCount(0);
  await expect.poll(() => firstLineInk(page)).toBeGreaterThan(20);
});

test('Escape on an empty box creates nothing', async ({ page }) => {
  await page.mouse.click(200, 200);
  await page.keyboard.press('Escape');
  await expect(textbox(page)).toHaveCount(0);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  expect(await firstLineInk(page)).toBe(0);
});

test('long text wraps inside the 240-unit box', async ({ page }) => {
  await page.mouse.click(200, 200);
  await page.keyboard.type('The quick brown fox jumps over the lazy dog');
  await page.keyboard.press('Control+Enter');

  await expect.poll(() => firstLineInk(page)).toBeGreaterThan(100);
  // A second line exists below the first...
  expect(await inkedPixels(page, 200, 230, 240, 20)).toBeGreaterThan(50);
  // ...and nothing runs past the right edge of the box.
  expect(await inkedPixels(page, 442, 195, 200, 60)).toBe(0);
});
