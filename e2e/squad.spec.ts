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
  await page.goto('/')
  await page.getByRole('button', { name: /squad/i }).first().click()
  await expect(page.locator('[data-testid="squad-view"]')).toBeVisible()
  expect(errors).toEqual([])
})
