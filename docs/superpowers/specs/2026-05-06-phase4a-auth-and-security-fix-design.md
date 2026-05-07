# Phase 4a — Auth Architecture + Security Hardening Design Spec

**Status:** Proposed 2026-05-06 (pending RECTOR review)
**Author:** RECTOR + CIPHER (post-QA brainstorm)
**Trigger:** `/quality:qa` Phase 1 (dev-QA) surfaced 13 high-priority + 14 next-refactor + 12 polish + 7 pattern findings against `sipher.sip-protocol.org` devnet beta. X thread #1 launch held pending fix.
**Predecessor specs:** `2026-05-05-phase4-split-devnet-beta-mainnet-design.md` (Phase 4a/4b split, locks D1-D9 of devnet-beta-then-mainnet sequencing)
**Predecessor handoffs:** `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-06-c.md` (PR-A1/A2/A3 shipped, VPS flipped to devnet, X thread held)

---

## Why This Spec Exists

The Phase 4a launch sequence — VPS flip from mainnet → devnet, X thread #1 publish, Steave Superteam DM, ≥3-day soak, gate-check — depends on `sipher.sip-protocol.org` working correctly for a public devnet beta audience. After the VPS flip on 2026-05-06T04:26:47Z, manual QA + a multi-agent dev-QA pass identified 13 high-priority bugs that collectively make the live experience unsuitable for the announced audience.

Critically, the `/quality:qa` Phase 1 dev-QA agents identified that the bugs are not 13 independent issues — they are *symptoms of architectural gaps* in the auth flow (frontend) and ephemeral state management (backend). Patching the symptoms individually leaves the architectural debt for the next set of bugs to exploit.

This spec captures the proper-fix design decisions to address the architectural gaps once and produce a foundation suitable for both the devnet beta soak and the subsequent Phase 4b mainnet launch.

---

## Project Goals

After this fix completes:

1. **Wallet auth works for all wallet-standard wallets** — Phantom, Solflare, Backpack, Jupiter, OKX. SIWS-supporting wallets get the optimal one-popup connect+sign; SIWS-missing wallets get an automatic `signMessage` fallback. No silent failures.
2. **JWT lifecycle is graceful** — 24h TTL, optional refresh endpoint, global 401 interceptor that detects expiry, calls `clearAuth()`, and triggers re-auth via toast + button. No more "looks-authenticated-but-everything-401s" silent failures.
3. **Auth state has one source of truth** — the `AuthSync` provider centralizes wallet-adapter, Zustand store, and JWT validity. Every component reads the same state. Disconnect/expiry/wallet-switch all clean up consistently.
4. **Desktop has a Disconnect path** — wallet pill click opens a dropdown with Copy address / Re-sign in / Disconnect. Mobile already has it (BottomNav); desktop reaches parity.
5. **Backend auth surface is hardened** — `app.set('trust proxy')` configured, input validation on `/api/auth/nonce`, per-IP rate limit on anonymous endpoints, ephemeral state ready for horizontal scaling (Redis-backed-with-fallback).
6. **Mainnet leak risk eliminated** — every backend file goes through `loadNetworkConfig()` instead of `process.env.SOLANA_NETWORK ?? 'mainnet-beta'`. ESLint rule prevents new violations.
7. **Boot-failure proof container** — `SIPHER_NETWORK` declared in `docker-compose.yml`. Future `pnpm install` + `docker compose up -d` boots cleanly.
8. **`/pay/:id/confirm` is fail-closed** — RPC outage no longer auto-marks payment links paid. Fallback RPC + retry, then 503 if both fail.
9. **SENTINEL defaults are safe-side** — `SENTINEL_MODE` defaults to `'advisory'` (not `'yolo'`) when env is missing. Operator misconfig can't accidentally enable autonomy.

After all the above:
- `/quality:qa` re-run produces zero P0 findings on the auth/security surface
- VPS flip back-and-forth (mainnet ↔ devnet) is non-event for users
- Gate-check at Day 3 reflects real-tester behavior, not auth-bug-driven attrition

---

## Locked Decisions

### D1 — Scope: proper fix (architectural), not hotfix

Hotfix path was rejected. The 13 high-priority dev-QA findings cluster into 4 architectural patterns (FE X-1 single auth state source, BE X-1 module-state, BE X-2 SOLANA_NETWORK drift, BE X-4 fail-open-as-default). Patching each finding individually leaves the patterns alive — every future feature added to the codebase is a vector for the same class of bug.

Proper-fix takes ~1.5 extra days vs. hotfix (~3 days vs. ~1.5) but delivers:
- Zero same-class regressions
- Single source of truth for auth state (FE) and ephemeral state (BE)
- ESLint guard rail preventing the SOLANA_NETWORK pattern from re-emerging
- Foundation for Phase 4b mainnet without inheriting devnet-beta debt

