import { expect, test, type Page } from '@playwright/test';

// The default rectangle has a 2-unit stroke centered on its edges. At 100% zoom and
// DPR 1, the top edge at y = 200 covers y 199–201: pixel rows 199 and 200 are fully
// inked, rows 198 and 201 are empty. Those exact values prove lines are crisp.
const FULL = 255;
const EMPTY = 0;

/**
 * Alpha of one backing-store pixel (device pixels, not CSS pixels). Reads through a
 * throwaway 1×1 copy so repeated reads never touch the app canvas's GPU-backed context.
 */
async function alphaAt(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(
    ([px, py]) => {
      const source = document.querySelector('canvas');
      const copy = document.createElement('canvas');
      copy.width = 1;
      copy.height = 1;
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (source === null || context === null) {
        throw new Error('No canvas on the page.');
      }
      context.drawImage(source, px, py, 1, 1, 0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3] ?? -1;
    },
    [x, y] as const,
  );
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 5 });
  await page.mouse.up();
}

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
  await page.goto('/');
  await expect(page.getByRole('application', { name: 'Drawing canvas' })).toBeVisible();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

test('dragging draws a rectangle with crisp edges', async ({ page }) => {
  await drag(page, [200, 200], [400, 300]);

  await expect.poll(() => alphaAt(page, 300, 200)).toBe(FULL);
  expect(await alphaAt(page, 300, 199)).toBe(FULL);
  expect(await alphaAt(page, 300, 198)).toBe(EMPTY);
  expect(await alphaAt(page, 300, 201)).toBe(EMPTY);
  // No fill by default: the inside stays empty.
  expect(await alphaAt(page, 300, 250)).toBe(EMPTY);
});

test('Escape cancels a drag and leaves nothing behind', async ({ page }) => {
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(400, 300, { steps: 5 });
  await expect.poll(() => alphaAt(page, 300, 200)).toBe(FULL);

  await page.keyboard.press('Escape');
  await expect.poll(() => alphaAt(page, 300, 200)).toBe(EMPTY);

  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  expect(await alphaAt(page, 300, 200)).toBe(EMPTY);
});

test('Ctrl + wheel zooms around the cursor', async ({ page }) => {
  await drag(page, [200, 200], [400, 300]);
  await expect.poll(() => alphaAt(page, 300, 200)).toBe(FULL);

  // Zoom in with the cursor on the middle of the left edge.
  await page.mouse.move(200, 250);
  await page.keyboard.down('Control');
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -100);
  }
  await page.keyboard.up('Control');

  // The top edge moves away from the cursor...
  await expect.poll(() => alphaAt(page, 300, 200)).toBe(EMPTY);
  // ...while the edge under the cursor stays exactly where it was.
  expect(await alphaAt(page, 200, 250)).toBe(FULL);
});

test('space + drag pans the view', async ({ page }) => {
  await drag(page, [200, 200], [400, 300]);
  await expect.poll(() => alphaAt(page, 300, 200)).toBe(FULL);

  await page.keyboard.down('Space');
  await drag(page, [600, 500], [700, 550]);
  await page.keyboard.up('Space');

  // Moved 100 right and 50 down: the top edge is now at y = 250, x 300–500.
  await expect.poll(() => alphaAt(page, 400, 250)).toBe(FULL);
  expect(await alphaAt(page, 400, 200)).toBe(EMPTY);
});

test('the scroll wheel pans the view', async ({ page }) => {
  await drag(page, [200, 200], [400, 300]);
  await expect.poll(() => alphaAt(page, 300, 200)).toBe(FULL);

  await page.mouse.wheel(0, 60);

  // Content moves up 60: edges go from y 200/300 to y 140/240.
  await expect.poll(() => alphaAt(page, 300, 140)).toBe(FULL);
  expect(await alphaAt(page, 300, 200)).toBe(EMPTY);
});

test.describe('on a 2× display', () => {
  test.use({ deviceScaleFactor: 2 });

  test('the backing store is twice the CSS size and edges stay crisp', async ({ page }) => {
    const sizes = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return {
        backing: [canvas?.width, canvas?.height],
        css: [window.innerWidth * 2, window.innerHeight * 2],
      };
    });
    expect(sizes.backing).toEqual(sizes.css);

    await drag(page, [200, 200], [400, 300]);
    // The top edge at CSS y = 200 is device y = 400, with a 4-device-pixel stroke (398–402).
    await expect.poll(() => alphaAt(page, 600, 400)).toBe(FULL);
    expect(await alphaAt(page, 600, 398)).toBe(FULL);
    expect(await alphaAt(page, 600, 397)).toBe(EMPTY);
    expect(await alphaAt(page, 600, 402)).toBe(EMPTY);
  });
});
