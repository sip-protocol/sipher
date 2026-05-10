import { test, expect } from '@playwright/test'
import { mockPrivacyScore } from './fixtures/mocks'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.use({ storageState: AUTH_STATE })

test('squad view renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await mockPrivacyScore(page)
  // Squad moved from main nav into Header avatar dropdown (PR 8 D1).
  // The desktop UserMenu requires an active wallet connection (publicKey from
  // Solana wallet adapter), which the e2e fixture doesn't provide. Use the
  // mobile BottomNav drawer instead — it gates admin items on isAdmin alone
  // (independent of publicKey) and is the production-equivalent admin surface
  // for mobile viewports.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: /more/i }).click()
  await page.getByRole('button', { name: /^squad$/i }).click()
  await expect(page.locator('[data-testid="squad-view"]')).toBeVisible()
  expect(errors).toEqual([])
})
