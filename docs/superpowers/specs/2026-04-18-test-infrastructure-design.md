# Test Infrastructure — Design Spec

**Date:** 2026-04-18
**Status:** Approved, ready for implementation plan
**Scope:** Phase 1 of the "address all audit findings" multi-phase effort
**Related audits:** Spec-vs-implementation gap audit, test-coverage audit (both 2026-04-18)

## Summary

Ship the missing test infrastructure layers that Sipher's audits revealed: end-to-end browser tests via Playwright, and React component tests via Vitest + @testing-library/react + jsdom. Land a lean scaffold — one smoke test per UI surface plus one component test — and wire it into GitHub CI with path-filtered triggering. Subsequent phases (UI gap fixes, REST service tests, tool backfills) arrive on top of this foundation already-tested.

## Context

The 2026-04-18 test-coverage audit found:

- **Zero Playwright infrastructure.** No `playwright.config.ts`, no `@playwright/test`, no `e2e/` directory. The entire 2,079-line Command Center UI (`app/`) ships without any browser-level verification.
- **Zero component tests in `app/`.** 23 React source files (views, hooks, components, Zustand store, API client, SSE hook) have no unit or integration tests at all.
- **Backend coverage is strong** — 1,553 test cases across Vitest suites — but the UI layer is uncovered.

Subsequent audit-driven work (UI gap fixes in Phase 2, tool unit test backfills in Phase 5) will ship code that either arrives untested or has to be back-tested later. Landing infra first eliminates that choice.

## Goals

- Ship a working Playwright E2E harness on Chromium, spinning up the real Vite dev server.
- Ship a working Vitest + RTL component test harness for `app/`.
- Land six E2E smoke tests (one per view + chat public + auth flow) and one component test.
- Wire both harnesses into GitHub Actions with PR path filtering, failing the build on broken tests.
- Provide an authenticated test fixture (ed25519 JWT signing) reusable across auth-gated tests.

## Non-goals

- Writing component tests for all 23 UI files. Further component tests arrive during Phase 2 alongside the UI gap fixes they cover.
- Cross-browser matrix (WebKit, Firefox). Chromium only.
- Visual regression (Percy, Chromatic, screenshot diffing).
- Storybook.
- Coverage reports from Playwright. Vitest already owns source coverage.
- LLM behavior testing. Chat smoke asserts the stream opens and receives the first SSE event, nothing deeper.

## Architecture

**Two independent test layers, one shared stack:**

```
┌──────────────────────────────────────────────────┐
│  Playwright (e2e/)                               │
│  ─ Launches Vite dev server on :5174             │
│  ─ Chromium headless                             │
│  ─ Tests against real browser + real backend     │
│  ─ Mocks external network (RPC, Jupiter, X)      │
└──────────────────────────────────────────────────┘
                       +
┌──────────────────────────────────────────────────┐
│  Vitest + RTL + jsdom (app/src/**/__tests__/)    │
│  ─ Component-level unit/integration              │
│  ─ Runs in jsdom (no browser)                    │
│  ─ Reuses existing Vitest config patterns        │
└──────────────────────────────────────────────────┘
```

The two layers cover different concerns and do not overlap: Playwright validates that views *render and flow* through real routing + state + SSE + middleware; RTL validates that individual components *behave* in isolation.

## File Layout

```
sipher/
├── playwright.config.ts              # webServer: pnpm dev on :5174
├── e2e/
│   ├── fixtures/
│   │   ├── auth.ts                   # ed25519 JWT helper (ported from /tmp/sipher-login.mjs)
│   │   ├── storageState.json         # gitignored; generated per run
│   │   └── admin-keypair.json        # gitignored; hydrated from GH secret in CI
│   ├── global-setup.ts               # mint JWT, write storageState
│   ├── global-teardown.ts            # wipe test.db + storageState
│   ├── dashboard.spec.ts
│   ├── vault.spec.ts
│   ├── squad.spec.ts
│   ├── herald.spec.ts
│   ├── chat-public.spec.ts
│   └── auth-flow.spec.ts
├── app/
│   ├── vitest.config.ts              # jsdom env, setupFiles
│   ├── src/
│   │   └── setupTests.ts             # imports @testing-library/jest-dom
│   └── src/components/__tests__/
│       └── ChatSidebar.test.tsx      # first component smoke
└── .github/workflows/
    └── e2e.yml                       # Playwright PR workflow
```

**Gitignored:**
- `e2e/fixtures/storageState.json`
- `e2e/fixtures/admin-keypair.json`
- `e2e/test.db`
- `playwright-report/`
- `test-results/`

