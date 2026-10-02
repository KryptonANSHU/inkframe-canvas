import type { StorybookConfig } from '@storybook/react-vite';

/**
 * The design system's workshop: one story file per component, next to it. Storybook
 * reuses vite.config.ts, so the token CSS and the @inkframe/design alias work as in the app.
 */
const config: StorybookConfig = {
  stories: ['../src/design/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', 'storybook-addon-pseudo-states'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  // Storybook's own docs and axe bundles are large; the app's chunks are checked by its build.
  viteFinal: (vite) => ({ ...vite, build: { ...vite.build, chunkSizeWarningLimit: 1600 } }),
};

// Storybook requires a default export from its config files.
export default config;
