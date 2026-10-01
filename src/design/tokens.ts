/**
 * Design tokens: the single source for every color, size, and timing in the UI and on
 * the canvas. A Vite plugin turns them into CSS variables (see tokensCss.ts); the
 * canvas renderer reads them directly (core/theme.ts). Plain data, no DOM.
 */

export type ThemeName = 'light' | 'dark';

/** UI colors per theme. Selection blue is the only accent. */
export const colors = {
  light: {
    canvas: '#F3F5F8',
    surface: '#FFFFFF',
    ink: '#1E2430',
    inkMuted: '#5D6677',
    line: '#DDE1E8',
    select: '#3D5AFE',
    danger: '#C62F3B',
    /** Tint under a hovered control: ink at low opacity, so it suits any surface. */
    hover: 'rgb(30 36 48 / 0.06)',
  },
  dark: {
    canvas: '#181B21',
    surface: '#22262E',
    ink: '#E7EAF0',
    inkMuted: '#9AA3B2',
    line: '#343A45',
    select: '#7B8CFF',
    danger: '#F06B74',
    hover: 'rgb(231 234 240 / 0.08)',
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

export type ColorToken = keyof (typeof colors)['light'];

/**
 * A color users can give shapes. Shapes store `light`; the dark theme draws `dark`, a
 * counterpart tuned for the dark canvas, so a drawing reads well in both themes.
 */
export type ShapeSwatch = { readonly name: string; readonly light: string; readonly dark: string };

/** Stroke and text colors: saturated enough for thin lines on either canvas. */
export const strokeSwatches: readonly ShapeSwatch[] = [
  { name: 'Ink', light: '#1E2430', dark: '#E7EAF0' },
  { name: 'Slate', light: '#66708A', dark: '#9AA3B8' },
  { name: 'Red', light: '#D63A45', dark: '#FF7B84' },
  { name: 'Orange', light: '#E2700F', dark: '#FFA052' },
  { name: 'Yellow', light: '#C29000', dark: '#F5CB4D' },
  { name: 'Green', light: '#2E9E4F', dark: '#6BDB8C' },
  { name: 'Blue', light: '#2275D8', dark: '#73B6FF' },
  { name: 'Violet', light: '#7450E6', dark: '#B39BFF' },
];

/** Fill colors: soft tints in light mode, deep tones in dark mode, never louder than ink. */
export const fillSwatches: readonly ShapeSwatch[] = [
  { name: 'Gray', light: '#E9ECF1', dark: '#353B47' },
  { name: 'Red', light: '#FFE1E3', dark: '#4C2629' },
  { name: 'Orange', light: '#FFE6CF', dark: '#4C3320' },
  { name: 'Yellow', light: '#FFF1BF', dark: '#463D1A' },
  { name: 'Green', light: '#D7F5DE', dark: '#203F29' },
  { name: 'Blue', light: '#D7E9FF', dark: '#1E3452' },
  { name: 'Violet', light: '#E7DFFF', dark: '#33294F' },
];

/** One layered shadow for floating surfaces; nothing else gets a shadow. */
export const shadows = {
  light: { float: '0 1px 2px rgb(16 24 40 / 0.06), 0 6px 16px rgb(16 24 40 / 0.08)' },
  dark: { float: '0 1px 2px rgb(0 0 0 / 0.40), 0 6px 20px rgb(0 0 0 / 0.36)' },
} as const satisfies Record<ThemeName, Record<string, string>>;

/** 4 px base scale: --space-1 is 4px, --space-4 is 16px. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 } as const;

/** Radius has hierarchy: controls are tighter than the panels that hold them. */
export const radius = { control: 6, panel: 10 } as const;

export const fontSize = { xs: 12, sm: 13, md: 14, lg: 16, xl: 20 } as const;

export const fontFamily = {
  ui: "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

/** Stacking order of everything above the canvas. */
export const zIndex = { textEditor: 1, floating: 10, banner: 20, overlay: 100 } as const;

/** Motion only answers the user: short and ease-out. Zero under reduced motion. */
export const motion = { fast: 120, base: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' } as const;

export const focusRing = { width: 2, offset: 2 } as const;
