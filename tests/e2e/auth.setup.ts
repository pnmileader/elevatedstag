import { test as setup, expect } from '@playwright/test'

// Log in once and reuse the session for every test. Logging in per-test would
// trip Supabase's sign-in rate limit and slow the suite down.
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD in .env.local (gitignored) to run the e2e suite.')
  }
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await page.context().storageState({ path: 'tests/e2e/.auth/user.json' })
})
