import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { tokensToCss } from './src/design/tokensCss.ts';

const TOKENS_MODULE = 'virtual:inkframe-tokens.css';
// A path ending in .css, so Vite runs the module through its CSS pipeline.
const RESOLVED_TOKENS_MODULE = '/__inkframe-tokens.css';

/**
 * Serves the design tokens (src/design/tokens.ts) as CSS variables. Generated on
 * every build, so the CSS can never drift from the tokens. Editing tokens.ts restarts
 * the dev server, since this config imports it.
 */
function designTokens(): Plugin {
  return {
    name: 'inkframe-design-tokens',
    resolveId: (id) => (id === TOKENS_MODULE ? RESOLVED_TOKENS_MODULE : null),
    load: (id) => (id === RESOLVED_TOKENS_MODULE ? tokensToCss() : null),
  };
}

// Vite requires a default export from its config file.
export default defineConfig({
  plugins: [react(), designTokens()],
  // The design system is an internal package (src/design/package.json), imported by name.
  resolve: {
    alias: {
      '@inkframe/design': fileURLToPath(new URL('./src/design/index.ts', import.meta.url)),
    },
  },
  test: {
    // Unit and property tests run as separate projects so `npm test` stays fast
    // and `npm run test:property` can run the slower randomized suites on their own.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.property.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'property',
          include: ['src/**/*.property.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // src/core/dom is browser glue, covered by Playwright (e2e/) rather than unit tests.
      // Stories are demos, checked by the Storybook build and its axe pass.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/testing/**',
        'src/core/dom/**',
        'src/**/*.stories.tsx',
        'src/design/stories/**',
      ],
      thresholds: {
        'src/core/**': { lines: 90 },
      },
    },
  },
});
