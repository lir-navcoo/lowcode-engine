import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for the SapuLowcodeEngine demo.
 *
 * Spins up the Vite dev server (yarn demo) on http://localhost:5173
 * and runs tests against it. The dev server imports the workspace
 * packages from their lib/ + es/ builds, so `yarn build` must be
 * run first if the source has changed since the last build (the
 * typecheck workflow requires this anyway).
 *
 * Test directory: tests/e2e/ (separate from the per-package
 * unit tests under `packages/<name>/tests/`, which run under vitest).
 *
 * For CI: 1 browser (chromium) to keep the matrix small. Add
 * firefox + webkit under `projects` if cross-browser coverage
 * becomes a requirement.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'yarn demo',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
