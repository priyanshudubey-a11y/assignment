import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// One shared database, and several tests reset or revise it, so run serially.
export default defineConfig({
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 0 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'unit', testDir: './unit' },
    { name: 'api', testDir: './api' },
    { name: 'ui', testDir: './ui', use: { ...devices['Desktop Chrome'], baseURL: FRONTEND_URL } },
    { name: 'perf', testDir: './perf', timeout: 300_000 },
  ],
});