**Trade-off accepted:** launch slips from "tonight" to ~2026-05-09/10. X thread #1 has not been published yet; no external commitment. Devnet beta soak is ≥3 days minimum anyway, so the slip does not push out the mainnet timeline.

### D2 — PR structure: 2 PRs in `sipher` repo (with optional 3rd)

| PR | Branch | Scope | Estimated wall time |
|----|--------|-------|---------------------|
| **PR 1** | `feat/authsync-architecture` | Frontend AuthSync provider + dropdown UI + SIWS fallback + JWT lifecycle | ~10-12h focused |
| **PR 2** | `feat/auth-surface-hardening` | Backend trust proxy, input validation, rate limiting, ephemeral state centralization, SOLANA_NETWORK migration, pay fail-closed, SIPHER_NETWORK in compose, SENTINEL_MODE default | ~12-16h focused |
| **PR 3** *(optional)* | `feat/error-envelope-unification` | Unify error envelopes across `/api/auth/*`, `/api/herald`, `/pay/*`, `/api/vault`, `/api/chat/*` to the SENTINEL `{error: {code, message}}` shape; structured logging migration | ~6-8h focused |

PR 1 and PR 2 are **independent** at the file-system level (FE = `app/src/`, BE = `src/` + `packages/`) and can be reviewed in parallel. They do touch the auth contract — but the contract changes (new `/api/auth/refresh` endpoint, error envelope shape) are additive on the BE side, so FE can ship against current BE. The integration smoke-test happens after both merge.

PR 3 is genuinely deferrable. It's a refactor for consistency; ship if/when there's bandwidth between PR 2 merge and X thread #1.

### D3 — Single auth state source: `AuthSync` provider (frontend)

A new top-level provider/hook owns:
- Subscription to wallet-adapter `connect`/`disconnect`/`accountChange` events
- JWT decode + `expiresAt` computation from `exp` claim
- Persistent state via Zustand `persist` (with `version: 1` + `migrate` function for schema evolution)
- Active expiry watcher (`setTimeout` scheduled to expiry minus 60s buffer)
- Global 401 fetch interceptor (intercepts all `apiFetch` 401 responses, calls `clearAuth()`, emits toast event)
- Reconciliation: if `publicKey?.toBase58()` differs from last-authed-wallet, clear JWT and re-auth

API surface (TypeScript):
```typescript
function useAuthState(): {
  status: 'connecting' | 'unauthed' | 'authed' | 'expired' | 'error';
  token: string | null;
  expiresAt: number | null;  // unix epoch seconds
  isAdmin: boolean;
  publicKey: string | null;
  authenticate: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
};
```

All auth-touching components (`Header.tsx`, `BottomNav.tsx`, `ChatSidebar.tsx`, `SentinelConfirm.tsx`, `DashboardView.tsx`, `VaultView.tsx`) migrate to consume `useAuthState()` instead of mixing `useWallet()` + `useAppStore` + ad-hoc fetch logic.

### D4 — JWT lifecycle: 24h TTL + `/api/auth/refresh` + 401 interceptor (combination)

Three parts working together:

**Part A — Extend TTL to 24h.** `JWT_EXPIRY` becomes env-configurable (default `24h` for production, `1h` for tests). Modest extension; not "long-lived JWT" territory but enough to absorb tab-open-and-walk-away usage without churn.

**Part B — Add `POST /api/auth/refresh`.** Accepts `Authorization: Bearer <still-valid-jwt>` header. If JWT is valid AND less than 5 minutes from expiry, issue a fresh JWT with new `iat`/`exp`. Otherwise return 401 (force full re-sign-in). This handles long-running sessions without requiring re-sign every 24h. Frontend AuthSync provider triggers `/refresh` automatically when within the 5-minute window.

**Part C — 401 interceptor in `apiFetch`.** Any 401 response from any backend endpoint triggers: `clearAuth()` → toast `"Session expired — please sign in again"` → CTA button to invoke `authenticate()`. No more raw error string leaking into chat or dashboard.

Combined effect: typical user never re-signs during a session. If they do (24h+ usage or wallet switch), the recovery flow is graceful and obvious.

### D5 — SIWS strategy: try SIWS first, fall back to `signMessage`

Connect handler logic:

