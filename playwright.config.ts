import { defineConfig, devices } from '@playwright/test'

const ci = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // A left-over `test.only` must not quietly turn most of the suite off in CI.
  forbidOnly: ci,
  // A test that fails once is a failure: no automatic retries to hide a flaky one.
  retries: 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // Pre-installed Chromium in the cloud environment; falls back to Playwright's own elsewhere.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // CI has just built the app in an earlier step, so it only has to serve it.
    command: `${ci ? '' : 'npm run build && '}npm run preview -- --port 4173 --strictPort`,
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
