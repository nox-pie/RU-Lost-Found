import { defineConfig, devices } from '@playwright/test';
import { E2E_API_PORT, E2E_WEB_PORT } from './e2e/ports.mjs';

/**
 * End-to-end tests: a real browser against the real web app and API (in-memory database).
 * `npm run e2e` starts everything, runs the journeys and shuts it all down. It uses its own
 * ports, so it can run while the normal dev servers (5173, 5001) are up.
 */
const webUrl = `http://localhost:${E2E_WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  // On CI only, a failed test gets one more try: it then shows as "flaky" in the summary (and
  // its first failure is still reported) instead of failing the build on a slow runner.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: 'node e2e/start-api.mjs',
      url: `http://127.0.0.1:${E2E_API_PORT}/api/v1/health/ready`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `npx vite --port ${E2E_WEB_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${E2E_API_PORT}` },
      url: webUrl,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
