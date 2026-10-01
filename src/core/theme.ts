import { colors, fillSwatches, strokeSwatches, type ThemeName } from '../design/tokens';

/** The colors the canvas draws with, from the same tokens as the UI. */
export type CanvasTheme = {
  readonly name: ThemeName;
  /** Selection outlines, handles' borders, and the marquee. */
  readonly selection: string;
  /** Handle centers: the panel surface, so they stand out on any shape. */
  readonly handleFill: string;
  readonly gridMinor: string;
  readonly gridMajor: string;
  /** The color to draw for a stored shape color in this theme. */
  readonly shapeColor: (stored: string) => string;
};

/**
 * Shape colors are stored as their light-theme value, so files and exports never
 * depend on the theme. In dark mode, colors with a dark counterpart are swapped for
 * display; any other color (from an imported file, say) is drawn as stored.
 */
const DARK_SHAPE_COLORS: ReadonlyMap<string, string> = new Map(
  [...strokeSwatches, ...fillSwatches].map((swatch) => [swatch.light.toLowerCase(), swatch.dark]),
);

const themes: Readonly<Record<ThemeName, CanvasTheme>> = {
  light: {
    name: 'light',
    selection: colors.light.select,
    handleFill: colors.light.surface,
    gridMinor: colors.light.gridMinor,
    gridMajor: colors.light.gridMajor,
    shapeColor: (stored) => stored,
  },
  dark: {
    name: 'dark',
    selection: colors.dark.select,
    handleFill: colors.dark.surface,
    gridMinor: colors.dark.gridMinor,
    gridMajor: colors.dark.gridMajor,
    shapeColor: (stored) => DARK_SHAPE_COLORS.get(stored.toLowerCase()) ?? stored,
  },
};

export function canvasTheme(name: ThemeName): CanvasTheme {
  return themes[name];
}
