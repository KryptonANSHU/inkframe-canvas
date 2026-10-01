import { colors, type ThemeName } from '../design/tokens';

/** The colors the canvas draws with, from the same tokens as the UI. */
export type CanvasTheme = {
  readonly name: ThemeName;
  /** Selection outlines, handles' borders, and the marquee. */
  readonly selection: string;
  /** Handle centers: the panel surface, so they stand out on any shape. */
  readonly handleFill: string;
  /** The color to draw for a stored shape color in this theme. */
  readonly shapeColor: (stored: string) => string;
};

/**
 * Shape colors are stored as their light-theme value, so files and exports never
 * depend on the theme. In dark mode, colors with a dark counterpart are swapped for
 * display; any other color is drawn as stored. The style panel's palette (M7b) adds
 * its swatches here.
 */
const DARK_SHAPE_COLORS: ReadonlyMap<string, string> = new Map([
  [colors.light.ink.toLowerCase(), colors.dark.ink],
]);

const themes: Readonly<Record<ThemeName, CanvasTheme>> = {
  light: {
    name: 'light',
    selection: colors.light.select,
    handleFill: colors.light.surface,
    shapeColor: (stored) => stored,
  },
  dark: {
    name: 'dark',
    selection: colors.dark.select,
    handleFill: colors.dark.surface,
    shapeColor: (stored) => DARK_SHAPE_COLORS.get(stored.toLowerCase()) ?? stored,
  },
};

export function canvasTheme(name: ThemeName): CanvasTheme {
  return themes[name];
}
