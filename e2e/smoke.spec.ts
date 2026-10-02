import { expect, test } from '@playwright/test';

test('app loads with no console errors or warnings', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    problems.push(`pageerror: ${error.message}`);
  });

  await page.goto('/');

  await expect(page).toHaveTitle('Inkframe');
  await expect(page.getByRole('main', { name: 'Inkframe editor' })).toBeVisible();
  expect(problems).toEqual([]);
});

test.describe('with nothing saved', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the grid is on by default, and turning it off is remembered', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Grid', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
