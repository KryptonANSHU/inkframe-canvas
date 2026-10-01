import {
  colors,
  focusRing,
  fontFamily,
  fontSize,
  motion,
  radius,
  shadows,
  size,
  space,
  zIndex,
  type ThemeName,
} from './tokens.ts';

/** "inkMuted" → "ink-muted". */
const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function declarations(
  prefix: string,
  values: Readonly<Record<string, string | number>>,
  unit = '',
) {
  return Object.entries(values).map(
    ([name, value]) =>
      `  --${prefix}-${kebab(name)}: ${String(value)}${typeof value === 'number' ? unit : ''};`,
  );
}

function themed(theme: ThemeName): string[] {
  return [
    `  color-scheme: ${theme};`,
    ...declarations('color', colors[theme]),
    ...declarations('shadow', shadows[theme]),
  ];
}

/**
 * Every token as a CSS variable. Light is the default; dark applies when the system
 * prefers it, unless `data-theme="light"` on <html> says otherwise, and always with
 * `data-theme="dark"`. Reduced motion zeroes the durations.
 */
export function tokensToCss(): string {
  const constant = [
    ...declarations('space', space, 'px'),
    ...declarations('radius', radius, 'px'),
    ...declarations('size', size, 'px'),
    ...declarations('font-size', fontSize, 'px'),
    ...declarations('font', fontFamily),
    ...declarations('z', zIndex),
    `  --duration-fast: ${String(motion.fast)}ms;`,
    `  --duration-base: ${String(motion.base)}ms;`,
    `  --easing: ${motion.easing};`,
    `  --focus-ring-width: ${String(focusRing.width)}px;`,
    `  --focus-ring-offset: ${String(focusRing.offset)}px;`,
  ];
  const dark = themed('dark').map((line) => `  ${line}`);
  return [
    `:root {\n${[...themed('light'), ...constant].join('\n')}\n}`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {\n${dark.join('\n')}\n  }\n}`,
    `:root[data-theme='dark'] {\n${themed('dark').join('\n')}\n}`,
    `@media (prefers-reduced-motion: reduce) {\n  :root {\n    --duration-fast: 0ms;\n    --duration-base: 0ms;\n  }\n}`,
  ].join('\n\n');
}
