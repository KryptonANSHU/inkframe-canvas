import { defineConfig, devices } from '@playwright/test';

const port = 5173;
const isCI = process.env['CI'] !== undefined;

// Playwright requires a default export from its config file.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !isCI,
  },
});
