import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { canvas, drag, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

test('the shape list selects shapes from the keyboard, in sync with the canvas', async ({
  page,
}) => {
  await page.keyboard.press('r');
  await drag(page, [200, 200], [320, 280]);
  await page.keyboard.press('o');
  await drag(page, [400, 200], [500, 280]);
  await page.keyboard.press('Escape');

  // The list is the first stop after the canvas, and shows itself once focused.
  await page.keyboard.press('Tab');
  const list = page.getByRole('listbox', { name: 'Shapes, top first' });
  await expect(list).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Shapes (2)' })).toBeVisible();
  await expect(list.getByRole('option')).toHaveText([
    'Ellipse, 100 × 80 at 400, 200',
    'Rectangle, 120 × 80 at 200, 200',
  ]);

  // The polite announcement of what is selected (the opacity readout is a status too).
  const announcement = page.getByRole('status').filter({ hasText: /selected$/ });
  await page.keyboard.press('Space');
  await expect(announcement).toHaveText('Ellipse selected');
  await expect(page.getByRole('complementary', { name: 'Style' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+Space');
  await expect(announcement).toHaveText('2 shapes selected');
  await expect(list.getByRole('option', { selected: true })).toHaveCount(2);

  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual(
    [],
  );

  // Escape hands focus back to the canvas, selection kept; the list hides again.
  await page.keyboard.press('Escape');
  await expect(canvas(page)).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Shapes (2)' })).not.toBeInViewport();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Tab');
  await expect(page.getByText('No shapes yet.')).toBeAttached();
});
