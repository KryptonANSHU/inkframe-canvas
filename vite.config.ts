import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vite requires a default export from its config file.
export default defineConfig({
  plugins: [react()],
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
      exclude: ['src/**/*.test.{ts,tsx}'],
      thresholds: {
        'src/core/**': { lines: 90 },
      },
    },
  },
});
