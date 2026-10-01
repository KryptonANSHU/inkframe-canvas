import { expect, test, type Page } from '@playwright/test';
import { alphaAt, canvas, drag, EMPTY, nextFrame, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  // Shortcuts work only while the canvas has focus.
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

async function useTool(page: Page, shortcut: string) {
  await page.keyboard.press(shortcut);
}

/**
 * Drawing selects the new shape; Escape clears it so the selection outline
 * doesn't cover the pixels these tests inspect.
 */
async function drawAndDeselect(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  await drag(page, from, to);
  await page.keyboard.press('Escape');
  // Until the deselect is drawn, the old frame still shows handles on the box corners.
  await nextFrame(page);
}

test('O draws an ellipse: on its outline, not in the box corners', async ({ page }) => {
  await useTool(page, 'o');
  await drawAndDeselect(page, [200, 200], [400, 300]);

  await expect.poll(() => alphaAt(page, 300, 200)).toBeGreaterThan(200);
  expect(await alphaAt(page, 400, 250)).toBeGreaterThan(200);
  // A rectangle inks its corner pixel (see the R test); an ellipse leaves it empty.
  expect(await alphaAt(page, 200, 200)).toBe(EMPTY);
  expect(await alphaAt(page, 300, 250)).toBe(EMPTY);
});

test('L draws a line from the press point to the release point', async ({ page }) => {
  await useTool(page, 'l');
  await drawAndDeselect(page, [200, 200], [400, 300]);

  await expect.poll(() => alphaAt(page, 300, 250)).toBeGreaterThan(200);
  expect(await alphaAt(page, 300, 200)).toBe(EMPTY);
  expect(await alphaAt(page, 200, 300)).toBe(EMPTY);
});

// A horizontal shaft from (200, 300) to (400, 300). Its head is 14 units long at ±π/7,
// so the upper wing passes through about (391, 295.7); the shaft alone never reaches y 295.
const WING_PIXEL = [391, 295] as const;

test('A draws an arrow with a head at the release end', async ({ page }) => {
  await useTool(page, 'a');
  await drawAndDeselect(page, [200, 300], [400, 300]);

  await expect.poll(() => alphaAt(page, 300, 300)).toBeGreaterThan(200);
  expect(await alphaAt(page, ...WING_PIXEL)).toBeGreaterThan(0);
  // No head at the start.
  expect(await alphaAt(page, 209, 295)).toBe(EMPTY);
});

test('a line drawn the same way has no head', async ({ page }) => {
  await useTool(page, 'l');
  await drawAndDeselect(page, [200, 300], [400, 300]);

  await expect.poll(() => alphaAt(page, 300, 300)).toBeGreaterThan(200);
  expect(await alphaAt(page, ...WING_PIXEL)).toBe(EMPTY);
});

test('P draws a freehand stroke that follows the pointer', async ({ page }) => {
  await useTool(page, 'p');
  await page.mouse.move(200, 400);
  await page.mouse.down();
  await page.mouse.move(300, 450, { steps: 20 });
  await page.mouse.move(400, 400, { steps: 20 });
  await page.mouse.up();

  // Midpoints of both straight legs are inked; the inside of the V is not.
  await expect.poll(() => alphaAt(page, 250, 425)).toBeGreaterThan(200);
  expect(await alphaAt(page, 350, 425)).toBeGreaterThan(200);
  expect(await alphaAt(page, 300, 420)).toBe(EMPTY);
});

test('R switches back to rectangles after another tool', async ({ page }) => {
  await useTool(page, 'o');
  await useTool(page, 'r');
  await drawAndDeselect(page, [200, 200], [400, 300]);

  // The corner pixel: inked by a rectangle, empty for an ellipse.
  await expect.poll(() => alphaAt(page, 200, 200)).toBeGreaterThan(200);
});
