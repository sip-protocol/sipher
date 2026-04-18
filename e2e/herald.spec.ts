import { test, expect } from '@playwright/test'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.use({ storageState: AUTH_STATE })

test('herald view renders with admin budget visible', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.route('**/api/herald/**', async (route) => {
    await route.fulfill({
      json: { budget: { used: 0, total: 1000 }, queue: [], status: 'idle' },
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: /herald/i }).first().click()
  await expect(page.locator('[data-testid="herald-view"]')).toBeVisible()
  expect(errors).toEqual([])
})
