import { expect, test } from '@playwright/test';
import { canvas, drag, nextFrame, openEditor, pixelAt } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

const background = (page: Parameters<typeof openEditor>[0]) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('follows the system dark theme, with light ink on the canvas', async ({ page }) => {
  expect(await background(page)).toBe('rgb(24, 27, 33)');
  await page.keyboard.press('r');
  await drag(page, [200, 200], [400, 300]);
  await page.keyboard.press('Escape');
  await nextFrame(page);
  // The default ink (#1E2430) is drawn as dark-theme ink (#E7EAF0).
  await expect.poll(() => pixelAt(page, 300, 200)).toEqual([231, 234, 240, 255]);
});

test('data-theme on <html> overrides the system theme', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.dataset['theme'] = 'light';
  });
  expect(await background(page)).toBe('rgb(243, 245, 248)');
});
