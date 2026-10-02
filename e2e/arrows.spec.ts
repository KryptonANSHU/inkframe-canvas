import { expect, test, type Page } from '@playwright/test';
import { canvas, drag, nextFrame, openEditor, savedShapes, type SavedShape } from './helpers';

let consoleProblems: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleProblems = await openEditor(page);
  await canvas(page).focus();
});

test.afterEach(() => {
  expect(consoleProblems).toEqual([]);
});

/** The arrow's two ends in world units (the camera starts at the origin, at 100%). */
function arrowEnds(shapes: SavedShape[]) {
  const arrow = shapes.find((shape) => shape.type === 'arrow');
  return (arrow?.points ?? []).map((point) => ({
    x: (arrow?.x ?? 0) + point.x,
    y: (arrow?.y ?? 0) + point.y,
  }));
}

/** Two boxes, and an arrow drawn from just off one's right edge to just off the other's left. */
async function drawConnected(page: Page) {
  await page.keyboard.press('r');
  await drag(page, [200, 200], [320, 280]);
  await page.keyboard.press('r');
  await drag(page, [500, 200], [620, 280]);
  await page.keyboard.press('a');
  await drag(page, [324, 243], [496, 238]);
  await nextFrame(page);
}

test('an arrow drawn between two shapes attaches to both and follows them', async ({ page }) => {
  await drawConnected(page);
  let shapes = await savedShapes(page);
  expect(shapes.find((shape) => shape.type === 'arrow')).toMatchObject({
    start: { anchor: 'right' },
    end: { anchor: 'left' },
  });
  expect(arrowEnds(shapes)).toEqual([
    { x: 320, y: 240 },
    { x: 500, y: 240 },
  ]);

  // Move the second box down by its top edge: the arrow head follows, in one undo step.
  await page.mouse.click(700, 600);
  await drag(page, [560, 200], [560, 300]);
  shapes = await savedShapes(page);
  expect(arrowEnds(shapes)).toEqual([
    { x: 320, y: 240 },
    { x: 500, y: 340 },
  ]);
  await page.keyboard.press('ControlOrMeta+Z');
  expect(arrowEnds(await savedShapes(page))[1]).toEqual({ x: 500, y: 240 });
});

test('attachments survive a reload; deleting a shape lets go of the arrow', async ({ page }) => {
  await drawConnected(page);
  // Past the 500 ms autosave delay.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(canvas(page)).toBeVisible();
  await canvas(page).focus();
  const arrow = (await savedShapes(page)).find((shape) => shape.type === 'arrow');
  expect(arrow).toMatchObject({ start: { anchor: 'right' }, end: { anchor: 'left' } });

  await page.mouse.click(260, 200);
  await page.keyboard.press('Delete');
  const left = (await savedShapes(page)).find((shape) => shape.type === 'arrow');
  expect(left?.start).toBeUndefined();
  expect(left).toMatchObject({ end: { anchor: 'left' } });
});
