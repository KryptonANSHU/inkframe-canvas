import { expect, test, type Page } from '@playwright/test';
import { alphaAt, canvas, drag, EMPTY, FULL, nextFrame, openEditor } from './helpers';

/** The top edge of the rectangle drawn at (200, 200), and of its first pasted copy. */
const original = [300, 200] as const;
const pasted = [300, 210] as const;

async function inkAt(page: Page, [x, y]: readonly [number, number]) {
  await page.keyboard.press('Escape');
  await nextFrame(page);
  return alphaAt(page, x, y);
}

test('copy in one tab, paste in another; cut removes the shape', async ({ context }) => {
  const first = await context.newPage();
  const problems = await openEditor(first);
  await canvas(first).focus();
  await first.keyboard.press('r');
  await drag(first, [200, 200], [400, 300]);
  await first.keyboard.press('ControlOrMeta+C');

  // Pasting in the same tab lands one offset away.
  await first.keyboard.press('ControlOrMeta+V');
  await expect.poll(() => inkAt(first, pasted)).toBe(FULL);

  const second = await context.newPage();
  problems.push(...(await openEditor(second)));
  await canvas(second).focus();
  await second.keyboard.press('ControlOrMeta+V');
  await expect.poll(() => inkAt(second, pasted)).toBe(FULL);
  expect(await inkAt(second, original)).toBe(EMPTY);

  await second.mouse.click(300, 210);
  await second.keyboard.press('ControlOrMeta+X');
  await expect.poll(() => inkAt(second, pasted)).toBe(EMPTY);
  expect(problems).toEqual([]);
});
