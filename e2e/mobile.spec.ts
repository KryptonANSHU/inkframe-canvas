import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { openEditor, savedShapes } from './helpers';

/** Chromium with each phone's size, density, and touch (the browser type is the project's). */
const phone = (name: string) => {
  const { defaultBrowserType: _browser, ...device } = devices[name] ?? {};
  return device;
};

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (found === null) throw new Error('Not on screen.');
  return found;
}

/** The floating bars, as boxes that must never overlap. */
async function bars(page: Page) {
  return Promise.all(
    [
      page.getByRole('button', { name: 'Menu' }),
      page.getByRole('toolbar', { name: 'Tools' }),
      page.getByRole('button', { name: 'Draw together' }),
      page.getByRole('group', { name: 'History' }),
      page.getByRole('group', { name: 'Zoom' }),
    ].map(box),
  );
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const name of ['iPhone 13', 'Galaxy S9+']) {
  test.describe(`on a ${name}`, () => {
    test.use(phone(name));

    test('the bars never overlap, every tool fits, and nothing scrolls sideways', async ({
      page,
    }) => {
      const boxes = await bars(page);
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
      }
      for (const tool of ['Select', 'Rectangle', 'Ellipse', 'Line', 'Arrow', 'Pen', 'Text']) {
        await expect(page.getByRole('radio', { name: tool })).toBeInViewport({ ratio: 1 });
      }
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(sideways).toBeLessThanOrEqual(0);
    });

    test('the welcome panel sits between the bars', async ({ page }) => {
      const panel = await box(page.getByRole('region', { name: 'Draw diagrams that stay crisp' }));
      const [menu, tools, , history] = await bars(page);
      expect(panel.y).toBeGreaterThan((menu?.y ?? 0) + (menu?.height ?? 0));
      expect(panel.y + panel.height).toBeLessThan(history?.y ?? Infinity);
      expect(tools).toBeDefined();
    });
  });
}

test.describe('with touch', () => {
  test.use(phone('iPhone 13'));

  test('a tap selects a shape, and the quick bar deletes it', async ({ page }) => {
    await page.getByRole('radio', { name: 'Rectangle' }).tap();
    await page.mouse.move(100, 300);
    await page.mouse.down();
    await page.mouse.move(250, 400, { steps: 5 });
    await page.mouse.up();
    await page.locator('canvas').tap({ position: { x: 100, y: 350 } });
    const quick = page.getByRole('group', { name: 'Selection' });
    await expect(quick).toBeVisible();
    await quick.getByRole('button', { name: 'Delete' }).tap();
    expect(await savedShapes(page)).toHaveLength(0);
  });

  test('a double tap edits text', async ({ page }) => {
    await page.getByRole('radio', { name: 'Text' }).tap();
    await page.locator('canvas').tap({ position: { x: 80, y: 300 } });
    await page.keyboard.type('Tap twice');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Text' })).toHaveCount(0);
    // With the select tool, one tap only selects: it takes two to edit.
    await page.getByRole('radio', { name: 'Select' }).tap();
    const text = page.locator('canvas');
    await text.tap({ position: { x: 100, y: 312 } });
    await expect(page.getByRole('textbox', { name: 'Text' })).toHaveCount(0);
    await text.tap({ position: { x: 100, y: 312 } });
    await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('Tap twice');
  });
});