```typescript
async function authenticate(wallet: Wallet) {
  // Path 1: Wallet-Standard SIWS feature
  if ('signIn' in wallet.adapter && wallet.adapter.signIn) {
    try {
      const siwsInput = buildSiwsInput(serverNonce, message);
      const result = await wallet.adapter.signIn(siwsInput);
      if (result.sign_in_result) {
        return await verify(result.sign_in_result);
      }
      // Fall through to Path 2 if no result
    } catch (err) {
      if (isUserRejection(err)) throw err;  // don't fall through on explicit reject
      // Otherwise fall through to Path 2
    }
  }

  // Path 2: signMessage fallback
  if (wallet.adapter.signMessage) {
    const sig = await wallet.adapter.signMessage(encode(message));
    return await verify(sig);
  }

  throw new Error("This wallet doesn't support sign-in. Try Phantom or Solflare.");
}
```

This unblocks Jupiter / OKX / older Backpack while preserving the optimal one-popup UX for SIWS-supporting wallets. User-rejection is propagated correctly (no silent fallback that re-prompts).

### D6 — Disconnect UI on desktop: dropdown menu

Wallet pill in `Header.tsx` becomes always-clickable. Click opens a small dropdown (Tailwind/Phosphor, no Radix dep added):

```
┌─────────────────────────┐
│ HciZ...25En         [≡] │  ← clickable, shows chevron
└─────────────────────────┘
       ↓ on click
┌─────────────────────────┐
│ 📋 Copy address         │
│ 🔄 Re-sign in           │
│ 🔌 Disconnect           │
└─────────────────────────┘
```

(No emojis in actual implementation per CLAUDE.md — use Phosphor icons: `Copy`, `ArrowsClockwise`, `Plug`.)

`Disconnect` calls `wallet.disconnect()` AND `clearAuth()` AND `setVisible(false)` (the wallet-adapter modal). Fixes FE H-5 + H-6 simultaneously.

Mobile UI stays as-is in `BottomNav.tsx`'s More sheet.

### D7 — Pay endpoint: fallback RPC + retry, then fail-closed

`/pay/:id/confirm` current behavior: catches any RPC error, returns `{valid: true}` with `console.warn`.

New behavior:
1. Try primary RPC (devnet/mainnet endpoint from `loadNetworkConfig()`).
2. On error, try fallback RPC (`SOLANA_RPC_URL_FALLBACK` env var, or hardcoded public RPC for the cluster).
3. If both fail, return 503 with `{error: {code: 'RPC_UNAVAILABLE', message: 'On-chain verification temporarily unavailable, please retry shortly'}}`.
4. Emit `guardianBus` event so SENTINEL/operators see the failure.
5. Add per-link rate limit: 3 confirmation attempts per minute per link ID (prevents retry abuse).

This eliminates the money-at-risk fail-open while remaining tolerant of transient RPC outages.

### D8 — ESLint rule banning direct `process.env.SOLANA_NETWORK` reads

After migrating 13 files to `loadNetworkConfig()`, add a `no-restricted-syntax` rule to `eslint.config.js`:

```javascript
'no-restricted-syntax': ['error', {
  selector: 'MemberExpression[object.object.name="process"][object.property.name="env"][property.name=/^(SOLANA_NETWORK|SOLANA_RPC_URL)$/]',
  message: 'Use loadNetworkConfig() instead of reading process.env.SOLANA_NETWORK / SOLANA_RPC_URL directly. See packages/agent/src/config/network.ts.'
}]
```

Exempt path: `packages/agent/src/config/network.ts` (where the env vars are read once at module load).

CI fails on new violations; existing migrated files pass.

### D9 — SENTINEL default mode: `advisory` (fail-safe)

`packages/agent/src/sentinel/config.ts:114-117` currently defaults to `'yolo'` if `SENTINEL_MODE` is unset. Flip default to `'advisory'`. Operators must explicitly set `SENTINEL_MODE=yolo` to enable autonomy. Add a startup log line `console.warn` if `yolo` mode is active.

This prevents an env-var drop from accidentally enabling autonomous fund-moving operations. Pre-launch the VPS env is correct, but post-deploy hygiene errors are the leading cause of incidents.

### D10 — Centralized ephemeral state module (backend)

`packages/agent/src/state/ephemeral.ts` — new module wrapping six security-critical maps (`pendingNonces`, `verifyAttempts`, `sseTickets`, `adminTokens`, `pendingConfirmations`, `circuitBreakerFlags`):

```typescript
interface EphemeralStore<T> {
  set(key: string, value: T, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  size(): Promise<number>;
}

function createStore<T>(name: string, opts: { maxSize?: number }): EphemeralStore<T>
```

Backed by Redis when `REDIS_URL` is set (production VPS path), falls back to in-memory `Map` otherwise (test mode).

Migration: each of the 6 sites switches to `createStore<T>('name', {...}).get/set/delete`. `setInterval` cleanup loops are removed (Redis TTL handles expiry; in-memory fallback adds a single sweep loop).

