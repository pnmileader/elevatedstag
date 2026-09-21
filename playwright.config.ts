import { defineConfig } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Pull E2E_EMAIL / E2E_PASSWORD (and Supabase keys for fixture cleanup) from .env.local.
loadEnvConfig(process.cwd())

const PORT = 3001
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // tests share one live Supabase project + one login; keep them serial
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 768, height: 1024 }, // iPad portrait — the app's primary device
    hasTouch: true, // lets tests use .tap() for the mobile checks
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'crm',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'tests/e2e/.auth/user.json' },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
