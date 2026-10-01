import { expect, test, type Page } from '@playwright/test';
import { alphaAt, canvas, drag, EMPTY, isSelectionBlue, nextFrame, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

/** Draws a rectangle; drawing leaves it selected and the select tool active. */
async function drawRectangle(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  await page.keyboard.press('r');
  await drag(page, from, to);
}

// Rectangle A: (200,200)–(400,300). Rectangle B: (500,200)–(600,300).
// Edge samples avoid corners and edge midpoints, where white resize handles sit.
async function drawTwo(page: Page) {
  await drawRectangle(page, [200, 200], [400, 300]);
  await drawRectangle(page, [500, 200], [600, 300]);
  await page.keyboard.press('Escape');
}

test('a new shape is selected, and clicking empty canvas deselects it', async ({ page }) => {
  await drawRectangle(page, [200, 200], [400, 300]);
  await expect.poll(() => isSelectionBlue(page, 250, 200)).toBe(true);

  await page.mouse.click(700, 500);
  await expect.poll(() => isSelectionBlue(page, 250, 200)).toBe(false);
  expect(await alphaAt(page, 250, 200)).toBeGreaterThan(0);
});

test('click selects, Shift + click adds, Escape clears', async ({ page }) => {
  await drawTwo(page);
  await page.mouse.click(300, 200);
  await expect.poll(() => isSelectionBlue(page, 250, 300)).toBe(true);
  expect(await isSelectionBlue(page, 525, 300)).toBe(false);

  await page.keyboard.down('Shift');
  await page.mouse.click(550, 200);
  await page.keyboard.up('Shift');
  await expect.poll(() => isSelectionBlue(page, 525, 300)).toBe(true);
  expect(await isSelectionBlue(page, 250, 300)).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(() => isSelectionBlue(page, 525, 300)).toBe(false);
});

test('a marquee selects only the shapes fully inside it', async ({ page }) => {
  await drawTwo(page);
  await drag(page, [150, 150], [450, 350]);
  await expect.poll(() => isSelectionBlue(page, 250, 300)).toBe(true);
  expect(await isSelectionBlue(page, 525, 300)).toBe(false);
});

test('dragging a shape moves it; the old place is left empty', async ({ page }) => {
  await drawTwo(page);
  await drag(page, [300, 200], [400, 250]);
  // The top edge moved from y 200 (x 200–400) to y 250 (x 300–500).
  await expect.poll(() => alphaAt(page, 450, 250)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await nextFrame(page);
  expect(await alphaAt(page, 250, 200)).toBe(EMPTY);
});

test('Escape during a drag puts the shape back', async ({ page }) => {
  await drawTwo(page);
  await page.mouse.move(300, 200);
  await page.mouse.down();
  await page.mouse.move(400, 260, { steps: 5 });
  await expect.poll(() => alphaAt(page, 300, 200)).toBe(EMPTY);

  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect.poll(() => alphaAt(page, 300, 200)).toBeGreaterThan(0);
  // Where the moved copy's top edge was (x 300–500 at y 260), clear of the original.
  expect(await alphaAt(page, 450, 260)).toBe(EMPTY);
});

test('arrow keys nudge the selection, Shift + arrow by 10', async ({ page }) => {
  await drawRectangle(page, [200, 200], [400, 300]);
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  // Until the deselect is drawn, the rotation handle (24 px above the edge) covers y 200.
  await nextFrame(page);
  // 21 units down: the top edge is now at y 221.
  await expect.poll(() => alphaAt(page, 300, 221)).toBeGreaterThan(0);
  expect(await alphaAt(page, 300, 200)).toBe(EMPTY);
});

test('Alt + click cycles to the shape underneath', async ({ page }) => {
  // B sits on top of A and shares A's top-left corner, so (250, 200) is on both top edges.
  await drawRectangle(page, [200, 200], [400, 300]);
  await drawRectangle(page, [200, 200], [300, 250]);
  await page.keyboard.press('Escape');

  await page.keyboard.down('Alt');
  await page.mouse.click(250, 200);
  // B is selected: its bottom edge (y 250) is blue, A's (y 300) is not.
  await expect.poll(() => isSelectionBlue(page, 230, 250)).toBe(true);
  expect(await isSelectionBlue(page, 350, 300)).toBe(false);

  await page.mouse.click(250, 200);
  await page.keyboard.up('Alt');
  await expect.poll(() => isSelectionBlue(page, 350, 300)).toBe(true);
  expect(await isSelectionBlue(page, 230, 250)).toBe(false);
});
