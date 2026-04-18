import { test, expect } from '@playwright/test'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.describe('chat sidebar', () => {
  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('input is disabled and shows connect-wallet placeholder', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      await page.goto('/')
      const input = page.getByPlaceholder('Connect wallet first')
      await expect(input).toBeVisible()
      await expect(input).toBeDisabled()
      expect(errors).toEqual([])
    })
  })

  test.describe('authenticated', () => {
    test.use({ storageState: AUTH_STATE })

    test('sends message and renders streamed reply from mocked SSE', async ({ page }) => {
      await page.route('**/api/chat/stream', async (route) => {
        const body =
          'data: {"type":"content_block_delta","text":"Hello "}\n\n' +
          'data: {"type":"content_block_delta","text":"from SIPHER."}\n\n' +
          'data: [DONE]\n\n'
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
          body,
        })
      })

      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      await page.goto('/')
      const input = page.getByPlaceholder('Message SIPHER...')
      await expect(input).toBeEnabled()
      await input.fill('hi')
      await page.getByRole('button', { name: 'Send' }).click()

      await expect(page.getByText('Hello from SIPHER.')).toBeVisible({ timeout: 5000 })
      expect(errors).toEqual([])
    })
  })
})
