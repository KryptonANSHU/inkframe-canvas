import { expect, test } from '@playwright/test';
import { alphaAt, canvas, drag, EMPTY, nextFrame, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

/** After a gesture, deselect and wait a frame so handles don't cover the pixels checked. */
async function settle(page: Parameters<typeof nextFrame>[0]) {
  await page.keyboard.press('Escape');
  await nextFrame(page);
}

// Each test draws the rectangle (200,200)–(400,300); drawing leaves it selected.
test('dragging the bottom-right handle resizes from the opposite corner', async ({ page }) => {
  await page.keyboard.press('r');
  await drag(page, [200, 200], [400, 300]);
  await drag(page, [400, 300], [500, 400]);
  await settle(page);

  // Now (200,200)–(500,400): the bottom edge moved from y 300 to y 400.
  expect(await alphaAt(page, 450, 400)).toBeGreaterThan(0);
  expect(await alphaAt(page, 500, 350)).toBeGreaterThan(0);
  expect(await alphaAt(page, 250, 200)).toBeGreaterThan(0);
  expect(await alphaAt(page, 300, 300)).toBe(EMPTY);
});

test('dragging the rotation handle turns the shape around its center', async ({ page }) => {
  await page.keyboard.press('r');
  await drag(page, [200, 200], [400, 300]);
  // The rotation handle is 24 px above the top-center: (300, 176). The center is (300, 250).
  // Dragging it to the right of the center turns the shape a quarter turn.
  await drag(page, [300, 176], [376, 250], 10);
  await settle(page);

  // Turned 90°: now x 250–350, y 150–350.
  expect(await alphaAt(page, 250, 300)).toBeGreaterThan(0);
  expect(await alphaAt(page, 300, 150)).toBeGreaterThan(0);
  expect(await alphaAt(page, 220, 200)).toBe(EMPTY);
  expect(await alphaAt(page, 380, 300)).toBe(EMPTY);
});

test('a lone line is edited by dragging one of its ends', async ({ page }) => {
  await page.keyboard.press('l');
  await drag(page, [200, 200], [400, 200]);
  await drag(page, [400, 200], [400, 300]);
  await settle(page);

  // From (200,200) to (400,300) now: its midpoint is (300,250).
  expect(await alphaAt(page, 300, 250)).toBeGreaterThan(0);
  expect(await alphaAt(page, 350, 200)).toBe(EMPTY);
});
