import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
const baseURL = `http://localhost:${PORT}`
const crossBrowser = process.env.PLAYWRIGHT_CROSS_BROWSER === '1'

export default defineConfig({
  testDir: './scripts/test',
  testMatch: '**/*.spec.ts',
  fullyParallel: !crossBrowser,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI || crossBrowser ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'scripts/test/playwright-report' }]]
    : 'list',
  outputDir: 'scripts/test/test-results',
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.025,
    },
  },
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/visual-baselines/{testFileName}-snapshots/{arg}-{projectName}{ext}',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: crossBrowser
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: /memory\.spec\.ts$/,
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'chromium-memory',
          testMatch: /memory\.spec\.ts$/,
          workers: 1,
          use: { ...devices['Desktop Chrome'] },
        },
      ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
