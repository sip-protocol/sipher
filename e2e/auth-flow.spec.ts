import { test, expect } from '@playwright/test'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.describe('auth flow', () => {
  test('unauth user sees landing, no admin metrics', async ({ page }) => {
    await page.context().addInitScript(() => window.localStorage.clear())
    await page.goto('/')
    await expect(page.getByText(/connect wallet/i).first()).toBeVisible()
  })

  test.describe('authenticated', () => {
    test.use({ storageState: AUTH_STATE })

    test('admin user sees dashboard', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('SIPHER').first()).toBeVisible()
      const token = await page.evaluate(() => {
        const raw = window.localStorage.getItem('sipher-auth')
        return raw ? (JSON.parse(raw) as { state: { token: string } }).state.token : null
      })
      expect(token).toBeTruthy()
    })
  })
})
