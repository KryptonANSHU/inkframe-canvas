import { describe, expect, it } from 'vitest';
import { colors } from '../design/tokens';
import { DEFAULT_SHAPE_STYLE } from './shapes';
import { canvasTheme } from './theme';

describe('canvasTheme', () => {
  it('draws the default ink as light ink on the dark canvas, whatever its case', () => {
    expect(canvasTheme('dark').shapeColor(DEFAULT_SHAPE_STYLE.strokeColor)).toBe(colors.dark.ink);
    expect(canvasTheme('dark').shapeColor(colors.light.ink.toUpperCase())).toBe(colors.dark.ink);
  });

  it('draws other colors, and everything in light mode, as stored', () => {
    expect(canvasTheme('dark').shapeColor('#f5c542')).toBe('#f5c542');
    expect(canvasTheme('light').shapeColor(DEFAULT_SHAPE_STYLE.strokeColor)).toBe(
      DEFAULT_SHAPE_STYLE.strokeColor,
    );
  });

  it('uses the theme tokens for selection and handles', () => {
    expect(canvasTheme('dark')).toMatchObject({
      selection: colors.dark.select,
      handleFill: colors.dark.surface,
    });
  });
});
