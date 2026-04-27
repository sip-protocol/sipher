# Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Playwright E2E (Chromium) + Vitest/RTL/jsdom component test harnesses with one smoke test per UI surface, wired into path-filtered GitHub CI, unblocking all subsequent audit-driven phases.

**Architecture:** Playwright runs against Vite dev (:5173) + the Sipher agent server (`packages/agent`, overridden to :3000 to match Vite's `/api` proxy) via Playwright's native `webServer` config. The legacy root REST (`src/server.ts`) is not started — `/api/auth`, `/api/chat/stream`, and SENTINEL routes live in the agent. Ed25519-signed JWT minted once in `global-setup`, persisted to `storageState.json`, injected into Zustand's new `persist`-backed `sipher-auth` localStorage entry so admin views render immediately. External network (Solana RPC, Jupiter, X, Pi SDK) is intercepted at the Playwright layer or disabled via `HERALD_ENABLED=false` / `SENTINEL_MODE=off` — no API keys required in CI. RTL covers component units independently in jsdom.

**Tech Stack:** Playwright ^1.48 (Chromium only), Vitest, @testing-library/react ^16, @testing-library/jest-dom ^6, jsdom ^25, @noble/curves (reused), zustand/middleware/persist.

**Spec:** `docs/superpowers/specs/2026-04-18-test-infrastructure-design.md`

---

## File Structure

**New files (18):**

| Path | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright config: Chromium, dual webServer, storageState default, global setup/teardown |
| `e2e/fixtures/auth.ts` | Ed25519 JWT minter: nonce → sign → verify → token |
| `e2e/fixtures/mocks.ts` | Route interceptors for Solana RPC + Jupiter |
| `e2e/global-setup.ts` | Loads admin keypair, mints JWT, writes storageState.json |
| `e2e/global-teardown.ts` | Wipes test.db, storageState.json |
| `e2e/.env.test` | `HERALD_ENABLED=false`, `SIPHER_DB_PATH`, `AUTHORIZED_WALLETS` |
| `e2e/chat.spec.ts` | Unauth disabled state + auth'd intercepted SSE smoke |
| `e2e/auth-flow.spec.ts` | Admin view without JWT redirects; with JWT renders |
| `e2e/dashboard.spec.ts` | Dashboard loads, metric cards render |
| `e2e/vault.spec.ts` | Vault loads, balance field present |
| `e2e/squad.spec.ts` | Squad loads, no errors |
| `e2e/herald.spec.ts` | Herald loads, budget metric visible |
| `app/vitest.config.ts` | Vitest config with jsdom env + RTL setup |
| `app/src/setupTests.ts` | `import '@testing-library/jest-dom'` |
| `app/src/components/__tests__/ChatSidebar.test.tsx` | First RTL component test |
| `.github/workflows/e2e.yml` | Path-filtered Playwright CI job |

**Modified files (3):**

| Path | Change |
|------|--------|
| `app/src/stores/app.ts` | Wrap `create` with `persist` middleware, `partialize` to `{ token, isAdmin }`, storage key `sipher-auth` |
| `package.json` | Add `@playwright/test`, add `test:e2e`, `test:e2e:ui`, `test:e2e:headed` scripts |
| `app/package.json` | Add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `vitest`, `test` script |
| `.gitignore` | Ignore `playwright-report/`, `test-results/`, `e2e/fixtures/admin-keypair.json`, `e2e/fixtures/storageState.json`, `e2e/test.db` |
| `README.md` | "Running tests" section |

---

## Task 1: Scaffold — install deps, update .gitignore, add scripts

**Files:**
- Modify: `package.json`
- Modify: `app/package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install Playwright in root**

```bash
cd ~/local-dev/sipher
pnpm add -D -w @playwright/test@^1.48.0
pnpm exec playwright install --with-deps chromium
```

Expected: Playwright installed, Chromium binary downloaded.

- [ ] **Step 2: Install Vitest + RTL in `app/`**

```bash
pnpm --filter @sipher/app add -D vitest@^2.1.0 @testing-library/react@^16.1.0 @testing-library/jest-dom@^6.6.0 @testing-library/user-event@^14.5.0 jsdom@^25.0.0
```

Expected: all deps installed, `app/package.json` updated.

- [ ] **Step 3: Add scripts to root `package.json`**

In `package.json` scripts block, add these three entries (keep existing scripts untouched):

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed"
```

- [ ] **Step 4: Add `test` script to `app/package.json`**

In `app/package.json` scripts block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Update `.gitignore`**

Append to `/Users/rector/local-dev/sipher/.gitignore`:

```
# Playwright / RTL
playwright-report/
test-results/
e2e/fixtures/admin-keypair.json
e2e/fixtures/storageState.json
e2e/test.db
e2e/test.db-journal
```

- [ ] **Step 6: Verify install**

Run:
```bash
cd ~/local-dev/sipher
pnpm exec playwright --version
pnpm --filter @sipher/app exec vitest --version
```

Expected: Playwright prints version ≥1.48, Vitest prints version ≥2.1.

- [ ] **Step 7: Commit**

```bash
git checkout -b feat/test-infra
git add package.json app/package.json pnpm-lock.yaml .gitignore
git commit -m "chore(test-infra): install Playwright, Vitest, RTL, jsdom"
```

---

## Task 2: Add `persist` middleware to Zustand store

**Files:**
- Modify: `app/src/stores/app.ts`

Rationale: Current store holds `token` in memory only. Playwright's `storageState` can only inject via localStorage. Adding `persist` enables E2E auth injection and delivers a UX win — users stay logged in across page refreshes.

- [ ] **Step 1: Replace the store export with persist wrapper**

Open `app/src/stores/app.ts`. Replace lines 1-2 (`import { create } from 'zustand'`) with:

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
```

Then replace the `export const useAppStore = create<AppState>((set) => ({ ... }))` block (lines 37-71) with:

```ts
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeView: 'dashboard',
      setActiveView: (activeView) => set({ activeView }),

      token: null,
      isAdmin: false,
      setAuth: (token, isAdmin) => set({ token, isAdmin }),
      clearAuth: () => set({ token: null, isAdmin: false, messages: [], activeView: 'dashboard' }),

      messages: [],
      chatLoading: false,
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      appendToLast: (text) =>
        set((s) => {
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: last.content + text }
          }
          return { messages: msgs }
        }),
      finishStreaming: () =>
        set((s) => {
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.streaming) {
            msgs[msgs.length - 1] = { ...last, streaming: false }
          }
          return { messages: msgs }
        }),
      setChatLoading: (chatLoading) => set({ chatLoading }),

      chatOpen: false,
      setChatOpen: (chatOpen) => set({ chatOpen }),
    }),
    {
      name: 'sipher-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, isAdmin: s.isAdmin }),
    }
  )
)
```

Keep lines 3-35 (types `View`, `ChatMessage`, `AppState`) untouched.

- [ ] **Step 2: Typecheck**

```bash
cd ~/local-dev/sipher
pnpm --filter @sipher/app exec tsc --noEmit
```

Expected: no errors. If `zustand/middleware` is unresolved, bump zustand to a version ≥4 that exports middleware (currently ^5.0.12, which includes it).

- [ ] **Step 3: Manual verification (optional dev check)**

Start Vite dev and backend, authenticate via wallet in browser, refresh the page. Session should persist. This is optional — the critical verification comes via E2E later.

- [ ] **Step 4: Commit**

```bash
git add app/src/stores/app.ts
git commit -m "feat(app): persist auth token across page refreshes"
```

---

## Task 3: Playwright config

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Write the config**

Create `/Users/rector/local-dev/sipher/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const PORT_FRONTEND = 5173
const PORT_BACKEND = 3000

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/fixtures/**'],
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: process.env.CI ? [['html'], ['github']] : [['html'], ['list']],
  globalSetup: path.resolve(__dirname, './e2e/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './e2e/global-teardown.ts'),
  use: {
    baseURL: `http://localhost:${PORT_FRONTEND}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @sipher/agent dev',
      url: `http://localhost:${PORT_BACKEND}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(PORT_BACKEND),
        HERALD_ENABLED: 'false',
        SIPHER_DB_PATH: './e2e/test.db',
        AUTHORIZED_WALLETS: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
        JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-test-secret-at-least-16-chars',
        SENTINEL_MODE: 'off',
      },
    },
    {
      command: 'pnpm --filter @sipher/app dev',
      url: `http://localhost:${PORT_FRONTEND}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
```

- [ ] **Step 2: Commit**

```bash
git add playwright.config.ts
git commit -m "chore(e2e): add Playwright config with dual webServer"
```

---

## Task 4: Auth fixture — ed25519 JWT minter

**Files:**
- Create: `e2e/fixtures/auth.ts`

- [ ] **Step 1: Write the fixture**

Create `/Users/rector/local-dev/sipher/e2e/fixtures/auth.ts`:

```ts
import fs from 'node:fs'
import { ed25519 } from '@noble/curves/ed25519'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function encodeBase58(bytes: Uint8Array): string {
  let num = 0n
  for (const b of bytes) num = num * 256n + BigInt(b)
  let str = ''
  while (num > 0n) {
    str = BASE58_ALPHABET[Number(num % 58n)] + str
    num = num / 58n
  }
  for (const b of bytes) {
    if (b !== 0) break
    str = '1' + str
  }
  return str || '1'
}

export interface LoginResult {
  token: string
  isAdmin: boolean
  wallet: string
}

export async function mintAdminJwt(
  keypairPath: string,
  apiBase: string
): Promise<LoginResult> {
  const secretKeyArr = JSON.parse(fs.readFileSync(keypairPath, 'utf-8')) as number[]
  const secretKey64 = Uint8Array.from(secretKeyArr)
  const privateKey = secretKey64.slice(0, 32)
  const publicKey = ed25519.getPublicKey(privateKey)
  const wallet = encodeBase58(publicKey)

  const nonceResp = await fetch(`${apiBase}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet }),
  })
  if (!nonceResp.ok) {
    throw new Error(`nonce failed: ${nonceResp.status} ${await nonceResp.text()}`)
  }
  const { nonce, message } = (await nonceResp.json()) as { nonce: string; message: string }

  const sigBytes = ed25519.sign(new TextEncoder().encode(message), privateKey)
  const signature = encodeBase58(sigBytes)

  const verifyResp = await fetch(`${apiBase}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, nonce, signature }),
  })
  if (!verifyResp.ok) {
    throw new Error(`verify failed: ${verifyResp.status} ${await verifyResp.text()}`)
  }
  const { token, isAdmin } = (await verifyResp.json()) as {
    token: string
    isAdmin: boolean
  }
  return { token, isAdmin, wallet }
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p e2e/fixtures
git add e2e/fixtures/auth.ts
git commit -m "feat(e2e): add ed25519 JWT minter fixture"
```

---

## Task 5: Global setup + teardown

**Files:**
- Create: `e2e/global-setup.ts`
- Create: `e2e/global-teardown.ts`

- [ ] **Step 1: Write global-setup**

Create `/Users/rector/local-dev/sipher/e2e/global-setup.ts`:

```ts
import fs from 'node:fs'
import path from 'node:path'
import { mintAdminJwt } from './fixtures/auth'

const FRONTEND_ORIGIN = 'http://localhost:5173'
const BACKEND_BASE = 'http://localhost:3000'
const STORAGE_STATE_PATH = path.resolve(__dirname, './fixtures/storageState.json')

export default async function globalSetup(): Promise<void> {
  const keypairPath =
    process.env.E2E_ADMIN_KEYPAIR_PATH ?? '/Users/rector/Documents/secret/cipher-admin.json'

  if (!fs.existsSync(keypairPath)) {
    throw new Error(
      `E2E admin keypair not found at ${keypairPath}. Set E2E_ADMIN_KEYPAIR_PATH env var.`
    )
  }

  const { token, isAdmin, wallet } = await mintAdminJwt(keypairPath, BACKEND_BASE)
  if (!isAdmin) {
    throw new Error(`Minted JWT for ${wallet} is not admin. Check AUTHORIZED_WALLETS env.`)
  }

  const zustandPayload = {
    state: { token, isAdmin },
    version: 0,
  }

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: FRONTEND_ORIGIN,
        localStorage: [{ name: 'sipher-auth', value: JSON.stringify(zustandPayload) }],
      },
    ],
  }

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2))
  console.log(`[e2e] storageState written (wallet=${wallet}, isAdmin=${isAdmin})`)
}
```

- [ ] **Step 2: Write global-teardown**

Create `/Users/rector/local-dev/sipher/e2e/global-teardown.ts`:

```ts
import fs from 'node:fs'
import path from 'node:path'

const PATHS_TO_CLEAN = [
  path.resolve(__dirname, './fixtures/storageState.json'),
  path.resolve(__dirname, './test.db'),
  path.resolve(__dirname, './test.db-journal'),
]

export default async function globalTeardown(): Promise<void> {
  for (const p of PATHS_TO_CLEAN) {
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/global-setup.ts e2e/global-teardown.ts
git commit -m "feat(e2e): add global setup (JWT mint) and teardown (cleanup)"
```

---

## Task 6: Mocks fixture — Solana RPC + Jupiter interceptors

**Files:**
- Create: `e2e/fixtures/mocks.ts`

- [ ] **Step 1: Write the mocks module**

Create `/Users/rector/local-dev/sipher/e2e/fixtures/mocks.ts`:

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fixtures/mocks.ts
git commit -m "feat(e2e): add Solana RPC + Jupiter route interceptors"
```

---

## Task 7: Chat spec — unauth disabled state + intercepted SSE smoke

**Files:**
- Create: `e2e/chat.spec.ts`

Note: the ChatSidebar gates sending on presence of `token` (shows placeholder "Connect wallet first" and disables input). Unauth smoke verifies gating. Auth smoke intercepts the POST to `/api/chat/stream` with a canned SSE response so the test is hermetic.

- [ ] **Step 1: Write the spec**

Create `/Users/rector/local-dev/sipher/e2e/chat.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the spec locally**

```bash
cd ~/local-dev/sipher
pnpm test:e2e chat.spec.ts
```

Expected: both tests pass. If not, inspect `playwright-report/` output.

- [ ] **Step 3: Commit**

```bash
git add e2e/chat.spec.ts
git commit -m "test(e2e): add chat sidebar smoke (unauth disabled + auth'd SSE)"
```

---

## Task 8: Auth flow spec

**Files:**
- Create: `e2e/auth-flow.spec.ts`

- [ ] **Step 1: Write the spec**

Create `/Users/rector/local-dev/sipher/e2e/auth-flow.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run**

```bash
pnpm test:e2e auth-flow.spec.ts
```

Expected: both tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/auth-flow.spec.ts
git commit -m "test(e2e): add auth flow smoke (unauth gate + injected JWT)"
```

---

## Task 9: Dashboard spec

**Files:**
- Create: `e2e/dashboard.spec.ts`

- [ ] **Step 1: Write the spec**

Create `/Users/rector/local-dev/sipher/e2e/dashboard.spec.ts`:

```ts
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
```

- [ ] **Step 2: Add `data-testid="dashboard-view"` to the view root**

Open `app/src/views/DashboardView.tsx`. Locate the outermost wrapping JSX element in the default-exported component and add `data-testid="dashboard-view"`. If the root already has other attributes, append; do not remove.

- [ ] **Step 3: Run**

```bash
pnpm test:e2e dashboard.spec.ts
```

Expected: passes. If the selector misses, inspect the rendered HTML via `pnpm test:e2e:headed dashboard.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add e2e/dashboard.spec.ts app/src/views/DashboardView.tsx
git commit -m "test(e2e): add dashboard view smoke"
```

---

## Task 10: Vault spec

**Files:**
- Create: `e2e/vault.spec.ts`
- Modify: `app/src/views/VaultView.tsx` (add `data-testid="vault-view"`)

- [ ] **Step 1: Write the spec**

Create `/Users/rector/local-dev/sipher/e2e/vault.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { mockSolanaRpc } from './fixtures/mocks'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.use({ storageState: AUTH_STATE })

test('vault view renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await mockSolanaRpc(page)
  await page.goto('/')
  await page.getByRole('button', { name: /vault/i }).first().click()
  await expect(page.locator('[data-testid="vault-view"]')).toBeVisible()
  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Add `data-testid="vault-view"` to `VaultView.tsx` root**

Same pattern as Task 9 Step 2.

- [ ] **Step 3: Run**

```bash
pnpm test:e2e vault.spec.ts
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add e2e/vault.spec.ts app/src/views/VaultView.tsx
git commit -m "test(e2e): add vault view smoke"
```

---

## Task 11: Squad spec

**Files:**
- Create: `e2e/squad.spec.ts`
- Modify: `app/src/views/SquadView.tsx` (add `data-testid="squad-view"`)

- [ ] **Step 1: Write the spec**

Create `/Users/rector/local-dev/sipher/e2e/squad.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const AUTH_STATE = 'e2e/fixtures/storageState.json'

test.use({ storageState: AUTH_STATE })

test('squad view renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('/')
  await page.getByRole('button', { name: /squad/i }).first().click()
  await expect(page.locator('[data-testid="squad-view"]')).toBeVisible()
  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Add `data-testid="squad-view"` to `SquadView.tsx` root**

- [ ] **Step 3: Run**

```bash
pnpm test:e2e squad.spec.ts
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add e2e/squad.spec.ts app/src/views/SquadView.tsx
git commit -m "test(e2e): add squad view smoke"
```

---

## Task 12: Herald spec

**Files:**
- Create: `e2e/herald.spec.ts`
- Modify: `app/src/views/HeraldView.tsx` (add `data-testid="herald-view"`)

- [ ] **Step 1: Write the spec**

Create `/Users/rector/local-dev/sipher/e2e/herald.spec.ts`:

```ts
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
```

- [ ] **Step 2: Add `data-testid="herald-view"` to `HeraldView.tsx` root**

- [ ] **Step 3: Run**

```bash
pnpm test:e2e herald.spec.ts
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add e2e/herald.spec.ts app/src/views/HeraldView.tsx
git commit -m "test(e2e): add herald view smoke"
```

---

## Task 13: Vitest config + RTL setup for `app/`

**Files:**
- Create: `app/vitest.config.ts`
- Create: `app/src/setupTests.ts`

- [ ] **Step 1: Write Vitest config**

Create `/Users/rector/local-dev/sipher/app/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
```

- [ ] **Step 2: Write setup file**

Create `/Users/rector/local-dev/sipher/app/src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Smoke-test the harness**

Create a temporary `app/src/components/__tests__/smoke.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('rtl harness', () => {
  it('renders text', () => {
    render(<div>hello</div>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
```

Run:

```bash
pnpm --filter @sipher/app test
```

Expected: 1 test passes.

- [ ] **Step 4: Delete the smoke file** (will be replaced by the real ChatSidebar test in Task 14)

```bash
rm app/src/components/__tests__/smoke.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add app/vitest.config.ts app/src/setupTests.ts
git commit -m "chore(app): configure Vitest with jsdom + @testing-library/jest-dom"
```

---

## Task 14: ChatSidebar component test

**Files:**
- Create: `app/src/components/__tests__/ChatSidebar.test.tsx`

Covers: unauth placeholder, auth'd send flow (mocked `fetch`), SSE parse → `appendToLast`, tool-use indicator.

- [ ] **Step 1: Write the test**

Create `/Users/rector/local-dev/sipher/app/src/components/__tests__/ChatSidebar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAppStore } from '../../stores/app'
import ChatSidebar from '../ChatSidebar'

function resetStore() {
  useAppStore.setState({
    token: null,
    isAdmin: false,
    messages: [],
    chatLoading: false,
    chatOpen: false,
    activeView: 'dashboard',
  })
}

describe('ChatSidebar', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows connect-wallet placeholder and disables input when unauthenticated', () => {
    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Connect wallet first')
    expect(input).toBeDisabled()
  })

  it('enables input when authenticated', () => {
    useAppStore.setState({ token: 'test-jwt', isAdmin: true })
    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Message SIPHER...')
    expect(input).toBeEnabled()
  })

  it('sends message and appends streamed reply', async () => {
    useAppStore.setState({ token: 'test-jwt', isAdmin: true })

    const encoder = new TextEncoder()
    const sseBody = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"content_block_delta","text":"Hi"}\n\n')
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(sseBody, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      )
    )

    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Message SIPHER...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(screen.getByText('Hi')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run**

```bash
pnpm --filter @sipher/app test
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/__tests__/ChatSidebar.test.tsx
git commit -m "test(app): add ChatSidebar component tests (unauth, auth, stream)"
```

---

## Task 15: GitHub Actions E2E workflow

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Write the workflow**

Create `/Users/rector/local-dev/sipher/.github/workflows/e2e.yml`:

```yaml
name: e2e

on:
  pull_request:
    paths:
      - 'app/**'
      - 'packages/agent/**'
      - 'src/**'
      - 'e2e/**'
      - 'playwright.config.ts'
      - 'package.json'
      - 'app/package.json'
      - 'pnpm-lock.yaml'
      - '.github/workflows/e2e.yml'
  push:
    branches: [main]

jobs:
  component:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run app component tests
        run: pnpm --filter @sipher/app test

  playwright:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    continue-on-error: true
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm exec playwright install --with-deps chromium

      - name: Write E2E admin keypair
        env:
          E2E_ADMIN_KEYPAIR: ${{ secrets.E2E_ADMIN_KEYPAIR }}
        run: |
          mkdir -p e2e/fixtures
          printf '%s' "$E2E_ADMIN_KEYPAIR" > e2e/fixtures/admin-keypair.json
          chmod 600 e2e/fixtures/admin-keypair.json

      - name: Run Playwright
        env:
          E2E_ADMIN_KEYPAIR_PATH: e2e/fixtures/admin-keypair.json
          JWT_SECRET: ${{ secrets.E2E_JWT_SECRET }}
        run: pnpm test:e2e

      - if: failure() || cancelled()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

Notes:
- `continue-on-error: true` on the playwright job is intentional for the initial 2-3 PRs — flip to false once the workflow stabilizes.
- The `component` job has no `continue-on-error` — Vitest component tests are fast and deterministic; any failure should block.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: add Playwright E2E + app component tests workflow (path-filtered)"
```

---

## Task 16: Document GitHub Secret + README section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Manually create the GitHub Secret** (operator task, not automated)

RECTOR runs locally (not CI, not code):

```bash
gh secret set E2E_ADMIN_KEYPAIR < ~/Documents/secret/cipher-admin.json --repo sip-protocol/sipher
gh secret set E2E_JWT_SECRET --repo sip-protocol/sipher
# Paste: any 32+ char string, e.g. `openssl rand -hex 32`
```

- [ ] **Step 2: Append "Running tests" section to `README.md`**

Locate a logical spot in `README.md` (after the "Development" or "Getting Started" section). Append:

```markdown
## Running Tests

### Backend + Agent (Vitest)

```bash
pnpm test -- --run                           # Root REST tests
pnpm --filter @sipher/agent test -- --run    # Agent tests
```

### Frontend component tests (Vitest + RTL)

```bash
pnpm --filter @sipher/app test
```

### End-to-end (Playwright, Chromium)

```bash
pnpm exec playwright install chromium    # one-time browser install
pnpm test:e2e                            # run all e2e specs
pnpm test:e2e:ui                         # interactive UI mode
pnpm test:e2e:headed                     # watch tests run in a visible browser
```

Playwright runs against the Vite dev server (port 5173) and the Sipher backend (port 3000), both spun up automatically via its `webServer` config. Admin flows use an ed25519-signed JWT minted at global-setup. Locally, this reads `~/Documents/secret/cipher-admin.json`; in CI, the `E2E_ADMIN_KEYPAIR` GitHub Secret supplies it.

See [`docs/superpowers/specs/2026-04-18-test-infrastructure-design.md`](docs/superpowers/specs/2026-04-18-test-infrastructure-design.md) for architectural details.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): add 'Running Tests' section covering Vitest + Playwright"
```

---

## Task 17: Final verification — full suite run

**Files:** none (verification only)

- [ ] **Step 1: Regenerate `storageState.json` for fresh run**

```bash
cd ~/local-dev/sipher
rm -f e2e/fixtures/storageState.json e2e/test.db
```

- [ ] **Step 2: Run full E2E suite**

```bash
pnpm test:e2e
```

Expected: 6 specs pass (chat with 2 cases, auth-flow with 2, dashboard, vault, squad, herald — 8 tests total), under 90s local runtime.

- [ ] **Step 3: Run component tests**

```bash
pnpm --filter @sipher/app test
```

Expected: 3 tests pass (ChatSidebar).

- [ ] **Step 4: Check HTML report exists**

```bash
ls playwright-report/index.html
```

Expected: file present.

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin feat/test-infra
gh pr create --title "feat(test-infra): Playwright E2E + Vitest+RTL component tests" --body "$(cat <<'EOF'
## Summary

Phase 1 of the audit-driven work. Lands the missing test infrastructure layers:

- Playwright ^1.48 (Chromium) — 6 E2E specs, one per UI surface
- Vitest + @testing-library/react + jsdom — component tests for `app/`
- Path-filtered GitHub Actions workflow (`.github/workflows/e2e.yml`)
- Ed25519-signed JWT fixture for authenticated E2E flows
- Zustand `persist` middleware for `token`/`isAdmin` (UX bonus: session persists on refresh)

All external network (Solana RPC, Jupiter, Pi SDK, X) mocked or disabled — no API keys required in CI.

## Test plan

- [x] All 8 Playwright tests pass locally
- [x] All 3 Vitest component tests pass locally
- [x] `pnpm test -- --run` still green (no existing tests broken)
- [x] `pnpm typecheck` clean
- [ ] CI run green on PR (manual verify after push)
- [ ] `E2E_ADMIN_KEYPAIR` + `E2E_JWT_SECRET` GitHub Secrets set before CI run

Spec: `docs/superpowers/specs/2026-04-18-test-infrastructure-design.md`
EOF
)"
```

Expected: PR created. Wait for CI. If green, flip `continue-on-error: true` → `false` in a follow-up PR.

- [ ] **Step 6: Verify CI green** (manual — after push)

Watch `gh pr checks` until green or investigate failure via artifacts.

---

## Success Criteria (from spec)

- [ ] `pnpm test:e2e` runs locally and all 8 test cases pass on a clean checkout
- [ ] `pnpm --filter @sipher/app test` runs locally and 3 ChatSidebar component tests pass
- [ ] `.github/workflows/e2e.yml` triggers on a UI-touching PR and passes
- [ ] `E2E_ADMIN_KEYPAIR` and `E2E_JWT_SECRET` secrets exist in the repo
- [ ] Path filter correctly skips E2E on backend-only or docs-only PRs
- [ ] No test makes real network calls to Solana RPC, LLM providers, X API, or Jupiter
- [ ] HTML report uploaded on failure, downloadable from Actions tab
- [ ] README has "Running tests" section linking to the spec
