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

  await page.goto('/')
  // Herald moved from main nav into Header avatar dropdown (PR 8 D1).
  // Open the user menu, then click the Herald menuitem.
  await page.locator('button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: /herald/i }).click()
  await expect(page.locator('[data-testid="herald-view"]')).toBeVisible()
  expect(errors).toEqual([])
})