## Smoke Test Surface

Six Playwright specs, each asserting a small set of visible-DOM facts and global "no console errors / pageerror" invariants.

| Spec | Auth | Assertions |
|------|------|-----------|
| `chat-public.spec.ts` | none | Sidebar opens, send box accepts input, POST to `/api/chat/stream` fires; Playwright intercepts the request and returns a canned SSE stream so the test validates the client's stream-to-bubble render path without invoking the real agent |
| `auth-flow.spec.ts` | both | Unauth GET to admin view returns 401/redirect; with injected JWT, admin view renders |
| `dashboard.spec.ts` | admin | Mounts, all four metric cards render (placeholders ok), activity feed container present |
| `vault.spec.ts` | admin | Mounts, balance field is populated (not infinite spinner), deposit list container present |
| `squad.spec.ts` | admin | Mounts, squad grid container present |
| `herald.spec.ts` | admin | Mounts, agent-status widget renders, budget metric visible (admin-only card actually appears) |

**Global invariants enforced in every test via Playwright fixtures:**

- `page.on('pageerror', ...)` collects uncaught errors — any error fails the test.
- `page.on('console', msg => msg.type() === 'error')` collects `console.error` — fails test unless explicitly allow-listed.

## Auth Strategy

Wallet signing is impossible in a headless browser. Instead, Playwright's `globalSetup` mints a real JWT out-of-band and injects it into localStorage via `storageState`.

**Flow:**

1. `e2e/global-setup.ts` runs once before all tests.
2. Loads the admin keypair from `E2E_ADMIN_KEYPAIR_PATH` (locally: `~/Documents/secret/cipher-admin.json`; in CI: `e2e/fixtures/admin-keypair.json`, hydrated from the `E2E_ADMIN_KEYPAIR` GitHub Secret).
3. Fetches a nonce from `POST http://localhost:5174/api/auth/nonce`.
4. Signs the nonce with `@noble/curves/ed25519`.
5. Exchanges the signature for a JWT at `POST /api/auth/login`.
6. Writes `e2e/fixtures/storageState.json` with the JWT in localStorage under Sipher's expected key.

**Per-test opt-in:**

```ts
test.use({ storageState: 'e2e/fixtures/storageState.json' })  // admin tests
test.use({ storageState: { cookies: [], origins: [] } })      // unauth tests
```

The cipher-admin pubkey (`C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N`) is added to `AUTHORIZED_WALLETS` via `.env.test`, so `isAdmin=true` on login.

## External Network Strategy

All external dependencies are mocked or disabled. No test depends on devnet uptime, LLM API keys, X API quota, or Jupiter liveness.

| Service | Strategy |
|---------|----------|
| Solana RPC | Playwright route interceptor on `**/api/rpc/**` returns canned balances and signatures |
| Pi SDK (LLM) | `chat-public.spec.ts` intercepts `POST **/api/chat/stream` at the Playwright layer and responds with a canned SSE stream. The backend agent and Pi SDK are never invoked during E2E. No `OPENROUTER_API_KEY` required in CI. |
| X API (HERALD) | Poller disabled via `HERALD_ENABLED=false` in `.env.test` |
| Jupiter | Route interceptor on `**/quote`, `**/swap` returns canned quotes |

## Test Data

- **Test DB:** `SIPHER_DB_PATH=./e2e/test.db` — isolated SQLite, recreated per run.
- **Seed:** `global-setup` inserts one dummy deposit, one blacklist entry, and ensures the admin pubkey is in `AUTHORIZED_WALLETS`.
- **Teardown:** `global-teardown` wipes `test.db` and `storageState.json`.

## Component Test Harness

**Config:** `app/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  },
})
```

**`src/setupTests.ts`:** `import '@testing-library/jest-dom'`

**First test — `ChatSidebar.test.tsx`:**

- Renders closed state, opens on trigger
- Accepts text input, submit dispatches fetch to `/api/chat/stream`
- Renders bubble from streamed SSE (mock `EventSource`)

Further component tests land during Phase 2 UI work, not Phase 1.

## CI Integration

**New workflow:** `.github/workflows/e2e.yml`

