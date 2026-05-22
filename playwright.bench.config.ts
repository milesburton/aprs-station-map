import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

// Perf benchmarks run separately from the correctness e2e suite — see the
// `perf` job in .github/workflows/ci.yml and the `test:e2e:load` npm script.
// The only difference from the base config is the test-file pattern.
export default defineConfig({
  ...baseConfig,
  testMatch: /\.bench\.ts$/,
})
