import { defineConfig } from '@playwright/test';

const baseURL =
  process.env.COURSEPULSE_BASE_URL ?? 'https://coursepulse-site.vercel.app';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: false,
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
});
