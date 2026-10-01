import { expect, test, type Page } from '@playwright/test';
import { canvas, inkedPixels, nextFrame, openEditor } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
  await page.keyboard.press('t');
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

const textbox = (page: Page) => page.getByRole('textbox', { name: 'Text' });
/** Ink in the first line of a text box placed at (200, 200). */
const firstLineInk = (page: Page) => inkedPixels(page, 200, 200, 200, 26);

/**
 * Committed text is selected, so its frame and handles would count as ink. Text
 * committed in the first moments after load waits for the font before it exists (and
 * is selected), so deselect only once it is drawn, then wait for that frame.
 */
async function deselectOnceDrawn(page: Page) {
  await expect.poll(() => firstLineInk(page)).toBeGreaterThan(20);
  await page.keyboard.press('Escape');
  await nextFrame(page);
}

test('loads Instrument Sans with the FontFace API', async ({ page }) => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts].some(
          (face) => face.family.includes('Instrument Sans') && face.status === 'loaded',
        ),
      ),
    )
    .toBe(true);
});

test('click, type, Escape: the text is drawn and the canvas has focus again', async ({ page }) => {
  await page.mouse.click(200, 200);
  await expect(textbox(page)).toBeFocused();
  await page.keyboard.type('Hello world');
  await page.keyboard.press('Escape');

  await expect(textbox(page)).toHaveCount(0);
  await expect.poll(() => firstLineInk(page)).toBeGreaterThan(100);
  await expect(canvas(page)).toBeFocused();
});

test('the textarea sits exactly where the text will be drawn', async ({ page }) => {
  await page.mouse.click(200, 200);
  const box = await textbox(page).boundingBox();
  expect(box?.x).toBe(200);
  expect(box?.y).toBe(200);
  expect(box?.width).toBe(240);
  await expect(textbox(page)).toHaveCSS('font-size', '20px');
});

test('clicking away commits the text without opening another box', async ({ page }) => {
  await page.mouse.click(200, 200);
  await page.keyboard.type('Hi');
  await page.mouse.click(600, 400);

  await expect(textbox(page)).toHaveCount(0);
  await expect.poll(() => firstLineInk(page)).toBeGreaterThan(20);
});

test('Escape on an empty box creates nothing', async ({ page }) => {
  await page.mouse.click(200, 200);
  await page.keyboard.press('Escape');
  await expect(textbox(page)).toHaveCount(0);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  expect(await firstLineInk(page)).toBe(0);
});

test('long text wraps inside the 240-unit box', async ({ page }) => {
  await page.mouse.click(200, 200);
  await page.keyboard.type('The quick brown fox jumps over the lazy dog');
  await page.keyboard.press('Control+Enter');
  await deselectOnceDrawn(page);

  expect(await firstLineInk(page)).toBeGreaterThan(100);
  // A second line exists below the first...
  expect(await inkedPixels(page, 200, 230, 240, 20)).toBeGreaterThan(50);
  // ...and nothing runs past the right edge of the box.
  expect(await inkedPixels(page, 442, 195, 200, 60)).toBe(0);
});

test('double-click edits text; clearing it deletes the shape', async ({ page }) => {
  await page.mouse.click(200, 200);
  await page.keyboard.type('Hi');
  await page.keyboard.press('Escape');
  await deselectOnceDrawn(page);
  // Past the end of "Hi", where " there" will go.
  const tail = () => inkedPixels(page, 240, 200, 80, 26);
  expect(await tail()).toBe(0);

  await page.mouse.dblclick(210, 210);
  await expect(textbox(page)).toHaveValue('Hi');
  await page.keyboard.type(' there');
  await page.keyboard.press('Escape');
  await expect(textbox(page)).toHaveCount(0);
  await deselectOnceDrawn(page);
  expect(await tail()).toBeGreaterThan(20);

  await page.mouse.dblclick(210, 210);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Escape');
  await expect.poll(() => firstLineInk(page)).toBe(0);
});

test.describe('with a slow font', () => {
  test('text typed before the font loads appears once it does', async ({ page }) => {
    // Hold the font back until the text has been typed and committed.
    let releaseFont: () => void = () => undefined;
    const fontHeld = new Promise<void>((resolve) => {
      releaseFont = resolve;
    });
    await page.route('**/fonts/*.woff2', async (route) => {
      await fontHeld;
      await route.continue();
    });
    await page.reload();
    await canvas(page).focus();
    await page.keyboard.press('t');

    await page.mouse.click(200, 200);
    await expect(textbox(page)).toBeFocused();
    await page.keyboard.type('Early text');
    await page.keyboard.press('Escape');
    await nextFrame(page);
    expect(await firstLineInk(page)).toBe(0);

    releaseFont();
    await expect.poll(() => firstLineInk(page)).toBeGreaterThan(100);
  });
});
