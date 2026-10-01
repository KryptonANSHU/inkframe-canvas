import { expect, test } from '@playwright/test';

test('an idle editor requests no animation frames', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    const counter = { frames: 0 };
    Object.assign(window, { rafCounter: counter });
    window.requestAnimationFrame = (callback) => {
      counter.frames += 1;
      return original(callback);
    };
  });
  const frameCount = () =>
    page.evaluate(
      () => (window as unknown as { rafCounter: { frames: number } }).rafCounter.frames,
    );

  await page.goto('/');
  await expect(page.getByRole('application', { name: 'Drawing canvas' })).toBeVisible();
  // Let the initial resize and first draw settle.
  await page.waitForTimeout(200);
  const settled = await frameCount();

  await page.waitForTimeout(1000);
  expect(await frameCount()).toBe(settled);

  // One change → exactly one more frame.
  await page.mouse.wheel(0, 10);
  await expect.poll(frameCount).toBe(settled + 1);
  await page.waitForTimeout(500);
  expect(await frameCount()).toBe(settled + 1);
});
