import { expect, test } from '@playwright/test';
import { alphaAt, canvas, drag, EMPTY, FULL, nextFrame, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  // Also catches invariant violations, which the dev build reports as console errors.
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

/** A pixel on the rectangle's top edge, clear of its selection handles. */
const edge = [300, 200] as const;
/** The same pixel on a duplicate, which sits 10 units right and down. */
const duplicateEdge = [300, 210] as const;

async function inkAt(page: Parameters<typeof alphaAt>[0], [x, y]: readonly [number, number]) {
  // Deselect first so the selection frame doesn't count as ink, then wait for that frame.
  await page.keyboard.press('Escape');
  await nextFrame(page);
  return alphaAt(page, x, y);
}

test('undo, redo, delete, and duplicate', async ({ page }) => {
  await page.keyboard.press('r');
  await drag(page, [200, 200], [400, 300]);
  expect(await inkAt(page, edge)).toBe(FULL);

  await page.keyboard.press('ControlOrMeta+Z');
  expect(await inkAt(page, edge)).toBe(EMPTY);
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  // Redo also restores the selection, so Delete removes the shape.
  await page.keyboard.press('Delete');
  expect(await inkAt(page, edge)).toBe(EMPTY);

  await page.keyboard.press('ControlOrMeta+Z');
  await page.keyboard.press('ControlOrMeta+D');
  expect(await inkAt(page, edge)).toBe(FULL);
  expect(await inkAt(page, duplicateEdge)).toBe(FULL);
});
