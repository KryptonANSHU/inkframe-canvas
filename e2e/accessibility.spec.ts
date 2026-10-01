import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvas, drag, openEditor } from './helpers';

/** WCAG 2.1 A and AA: the PRD's baseline. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
    }));
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    let consoleProblems: string[] = [];

    test.beforeEach(async ({ page }) => {
      // Reduced motion zeroes every animation (tokens), so axe measures settled colors,
      // never a dialog halfway through fading in.
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      consoleProblems = await openEditor(page);
      await canvas(page).focus();
    });

    test.afterEach(() => {
      expect(consoleProblems).toEqual([]);
    });

    test('no serious accessibility issues in any main state', async ({ page }) => {
      expect(await seriousViolations(page), 'empty canvas').toEqual([]);

      await page.keyboard.press('r');
      await drag(page, [300, 300], [500, 420]);
      await expect(page.getByRole('complementary', { name: 'Style' })).toBeVisible();
      expect(await seriousViolations(page), 'selection with style panel').toEqual([]);

      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      expect(await seriousViolations(page), 'menu open').toEqual([]);
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await seriousViolations(page), 'shortcuts dialog').toEqual([]);
    });
  });
}
