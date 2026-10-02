import { expect, test } from '@playwright/test';
import { canvas, chooseMenuItem, drag, notifications, openEditor, savedShapes } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

const welcome = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Draw diagrams that stay crisp' });

test('the welcome panel loads a template as one undo step', async ({ page }) => {
  await expect(welcome(page)).toBeVisible();
  await page.getByRole('button', { name: /Web app architecture/ }).click();
  await expect(welcome(page)).toHaveCount(0);
  const shapes = await savedShapes(page);
  expect(shapes.length).toBeGreaterThan(20);
  expect(shapes.some((shape) => shape.type === 'arrow' && shape.start !== undefined)).toBe(true);

  await canvas(page).focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(welcome(page)).toBeVisible();
});

test('picking a drawing tool or Start blank gets the panel out of the way', async ({ page }) => {
  await page.getByRole('button', { name: 'Start blank' }).click();
  await expect(welcome(page)).toHaveCount(0);
  await page.reload();
  await expect(welcome(page)).toBeVisible();
  await canvas(page).focus();
  await page.keyboard.press('r');
  await expect(welcome(page)).toHaveCount(0);
  await drag(page, [200, 200], [300, 260]);
  expect(await savedShapes(page)).toHaveLength(1);
});

test('the menu loads a template over a drawing, and undo brings the drawing back', async ({
  page,
}) => {
  await canvas(page).focus();
  await page.keyboard.press('r');
  await drag(page, [200, 200], [300, 260]);
  await chooseMenuItem(page, 'Release workflow');
  await expect(notifications(page)).toContainText('Loaded “Release workflow”');
  expect((await savedShapes(page)).some((shape) => shape.type === 'pen')).toBe(true);
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await savedShapes(page)).toHaveLength(1);
});
