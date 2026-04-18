import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const PORT_FRONTEND = 5173
const PORT_BACKEND = 3000

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/fixtures/**'],
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: process.env.CI ? [['html'], ['github']] : [['html'], ['list']],
  globalSetup: path.resolve(__dirname, './e2e/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './e2e/global-teardown.ts'),
  use: {
    baseURL: `http://localhost:${PORT_FRONTEND}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @sipher/agent dev',
      url: `http://localhost:${PORT_BACKEND}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(PORT_BACKEND),
        HERALD_ENABLED: 'false',
        SIPHER_DB_PATH: './e2e/test.db',
        AUTHORIZED_WALLETS: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
        JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-test-secret-at-least-16-chars',
        SENTINEL_MODE: 'off',
      },
    },
    {
      command: 'pnpm --filter @sipher/app dev',
      url: `http://localhost:${PORT_FRONTEND}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
