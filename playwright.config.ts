import { defineConfig, devices } from '@playwright/test';

const port = 5173;
const baseURL = `http://localhost:${String(port)}`;
const isCI = process.env['CI'] !== undefined;

// Playwright requires a default export from its config file.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // The grid is on by default; tests that read canvas pixels need it off. A test
    // can opt back in with test.use({ storageState: … }).
    storageState: {
      cookies: [],
      origins: [{ origin: baseURL, localStorage: [{ name: 'inkframe.grid', value: 'off' }] }],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${String(port)} --strictPort`,
    url: baseURL,
    reuseExistingServer: !isCI,
  },
});