Side benefit: Phase 5+ horizontal scaling (multi-replica agent deployment) becomes a config change, not a code change.

### D11 — Solscan link wiring: deferred

FE P-3 (`solscanUrl` helper exists but never imported) is a real launch-relevant gap, but addressing it requires touching `ActivityEntry`, `VaultView` activity rows, and chat tool result rendering. Out of scope for this fix; will land in PR-A4 alongside any UI revamp work flowing from the design brainstorm.

Devnet beta announcement does not depend on Solscan links to function. Users can paste TX signatures into Solscan manually if needed.

---

## Architecture

### Frontend `AuthSync` provider

```
                    ┌────────────────────────────────────────┐
                    │         <AuthSyncProvider>             │
                    │                                         │
  WalletProvider    │   useEffect: subscribe to              │
   (wallet-adapter) │     wallet.connect / disconnect /      │
        │           │     accountChange events                │
        │           │                                         │
        ↓           │   useEffect: schedule expiry watcher    │
   useWallet()──────→     setTimeout(refreshOrClear,          │
                    │       expiresAt * 1000 - Date.now()     │
                    │       - 60_000)                         │
                    │                                         │
                    │   apiFetch interceptor:                 │
                    │     if res.status === 401:              │
                    │       clearAuth()                       │
                    │       toast.show('Session expired...')  │
                    │                                         │
                    │   exposes: useAuthState() →             │
                    │     { status, token, expiresAt,         │
                    │       isAdmin, publicKey,               │
                    │       authenticate, disconnect, error } │
                    └─────────────────┬──────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ↓                         ↓                         ↓
       Header.tsx              ChatSidebar.tsx          DashboardView.tsx
   (pill + dropdown)        (chat input + 401 toast)    (stream subscribe)
```

Files touched:
- **NEW**: `app/src/providers/AuthSyncProvider.tsx` — the provider
- **NEW**: `app/src/hooks/useAuthState.ts` — consumer hook
- **NEW**: `app/src/components/Toast.tsx` — toast slot if not exists
- **NEW**: `app/src/components/WalletDropdown.tsx` — header dropdown
- **MODIFIED**: `app/src/App.tsx` — wrap with `<AuthSyncProvider>`
- **MODIFIED**: `app/src/api/client.ts` — apiFetch becomes 401-aware
- **MODIFIED**: `app/src/api/auth.ts` — store `expiresAt` from server response
- **MODIFIED**: `app/src/api/sse.ts` — drop JWT-in-URL fallback path (or gate behind DEV-only)
- **MODIFIED**: `app/src/stores/app.ts` — Zustand persist gets `version: 1` + `migrate`
- **MODIFIED**: `app/src/components/Header.tsx` — pill always clickable, shows dropdown
- **MODIFIED**: `app/src/components/BottomNav.tsx` — uses `useAuthState().disconnect()`
- **MODIFIED**: `app/src/components/ChatSidebar.tsx` — error path migrates to toast
- **MODIFIED**: `app/src/components/SentinelConfirm.tsx` — uses `useAuthState().token`
- **MODIFIED**: `app/src/views/DashboardView.tsx` — uses `useAuthState()`
- **MODIFIED**: `app/src/views/VaultView.tsx` — uses `useAuthState()`
- **MODIFIED**: `app/src/hooks/useAuth.ts` — gutted; logic moves into provider
- **MODIFIED**: `app/src/hooks/useSSE.ts` — uses `useAuthState().token`
- **REMOVED**: ad-hoc auth state in components

Test coverage (added):
- `app/src/providers/__tests__/AuthSyncProvider.test.tsx` — covers connect → SIWS happy path, SIWS fallback to signMessage, JWT decode, expiry watcher, 401 interceptor, disconnect cleanup, wallet-switch reconciliation, store hydration with stale token
- `app/src/components/__tests__/WalletDropdown.test.tsx` — open/close, Copy/Re-sign/Disconnect actions

### Backend ephemeral state module

```
┌────────────────────────────────────────────┐
│  packages/agent/src/state/ephemeral.ts     │
│                                            │
│  createStore<T>(name, { maxSize? }):       │
│    EphemeralStore<T>                       │
│                                            │
│  Backed by:                                │
│    - Redis (REDIS_URL set) — TTL native    │
│    - In-memory Map (fallback) — sweep loop │
└──────────────────┬─────────────────────────┘
                   │
       ┌───────────┼─────────────┬───────────────┬──────────────┐
       ↓           ↓             ↓               ↓              ↓
  pendingNonces  sseTickets   verifyAttempts  pendingConfirms  flagsCircuit
   (auth.ts)    (auth.ts)      (auth.ts)      (confirm.ts)    (breaker.ts)
```

