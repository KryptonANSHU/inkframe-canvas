import { describe, expect, it } from 'vitest';
import { colors, space } from './tokens';
import { tokensToCss } from './tokensCss';

describe('tokensToCss', () => {
  const css = tokensToCss();

  it('declares every token as a kebab-case CSS variable with units', () => {
    expect(css).toContain(`--color-ink-muted: ${colors.light.inkMuted};`);
    expect(css).toContain(`--space-4: ${String(space[4])}px;`);
    expect(css).toContain('--radius-panel: 10px;');
    expect(css).toContain('--duration-fast: 120ms;');
  });

  it('follows the system theme unless data-theme overrides it', () => {
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s+:root:not\(\[data-theme='light'\]\) \{[^}]*--color-canvas: #181B21;/,
    );
    expect(css).toMatch(/:root\[data-theme='dark'\] \{[^}]*color-scheme: dark;/);
  });

  it('turns motion off for people who ask for reduced motion', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*--duration-base: 0ms;/);
  });
});
