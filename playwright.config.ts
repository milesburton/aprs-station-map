import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const baseURL = isCI ? 'http://localhost:4173' : 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  // Default run only picks up *.spec.ts. Perf benchmarks live in *.bench.ts
  // and are invoked explicitly via the test:e2e:load script + perf CI job, so
  // the main e2e job stays focused on correctness.
  testMatch: /\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  webServer: {
    command: isCI ? 'npm run preview' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
