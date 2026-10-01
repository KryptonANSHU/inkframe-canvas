import { expect, type Page } from '@playwright/test';

export const FULL = 255;
export const EMPTY = 0;

/**
 * Alpha of one backing-store pixel (device pixels, not CSS pixels). Reads through a
 * throwaway 1×1 copy so repeated reads never touch the app canvas's GPU-backed context.
 */
export async function alphaAt(page: Page, x: number, y: number): Promise<number> {
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

export async function drag(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
  steps = 5,
) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps });
  await page.mouse.up();
}

/**
 * Opens the editor and records console errors, warnings, and page errors.
 * Assert the returned list is empty at the end of the test.
 */
export async function openEditor(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  await page.goto('/');
  await expect(canvas(page)).toBeVisible();
  // The toolbar renders once the editor exists, so its key and pointer handlers are bound.
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  return problems;
}

export function canvas(page: Page) {
  return page.getByRole('application', { name: 'Drawing canvas' });
}

/** How many backing-store pixels in a rectangle have any ink (alpha > 0). */
export async function inkedPixels(
  page: Page,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<number> {
  return page.evaluate(
    ([px, py, w, h]) => {
      const source = document.querySelector('canvas');
      const copy = document.createElement('canvas');
      copy.width = w;
      copy.height = h;
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (source === null || context === null) {
        throw new Error('No canvas on the page.');
      }
      context.drawImage(source, px, py, w, h, 0, 0, w, h);
      const { data } = context.getImageData(0, 0, w, h);
      let count = 0;
      for (let i = 3; i < data.length; i += 4) {
        if ((data[i] ?? 0) > 0) count++;
      }
      return count;
    },
    [x, y, width, height] as const,
  );
}

/** RGBA of one backing-store pixel. */
export async function pixelAt(page: Page, x: number, y: number): Promise<number[]> {
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
      return [...context.getImageData(0, 0, 1, 1).data];
    },
    [x, y] as const,
  );
}

/** Whether a pixel shows the selection blue (#3d5afe) rather than ink (#1e2430). */
export async function isSelectionBlue(page: Page, x: number, y: number): Promise<boolean> {
  const [r = 0, , b = 0, a = 0] = await pixelAt(page, x, y);
  return a > 0 && b > 200 && r < 120;
}

/** Waits for the next frame to be drawn. */
export async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

/**
 * Opens the main menu and picks an item, e.g. /Export .* as PNG/. Waits until the menu
 * has handed focus back to the canvas, as it does once it has closed.
 */
export async function chooseMenuItem(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(canvas(page)).toBeFocused();
}

/** The toast region, where errors and file progress appear. */
export function notifications(page: Page) {
  return page.getByRole('region', { name: /Notifications/ });
}