Plus auxiliary state previously living as module-scope `let`:
- Admin token tracking (`admin.ts`)
- Whatever else surfaces during migration

Files touched:
- **NEW**: `packages/agent/src/state/ephemeral.ts` — store factory
- **NEW**: `packages/agent/src/state/__tests__/ephemeral.test.ts` — TTL, cap, fallback behavior
- **MODIFIED**: `packages/agent/src/routes/auth.ts` — migrate 3 maps
- **MODIFIED**: `packages/agent/src/routes/admin.ts` — migrate adminTokens
- **MODIFIED**: `packages/agent/src/routes/confirm.ts` — migrate pendingConfirms
- **MODIFIED**: `packages/agent/src/routes/circuit-breaker.ts` (or wherever flags live) — migrate

### Backend new endpoint: `POST /api/auth/refresh`

```typescript
// packages/agent/src/routes/auth.ts
router.post('/refresh', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing token' } });
  }
  const token = auth.slice(7);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token invalid or expired' } });
  }

  const now = Math.floor(Date.now() / 1000);
  const fiveMin = 5 * 60;
  if (payload.exp - now > fiveMin) {
    return res.status(425).json({ error: { code: 'TOO_EARLY', message: 'Refresh allowed within 5min of expiry' } });
  }

  // Issue new JWT with same wallet/isAdmin claims
  const newToken = jwt.sign(
    { wallet: payload.wallet, isAdmin: payload.isAdmin },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY ?? '24h' }
  );
  res.json({ token: newToken, expiresIn: process.env.JWT_EXPIRY ?? '24h' });
});
```

Frontend AuthSync provider polls this when within the refresh window. Server-driven TTL means future TTL changes don't require frontend deploy.

---

## Scope

### In Scope (PR 1 — Frontend AuthSync)
- AuthSync provider implementation
- All FE H-1 through H-6 fixes (architectural)
- FE R-1, R-2, R-4, R-6 (refactors enabled by AuthSync)
- FE P-1, P-2 (loading + error toast surfacing)
- FE P-4 (default network fallback to safer value)
- FE X-1 + X-2 (single source of truth + standardized auth header)
- Test coverage for AuthSync flows
- Migration of all auth-touching components

### In Scope (PR 2 — Backend Auth Surface Hardening)
- BE H-1 (trust proxy)
- BE H-2 (input validation on /api/auth/nonce)
- BE H-3 (rate limit /api/auth/nonce)
- BE H-4 (pay fail-closed with fallback RPC)
- BE H-5 (13-file SOLANA_NETWORK migration)
- BE H-6 (SIPHER_NETWORK in docker-compose.yml)
- BE H-7 (per-link rate limit on /pay/:id/confirm)
- BE R-3 (JWT_EXPIRY env-configurable + /api/auth/refresh endpoint)
- BE R-4 (parse AUTHORIZED_WALLETS once at module load)
- BE R-7 (deduplicate FUND_MOVING_TOOLS)
- BE R-8 (SENTINEL_MODE default to advisory)
- BE X-1 (centralized ephemeral state module)
- BE X-2 (ESLint rule banning direct SOLANA_NETWORK reads)
- BE X-3 (Express request augmentation for typed `req.wallet`)

### In Scope (PR 3 — Optional Polish)
- BE R-1 (error envelope unification across auth/herald/pay/vault/chat)
- BE P-2 (structured logging migration via pino)
- BE P-1 (drop `as any` in admin.ts)

### Out of Scope (Deferred)
- FE P-3 (Solscan link wiring) — needs UI revamp coordination
- FE P-5 (UUID polyfill for Safari < 15.4) — ship-as-is, edge browser
- FE P-6 (avatar letter UX) — UI revamp item
- FE R-3 (sse.ts JWT-in-URL fallback) — gated behind DEV-only check; full removal post-mainnet
- FE R-5 (BetaBanner persistence policy) — separate UX discussion
- BE R-2 (Redis migration of all ephemeral state) — partial: structure ready in PR 2 via ephemeral.ts module; full Redis backing optional based on whether REDIS_URL is configured. Test mode keeps in-memory.
- BE R-5 (constant-time nonce miss) — theoretical concern, low priority; track separately
- BE R-6 (per-token SENTINEL dust threshold) — design discussion needed; vault is SOL-first today
- BE P-3 (cookie parser) — confined to legacy admin route
- BE P-4 (pay alert metric) — captured by guardianBus event in D7
- BE P-5 (confirm.ts 403 vs 404) — file as separate trivial PR
- BE P-6 (humanizeAction address slice) — cosmetic
- BE X-4 (fail-open audit doc) — meta concern, file as ADR after PR 2 lands

