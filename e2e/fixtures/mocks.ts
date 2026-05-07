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
// Stub a minimal valid PrivacyData envelope so the FE's catch path doesn't
// trip and the network layer stays quiet.
export async function mockPrivacyScore(page: Page): Promise<void> {
  await page.route('**/v1/privacy/score', async (route: Route) => {
    await route.fulfill({
      json: {
        data: {
          score: 0,
          grade: 'N/A',
          factors: {},
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
