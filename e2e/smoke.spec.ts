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
