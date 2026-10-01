import { expect, test } from '@playwright/test';
import { canvas, drag, inkedPixels, nextFrame, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

test('the canvas starts focused, without a focus ring', async ({ page }) => {
  await expect(canvas(page)).toBeFocused();
  expect(await canvas(page).evaluate((element) => element.matches(':focus-visible'))).toBe(false);
});

// Regression: the first shortcut used to be ignored until the canvas was clicked, so
// that click's drag was a marquee with the select tool and vanished on release.
test('a tool shortcut works right after load, before any click', async ({ page }) => {
  await page.keyboard.press('p');
  await drag(page, [200, 200], [400, 300]);
  // Read after the release has been drawn: until then a marquee would still show.
  await nextFrame(page);

  expect(await inkedPixels(page, 190, 190, 220, 120)).toBeGreaterThan(100);
});
