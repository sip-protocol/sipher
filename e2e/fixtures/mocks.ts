import type { Page, Route } from '@playwright/test'

export async function mockSolanaRpc(page: Page): Promise<void> {
  await page.route('**/api/rpc/**', async (route: Route) => {
    const body = route.request().postDataJSON() as { method?: string }
    const method = body?.method ?? ''
    if (method === 'getBalance') {
      await route.fulfill({ json: { jsonrpc: '2.0', id: 1, result: { value: 1_000_000_000 } } })
      return
    }
    if (method === 'getSignatureStatuses') {
      await route.fulfill({
        json: { jsonrpc: '2.0', id: 1, result: { value: [null] } },
      })
      return
    }
    await route.fulfill({ json: { jsonrpc: '2.0', id: 1, result: null } })
  })
}

// Mode 2 (`/v1/*`) endpoints are served from a separate `dist/app.js` bundle
// that CI does not build. Without this mock, DashboardView's privacy-score
// fetch fires once /api/vault returns the wallet field and the browser logs
// a 404 — which the "renders without errors" smoke specs assert against.
// The factors map MUST include addressReuse / amountPatterns /
// timingCorrelation / counterpartyExposure since DashboardView destructures
// those keys without optional-chaining; an empty {} crashes the render and
// the chat input detaches mid-test.
export async function mockPrivacyScore(page: Page): Promise<void> {
  await page.route('**/v1/privacy/score', async (route: Route) => {
    await route.fulfill({
      json: {
        data: {
          score: 0,
          grade: 'N/A',
          factors: {
            addressReuse: { score: 0, detail: '' },
            amountPatterns: { score: 0, detail: '' },
            timingCorrelation: { score: 0, detail: '' },
            counterpartyExposure: { score: 0, detail: '' },
          },
          recommendations: [],
          transactionsAnalyzed: 0,
        },
      },
    })
  })
}

export async function mockJupiter(page: Page): Promise<void> {
  await page.route('**/quote**', async (route: Route) => {
    await route.fulfill({
      json: {
        inAmount: '1000000',
        outAmount: '980000',
        priceImpactPct: '0.1',
        routePlan: [],
      },
    })
  })
  await page.route('**/swap**', async (route: Route) => {
    await route.fulfill({ json: { swapTransaction: 'mock-tx-base64' } })
  })
}
