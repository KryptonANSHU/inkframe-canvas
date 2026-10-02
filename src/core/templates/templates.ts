import { exportBounds } from '../export/exportArea';
import { shapesToSvg } from '../export/svg';
import type { Shape } from '../shapes';
import type { TextMeasurer } from '../text/layout';
import { canvasTheme } from '../theme';
import type { ThemeName } from '../../design/tokens';
import { architecture } from './architecture';
import { flowchart } from './flowchart';
import { createKit } from './kit';
import type { Template } from './template';
import { workflow } from './workflow';

export type { Template } from './template';

/** The templates offered on the welcome panel and in the main menu. */
export const TEMPLATES: readonly Template[] = [flowchart, architecture, workflow];

/** A template's shapes, with fresh IDs and text measured in this browser. */
export function buildTemplate(template: Template, measurer: TextMeasurer): Shape[] {
  return template.build(createKit(measurer));
}

/** Rough widths, for previews only: their text isn't drawn. */
const PREVIEW_MEASURER: TextMeasurer = {
  width: (text, fontSize) => text.length * fontSize * 0.55,
  metrics: (fontSize) => ({
    ascent: fontSize * 0.8,
    descent: fontSize * 0.2,
    lineHeight: fontSize * 1.25,
  }),
};

/**
 * A small picture of a template, as an SVG data URL in the given theme's colors.
 * Text is left out: at thumbnail size it's noise, and an <img> can't load the font.
 */
export function templatePreview(template: Template, theme: ThemeName): string {
  const colors = canvasTheme(theme);
  const shapes = buildTemplate(template, PREVIEW_MEASURER)
    .filter((shape) => shape.type !== 'text')
    .map((shape) => ({
      ...shape,
      style: {
        ...shape.style,
        strokeColor: colors.shapeColor(shape.style.strokeColor),
        fillColor: shape.style.fillColor === null ? null : colors.shapeColor(shape.style.fillColor),
      },
    }));
  const area = exportBounds(shapes);
  if (area === null) return '';
  const svg = shapesToSvg(
    shapes,
    area,
    () => {
      throw new Error('Previews draw no text.');
    },
    null,
  );
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
