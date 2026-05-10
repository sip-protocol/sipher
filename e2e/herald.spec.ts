import { test, expect } from '@playwright/test'
import { mockPrivacyScore } from './fixtures/mocks'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.use({ storageState: AUTH_STATE })

test('herald view renders with admin budget visible', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.route('**/api/herald', async (route) => {
    await route.fulfill({
      json: {
        budget: { spent: 0, limit: 1000, gate: 'open', percentage: 0 },
        queue: [],
        dms: [],
        recentPosts: [],
      },
    })
  })
  await mockPrivacyScore(page)

  // Herald moved from main nav into Header avatar dropdown (PR 8 D1).
  // The desktop UserMenu requires an active wallet connection (publicKey from
  // Solana wallet adapter), which the e2e fixture doesn't provide. Use the
  // mobile BottomNav drawer instead — it gates admin items on isAdmin alone
  // (independent of publicKey) and is the production-equivalent admin surface
  // for mobile viewports.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: /more/i }).click()
  await page.getByRole('button', { name: /^herald$/i }).click()
  await expect(page.locator('[data-testid="herald-view"]')).toBeVisible()
  expect(errors).toEqual([])
})
