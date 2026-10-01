import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = 4174;

/**
 * `npm run bench`: the production build (dev builds run the invariants checker on every
 * change), in Chromium at MacBook-like size and pixel density.
 */
// Playwright requires a default export from its config file.
export default defineConfig({
  testDir: '.',
  testMatch: 'bench.spec.ts',
  timeout: 30 * 60_000,
  reporter: 'list',
  use: { baseURL: `http://localhost:${String(port)}` },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Full Chromium (new headless), not the stripped-down headless shell.
        channel: 'chromium',
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        headless: process.env['BENCH_HEADED'] === undefined,
        launchOptions: { args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}`,
    // Commands run from this config's folder by default; Vite must run from the project root.
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
