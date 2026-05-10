import { test, expect } from '@playwright/test'
import { mockSolanaRpc, mockPrivacyScore } from './fixtures/mocks'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.use({ storageState: AUTH_STATE })

test('vault unauthed empty state renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await mockSolanaRpc(page)
  await mockPrivacyScore(page)
  await page.goto('/')
  await page.getByRole('link', { name: /vault/i }).first().click()
  // After react-router migration, Vault tabs are <Link> elements (role=link)
  // not <button>. URL changes to /vault on click.
  await expect(page).toHaveURL(/\/vault$/)
  // E2E fixture persists JWT but does not connect a wallet adapter, so
  // useAuthState() resolves to 'unauthed' and VaultView renders the
  // UnauthedEmptyState marketing branch. See PR #230 / Tier 2 #190.
  await expect(page.locator('[data-testid="unauthed-empty-state"]')).toBeVisible()
  expect(errors).toEqual([])
})