### Hard Out of Scope
- Mainnet deployment (Phase 4b)
- UI revamp (separate brainstorm-then-aidesigner track)
- M19 claim linkability (separate engineering track)
- Mobile app changes (sip-mobile repo)

---

## Acceptance Criteria

### PR 1 — Frontend AuthSync acceptance
- [ ] `AuthSyncProvider` implemented at `app/src/providers/AuthSyncProvider.tsx`
- [ ] `useAuthState()` hook exposes the documented API surface (status, token, expiresAt, isAdmin, publicKey, authenticate, disconnect, error)
- [ ] All 8 modified components consume `useAuthState()` (no direct `useWallet()` + `useAppStore` mixing for auth)
- [ ] Connect with Phantom: SIWS path completes in one popup, JWT issued, chat unlocks
- [ ] Connect with Jupiter (or any wallet without SIWS): falls back to `signMessage`, shows wallet's sign popup, JWT issued, chat unlocks
- [ ] JWT expiry: tab open >24h triggers automatic re-auth flow (toast + button); user signs once and continues
- [ ] JWT refresh: tab open ~24h calls `/api/auth/refresh` automatically within 5min window
- [ ] Page reload with persisted wallet: AuthSync verifies JWT validity, clears if expired, prompts re-auth without leaving stuck UI
- [ ] Wallet switch: clears prior wallet's JWT, prompts new auth automatically
- [ ] Desktop wallet pill: click opens dropdown with Copy/Re-sign/Disconnect; all three work
- [ ] Disconnect (desktop or mobile): clears wallet-adapter state AND Zustand JWT AND modal visibility
- [ ] 401 from any backend endpoint: triggers toast + clearAuth(); no raw error string in chat
- [ ] All affected component tests pass; new AuthSyncProvider tests cover the 9 documented scenarios
- [ ] `pnpm test` passes; `pnpm typecheck` passes; `pnpm lint` passes
- [ ] Manual smoke: full happy path (connect → chat → disconnect → reconnect) on Phantom + at least one non-SIWS wallet

### PR 2 — Backend Auth Surface acceptance
- [ ] `app.set('trust proxy', N)` configured on agent app; `req.ip` resolves to client X-Forwarded-For value behind nginx
- [ ] `/api/auth/nonce` rejects wallet strings >64 chars OR not matching base58 regex with 400 + structured error
- [ ] `/api/auth/nonce` per-IP rate limit: 5 requests/min returns 429 with structured error
- [ ] `/api/auth/refresh` endpoint live; returns 425 if >5min from expiry, 401 if invalid, 200 with new JWT if within window
- [ ] `JWT_EXPIRY` env-configurable; default `'24h'` for production, kept `'1h'` in test setup
- [ ] All 13 files migrated from `process.env.SOLANA_NETWORK` to `loadNetworkConfig().clusterName`
- [ ] All 3 files migrated from `process.env.SOLANA_RPC_URL` to `loadNetworkConfig().rpcUrl`
- [ ] ESLint rule active; CI fails on direct `process.env.SOLANA_NETWORK` reads outside `config/network.ts`
- [ ] `docker-compose.yml` declares `SIPHER_NETWORK=${SIPHER_NETWORK:-devnet}` in `api:` service env block
- [ ] `/pay/:id/confirm` fail-closed: RPC primary fails → fallback RPC tried → both fail → 503 with `{error:{code:'RPC_UNAVAILABLE',...}}`. `guardianBus` event emitted on either failure.
- [ ] `/pay/:id/confirm` per-link rate limit: 3 confirmations/min/link
- [ ] `SENTINEL_MODE` default flipped to `'advisory'`; startup log warns if `'yolo'`
- [ ] `AUTHORIZED_WALLETS` parsed once at module load into `Set<string>`; startup log line shows count
- [ ] `FUND_MOVING_TOOLS` deduplicated: imported from `preflight-rules.ts` into `index.ts`
- [ ] Ephemeral state module at `packages/agent/src/state/ephemeral.ts`; 6 sites migrated
- [ ] Express request augmentation: `declare module 'express-serve-static-core'` adds `wallet?: string; isAdmin?: boolean` to `Request`; all `as unknown as Record<...>` casts removed in protected routes
- [ ] All affected route tests pass; new ephemeral.ts tests cover TTL + cap + fallback
- [ ] `pnpm test` passes; `pnpm typecheck` passes; `pnpm lint` passes (with new ESLint rule active)