Triggers:
- `pull_request` with path filter: `app/**`, `packages/agent/**`, `src/**`, `e2e/**`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/e2e.yml`
- `push` to `main`

Steps:
1. Checkout, setup pnpm + Node 22
2. `pnpm install --frozen-lockfile`
3. `pnpm exec playwright install --with-deps chromium`
4. Write admin keypair from `E2E_ADMIN_KEYPAIR` secret → `e2e/fixtures/admin-keypair.json` (chmod 600)
5. `pnpm test:e2e` with env: `E2E_ADMIN_KEYPAIR_PATH`, `HERALD_ENABLED=false`, `SIPHER_DB_PATH=./e2e/test.db`, `AUTHORIZED_WALLETS=C1phr...x85N`
6. On failure: upload `playwright-report/` as artifact (14-day retention)

**Component test CI:**
- Add `pnpm --filter app test` to the existing PR check workflow under the same path filter.

**Required GitHub Secret:**
- `E2E_ADMIN_KEYPAIR` — raw JSON content of `~/Documents/secret/cipher-admin.json`. Added manually via `gh secret set E2E_ADMIN_KEYPAIR < ~/Documents/secret/cipher-admin.json`. Rotatable.

**Rollout safety:**
- First 2-3 PRs: workflow runs with `continue-on-error: true` so infra flakiness doesn't block real work.
- Flip to required check once stable.
- HTML report uploaded on failure.

## Package Additions

**Root `package.json` devDependencies:**
- `@playwright/test`
- `@noble/curves` (already present — reused)

**`app/package.json` devDependencies:**
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`
- `vitest` (if not already in `app/`)
- `@vitejs/plugin-react` (if not already in `app/`)

**Root `package.json` scripts:**
- `test:e2e`: `playwright test`
- `test:e2e:ui`: `playwright test --ui` (local dev helper)
- `test:e2e:headed`: `playwright test --headed` (local dev helper)

## Success Criteria

- [ ] `pnpm test:e2e` runs locally and all 6 specs pass on a clean checkout
- [ ] `pnpm --filter app test` runs locally and the ChatSidebar component test passes
- [ ] `.github/workflows/e2e.yml` triggers on a UI-touching PR and passes
- [ ] `E2E_ADMIN_KEYPAIR` secret exists in the repo
- [ ] Path filter correctly skips E2E on backend-only or docs-only PRs
- [ ] No test makes real network calls to Solana RPC, LLM providers, X API, or Jupiter
- [ ] HTML report uploaded on failure, downloadable from Actions tab
- [ ] README has a short "Running tests" section linking to this spec

## Risks and Alternatives

**Running against the deployed VPS instead of local dev server.** Rejected — would bleed real state into a prod SQLite (blacklist entries, SENTINEL decisions, audit log). Safer to mock in hermetic local runs; prod smoke-testing belongs in a separate manual workflow, not CI.

**Skipping auth and testing unauth views only.** Rejected — half the surface (admin views, vault, herald controls) would go untested forever.

**Mocking the auth hook in-app during E2E mode.** Rejected — bypasses the real auth middleware, letting regressions in auth code ship silently. JWT injection via storageState is only marginally more work and exercises the real path.

**Adding WebKit and Firefox now.** Rejected (YAGNI) — professional-dev audience, Chromium dominates. Easy to add later if real users hit browser-specific bugs.

**Running Playwright on every PR regardless of path.** Rejected — most Sipher PRs touch docs, backend, or infra. Running a 1-2 min E2E job on every PR wastes CI minutes. Path filter gives full coverage where it matters.

**Visual regression (Percy, Chromatic).** Deferred — would catch UI drift but requires third-party service, costs money, and produces noisy diffs during active UI development. Worth revisiting after Phase 2 UI work stabilizes.

## Implementation Notes

- Port the existing `/tmp/sipher-login.mjs` ed25519 signing logic into `e2e/fixtures/auth.ts` as a reusable helper. This is the single source of truth for test-mode JWT minting; if the auth flow changes, this file is the only place to update.
- Route interceptors live in a shared `e2e/fixtures/mocks.ts` and are attached per-test via a Playwright fixture extension. No per-test boilerplate.
- `playwright.config.ts` sets `webServer.reuseExistingServer = !process.env.CI` so local reruns are fast but CI always gets a clean boot.
- Set `fullyParallel: true` with `workers: 2` in CI to keep under 10-minute timeout.

## Out of Scope (for later phases)

- UI gap fixes (privacy score computation, tool-use indicators, color dots, ConfirmCard wiring, HERALD queue, MetricCard gating) — Phase 2.
- SENTINEL external-tool surface docs cleanup — Phase 3.
- REST service tests (chain-transfer-builder, transaction-builder, private-swap-builder) — Phase 4.
- Tool unit test backfills (29 tools) — Phase 5.
- Chrome MCP QA against live VPS — Phase 6.
