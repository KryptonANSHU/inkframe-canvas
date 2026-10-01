import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { canvas, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

const rect = (id: string, x: number) => ({
  id,
  type: 'rectangle',
  x,
  y: 200,
  width: 200,
  height: 100,
  rotation: 0,
  style: { strokeColor: '#1e2430', fillColor: null, strokeWidth: 2, opacity: 1 },
  zIndex: 0,
});

/** Presses Tab (or Shift + Tab) until `focused` holds; fails rather than looping forever. */
async function tabUntil(page: Page, focused: () => Promise<boolean>, key = 'Tab') {
  for (let presses = 0; presses < 40; presses++) {
    if (await focused()) return;
    await page.keyboard.press(key);
  }
  throw new Error(`Focus never arrived after 40 × ${key}.`);
}

const focusIn = (page: Page, selector: string) => () =>
  page.evaluate((s) => document.activeElement?.closest(s) !== null, selector);

test('the whole editing flow works from the keyboard alone', async ({ page }) => {
  // Open a two-rectangle drawing with Ctrl / ⌘ + O.
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('ControlOrMeta+O');
  await (
    await chooser
  ).setFiles({
    name: 'two.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ format: 'inkframe', version: 1, shapes: [rect('a', 100), rect('b', 400)] }),
    ),
  });
  // Opening runs in a worker; the empty-canvas hint goes once the drawing is in.
  await expect(page.getByText('Pick a tool or press')).toHaveCount(0);
  await expect(canvas(page)).toBeFocused();

  // Select all, then pick Red in the style panel: Tab in, arrows to move, Space to choose.
  await page.keyboard.press('ControlOrMeta+A');
  await tabUntil(page, focusIn(page, '[aria-label="Stroke color"]'));
  // Radix moves focus a tick after each arrow key, so each move is awaited.
  const stroke = page.getByRole('radiogroup', { name: 'Stroke color' });
  await page.keyboard.press('ArrowRight');
  await expect(stroke.getByRole('radio', { name: 'Slate' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(stroke.getByRole('radio', { name: 'Red' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(stroke.getByRole('radio', { name: 'Red' })).toBeChecked();

  // Back to the canvas, then nudge, duplicate, delete the copies, and undo twice.
  await tabUntil(
    page,
    () => canvas(page).evaluate((c) => c === document.activeElement),
    'Shift+Tab',
  );
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ControlOrMeta+D');
  await page.keyboard.press('Delete');
  await page.keyboard.press('ControlOrMeta+Z');
  await page.keyboard.press('ControlOrMeta+Z');

  // The saved file shows exactly what changed: red, 10 units right, no copies.
  const download = page.waitForEvent('download');
  await page.keyboard.press('ControlOrMeta+S');
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8')) as {
    shapes: { x: number; style: { strokeColor: string } }[];
  };
  expect(saved.shapes.map((shape) => [shape.x, shape.style.strokeColor])).toEqual([
    [110, '#d63a45'],
    [410, '#d63a45'],
  ]);

  // The theme, from the menu: Tab to it, Enter opens it, End then ↑ reaches Dark.
  await tabUntil(page, focusIn(page, '[aria-label="Menu"]'));
  await page.keyboard.press('Enter');
  // Radix moves focus to the first item a tick after opening.
  await expect(page.getByRole('menuitem', { name: /^Open/ })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: /^Keyboard shortcuts/ })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitemradio', { name: 'Dark' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(canvas(page)).toBeFocused();

  // The shortcuts dialog opens with ? and closes with Escape, handing focus back.
  await page.keyboard.press('Shift+?');
  // A modal moves focus into itself, so Escape and Tab act on it, not the canvas.
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(canvas(page)).toBeFocused();
});