### Cross-cutting verification (after PR 1 + PR 2 merge)
- [ ] Re-run `/quality:qa` Phase 1 (dev-QA): zero P0 findings on auth/security surfaces
- [ ] Re-run manual auth flow QA: all 5 originally-found bugs resolved + the 8 new dev-QA blockers
- [ ] Optional: run `/quality:qa` Phase 2 (end-user QA, 4 archetypes) for regression-free walk
- [ ] VPS deploy with PR 1 + PR 2 merged: container boots cleanly, /api/config returns devnet, BetaBanner renders, full happy path works on Phantom

### Optional PR 3 acceptance
- [ ] Error envelope `{error: {code, message}}` consistent across `/api/auth/*`, `/api/herald`, `/pay/*`, `/api/vault`, `/api/chat/*`
- [ ] Frontend error parser updated for unified shape
- [ ] `console.warn` migrated to structured logger in vault-api.ts and pay.ts
- [ ] No `as any` casts in `routes/admin.ts`

---

## PR Sequencing & Dependencies

```
                  ┌──────────────────────────┐
                  │  Spec + Plan committed   │
                  └────────────┬─────────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                                  │
              ↓                                  ↓
     ┌─────────────────┐               ┌────────────────────┐
     │   PR 1 (FE)     │               │   PR 2 (BE)        │
     │  AuthSync       │               │   Auth surface     │
     │  ~10-12h        │               │   hardening        │
     │                 │               │   ~12-16h          │
     └────────┬────────┘               └──────────┬─────────┘
              │                                   │
              │   (Independent: no merge order)   │
              │                                   │
              └─────────┬─────────────────────────┘
                        ↓
              ┌──────────────────────────┐
              │  Both merged → smoke QA  │
              │  Re-run /quality:qa P1   │
              │  Manual auth walkthrough │
              └────────────┬─────────────┘
                           │
                           ↓
                ┌──────────────────────┐
                │  Optional PR 3       │
                │  (polish, error      │
                │   envelope, logging) │
                └──────────┬───────────┘
                           │
                           ↓
                ┌──────────────────────┐
                │  Phase 4a launch     │
                │  • Steave DM         │
                │  • X thread #1       │
                │  • Day 0+ soak       │
                └──────────────────────┘
```

PR 1 and PR 2 can be reviewed in parallel and merged in either order. The integration smoke test happens after both merge. PR 3 is genuinely optional; X thread #1 launch should NOT block on PR 3.

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | AuthSyncProvider rewrite has hidden bug not caught by tests | Medium | High | Comprehensive test pass + manual smoke on 3 wallet types (Phantom + Jupiter + Solflare) before merge |
| R2 | SIWS fallback to signMessage interacts badly with specific wallet (e.g. Backpack edge case) | Low | Medium | Explicit test matrix: Phantom (SIWS), Jupiter (no SIWS), Solflare (SIWS), Backpack (varies). Document tested-against list in PR description. |
| R3 | Ephemeral state module migration breaks existing rate limit semantics | Medium | Medium | Dual-write during transition: keep old map active, write to both, verify match in tests, then cut over. |
| R4 | ESLint rule false-positives in test files or scripts | Low | Low | Configure rule to exempt `**/*.test.ts`, `**/*.spec.ts`, `scripts/`, `e2e/` paths. |
| R5 | `app.set('trust proxy')` set incorrectly for nginx config → IPs all wrong | Medium | Medium | Test against staging with curl + X-Forwarded-For; document `TRUST_PROXY` env var with comment in compose. |
| R6 | `/api/auth/refresh` allows replay if implementation buggy | Low | High | Verify refresh requires CURRENT token to be valid (not just signature-valid but unrevoked); test the 5-minute window edge cases. |
| R7 | Pay fail-closed breaks legitimate confirmations during normal RPC hiccups | Low | Medium | Fallback RPC absorbs single-RPC blips. Test: simulate primary RPC timeout, verify fallback succeeds. |
| R8 | SENTINEL_MODE default flip breaks production if VPS env wasn't explicit | Low | High | Verify `~/Documents/secret/sipher-vps-secrets.env` has `SENTINEL_MODE=advisory` explicitly set BEFORE merging; check VPS `~/sipher/.env` content; deploy off-hours. |
| R9 | docker-compose.yml change leaks SIPHER_NETWORK as required env, blocking local dev | Low | Low | `${SIPHER_NETWORK:-devnet}` syntax provides default. Local dev gets `devnet` automatically. |
| R10 | Ephemeral state with Redis backing fails over poorly when REDIS_URL is set but Redis is unreachable | Medium | Medium | Implement startup health check; if Redis configured but unreachable, fail loudly at boot rather than degrading silently. |
| R11 | PR scope creeps as subagent encounters more findings during implementation | High | Medium | Plan-doc enforces task list; subagent must surface scope-creep candidates as separate findings, not silently expand. RECTOR review checkpoints catch creep. |
| R12 | Phase 4a launch sequence pushes out → mobile app launch / Superteam deadline pressure | Low | Medium | Soak period (3 days) is the rate-limiting step anyway; fix takes ~3 days; total wall time ~6 days vs. ~5 if hotfixed. Modest slip. |

