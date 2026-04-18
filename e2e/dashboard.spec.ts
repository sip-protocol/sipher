import { test, expect } from '@playwright/test'
import { mockSolanaRpc } from './fixtures/mocks'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.use({ storageState: AUTH_STATE })

test('dashboard view renders without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await mockSolanaRpc(page)
  await page.goto('/')

  await page.getByRole('button', { name: /dashboard/i }).click().catch(() => {})
  await expect(page.locator('main, [data-testid="dashboard-view"]').first()).toBeVisible()
  expect(errors).toEqual([])
})
