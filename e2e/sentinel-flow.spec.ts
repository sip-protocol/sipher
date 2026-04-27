import { test, expect } from '@playwright/test'

// Skipped pending sip-protocol/sip-protocol#1077 (SDK ESM bundle bug blocks agent startup)
test.skip('SENTINEL pause/resume flow — full chat → override → tool runs', async ({ page }) => {
  await page.goto('/')

  // Sign in (using storageState fixture from Phase 1)
  // Send a message that triggers a SENTINEL flag (e.g., sending to a known-blacklisted devnet address)
  await page.getByPlaceholder('Message SIPHER...').fill('send 5 SOL to <blacklisted address>')
  await page.getByRole('button', { name: /send/i }).click()

  // SentinelConfirm card should render
  const confirmCard = page.getByText(/risk confirm/i).first()
  await expect(confirmCard).toBeVisible({ timeout: 10000 })

  // Override → tool completes
  await page.getByRole('button', { name: /override & send/i }).click()

  // Assistant message resumes streaming
  await expect(page.getByText(/transaction submitted/i)).toBeVisible({ timeout: 30000 })
})

test.skip('SENTINEL pause/resume flow — cancel produces graceful message', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Message SIPHER...').fill('send 5 SOL to <blacklisted address>')
  await page.getByRole('button', { name: /send/i }).click()

  const confirmCard = page.getByText(/risk confirm/i).first()
  await expect(confirmCard).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /^cancel$/i }).click()

  await expect(page.getByText(/operation cancelled/i)).toBeVisible({ timeout: 10000 })
})