---

## Out-of-band Considerations

### VPS deployment ordering

PR 1 (FE) ships fine to VPS even before PR 2 — backend stays on current contract, frontend gracefully handles missing `/api/auth/refresh` (treats 404 as "no refresh available, force re-sign at expiry").

PR 2 (BE) ships fine before PR 1 — old frontend continues to work; new endpoints are additive.

The only ordering risk is **error envelope unification (PR 3)**: changing error shape on `/api/auth/*` would break old frontends parsing the legacy shape. Mitigation: PR 3's error-envelope migration is gated on PR 1 having shipped (since PR 1 frontend handles both shapes, parsing the unified shape if present).

### Mainnet authority key handling unchanged

This fix is entirely on the agent app + frontend. No changes to authority keypair handling, no changes to vault program, no changes to sip_privacy program. Phase 4b (mainnet deploy) inherits the fixed agent app cleanly.

### Telemetry / observability gap acknowledged

This spec does NOT add proper observability (Datadog/Grafana hooks) for the auth flow. If a tester hits a flow that fails silently in production, we still rely on: (a) GitHub issue from the tester, (b) `docker logs sipher`. Adequate for devnet beta; mainnet may want a follow-up observability PR.

### Test coverage targets

PR 1: aim for ≥85% line coverage on `AuthSyncProvider` and `WalletDropdown`. Existing component tests must continue to pass.

PR 2: aim for ≥80% line coverage on the new ephemeral state module and `/api/auth/refresh` endpoint. Existing route tests must continue to pass.

---

## Cross-references

- **Phase 4 split spec:** `docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md` — locked decisions D1-D9 for devnet-beta-then-mainnet
- **Phase 4 split plan:** `docs/superpowers/plans/2026-05-05-phase4-split-devnet-beta-mainnet.md` — task A4 (launch event) inherits this fix as prerequisite
- **Predecessor handoffs:**
  - `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-06-c.md` (PR-A1/A2/A3 shipped)
  - `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-06-b.md` (PR-A2 + VPS recovery)
- **QA evidence:**
  - Phase 1 dev-QA frontend findings (this session, agentId `a929a3ac92528269c`)
  - Phase 1 dev-QA backend findings (this session, agentId `a951aecc9fa33ca6d`)
- **SENTINEL formalization:** `docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md` — SENTINEL_MODE flag origin + design context
- **Phase 4a A4 launch tasks** (deferred until this fix lands):
  - Steave Superteam DM
  - X thread #1 publish
  - `SIPHER_BETA_LAUNCH_AT` already saved on VPS at `2026-05-06T04:26:47Z`
  - Day 3+ gate-check via `scripts/devnet-beta-gate-check.ts`

---

## Open Questions for RECTOR Review

Before plan-doc work begins, please confirm or override:

1. **PR 1 + PR 2 in parallel review, or strictly sequential?** Spec assumes parallel. If you prefer one-at-a-time review for safety, plan-doc will sequence them.
2. **PR 3 (error envelope, logging, polish) — green-light to skip until after launch?** Spec marks it optional. Confirm.
3. **`SENTINEL_MODE` default flip from `'yolo'` → `'advisory'` — verify the VPS `.env` already explicitly sets `SENTINEL_MODE=advisory`** so we don't accidentally degrade production. (CIPHER will check before PR 2 lands, but flag if you have any out-of-band notes.)
4. **JWT TTL extension to 24h** — comfortable, or prefer 12h / 4h / different?
5. **`/api/auth/refresh` 5-min window before expiry** — too tight? Some apps use 25% of TTL (so 6h on a 24h TTL). 5min keeps refresh narrow + safe; 6h gives more flex. Pick one.
6. **Wallet pill dropdown library** — roll plain Tailwind/Phosphor, or add `@radix-ui/react-popover` (~10KB) for accessibility wins (focus trap, esc-to-close, role="menu")?
7. **ESLint rule violations during migration** — if any of the 13 files turn out to have legitimate-but-rare reasons to read `process.env.SOLANA_NETWORK` directly (e.g. a one-off script), do we use `// eslint-disable-next-line` or refactor?

---

*Bismillah — proper-fix done right, once. May this spec serve clarity and discipline. InshaAllah.*
