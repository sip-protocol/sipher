# Design — Backend Broadcast Proxy (`POST /api/tx/broadcast`)

**Issue:** [sipher#297](https://github.com/sip-protocol/sipher/issues/297)
**Date:** 2026-05-23
**Session:** `[frontier_sip_18]`
**Status:** Draft — pending RECTOR review
**Predecessor:** [PR #296](https://github.com/sip-protocol/sipher/pull/296) (sipher#291 — FE-side resubmit loop, merged 2026-05-23)

---

## 1. Context

PR #296 shipped a FE-side resubmit loop (`app/src/lib/sendWithRetry.ts`) to address sipher#291's "block height exceeded" failures. Post-deploy verification in frontier_sip_17 revealed a deeper architectural issue: the FE broadcasts via the **public devnet RPC** (`https://api.devnet.solana.com`, surfaced through `/api/config.publicRpcUrl`), which **drops broadcasts silently** under rate-limit pressure.

Two real signatures from frontier_sip_17 verification (`3Cj3Nr…hTn6`, `3SdEhA…hTn6`) returned `getTransaction → null` seconds after Phantom signing succeeded. The FE's resubmit loop is necessary but not sufficient: even aggressive resubmits to the same dropping RPC don't reach validators.

The backend already has a Helius-keyed `Connection` (via `loadNetworkConfig().rpcUrl`, used in `tool-signing.ts` for signature verification). That connection is reliable.

**Goal:** Move the broadcast hop from the FE's public-RPC `Connection` to a backend endpoint that uses the Helius-keyed `Connection`, so chat-driven sends actually reach the cluster.

**Frontier deadline:** judges score 2026-05-27 (4 days from this spec).

## 2. Architectural choice

Three options were considered (from [issue #297](https://github.com/sip-protocol/sipher/issues/297)):

| Option | Description | Verdict |
|---|---|---|
| **A** | Backend `POST /api/tx/broadcast` endpoint; FE still signs locally | **Chosen** — smallest surface, mirrors existing fund-moving routes |
| B | Backend RPC proxy at `/rpc`; FE Connection talks to backend for everything | Rejected — large JSON-RPC surface needs filtering + rate-limiting |
| C | Swap `publicRpcUrl` to a different free public RPC | Rejected — moves the rate-limit, doesn't solve the architecture |

### 2.1 Locked decisions (from brainstorming, 2026-05-23)

1. **Option A** — single new endpoint, minimum surface.
2. **Backend owns broadcast + confirm + resubmit.** Sync long-running POST. FE awaits a single `{ signature }` response. No SSE/streaming (avoids QUIC drop class from sipher#292).
3. **SENTINEL coupling: separate.** `/api/tx/broadcast` returns `{ signature }`; FE still POSTs to `/api/tool-signing/:flagId/confirm` afterward, same as today. Broadcast endpoint is reusable for non-SENTINEL flows.
4. **JWT auth required.** Mirrors existing fund-moving endpoints (`vault-deposit-tx`, `vault-refund-tx`, `tool-signing`). Per-wallet attribution + DOS resistance.

## 3. Mental model

The endpoint is a **mail relay**. Today the FE drops envelopes (signed txs) into a community mailbox (public devnet RPC) that loses many of them silently. The new endpoint replaces that mailbox with a staffed counter (backend's Helius-keyed `Connection`): the FE still writes and seals the envelope itself (Phantom signing locally), but hands it off to the counter, which guarantees pickup and tracks delivery.

```
TODAY (broken):
  FE → signs → connection.sendRawTransaction(api.devnet.solana.com) ❌ silent drop
            → connection.confirmTransaction(api.devnet.solana.com)  ❌ "block height exceeded"

NEW:
  FE → signs → POST /api/tx/broadcast { signedTx, blockhash, lastValidBlockHeight }
                                 ↓
  Backend → connection.sendRawTransaction(Helius) ✅ lands
         → resubmit loop @ 2s until confirmed
         → connection.confirmTransaction(Helius) ✅
         ← returns { signature }
            ↓
  FE → POST /api/tool-signing/:flagId/confirm { signature }   (unchanged)
```

Read-only operations (`getLatestBlockhash`, `getBalance`, `getAccountInfo`) stay on public RPC via the existing `ConnectionProvider` — those reads were never the bug.

## 4. Endpoint contract

### 4.1 Route

```
POST /api/tx/broadcast
```

Mounted in `packages/agent/src/index.ts` at `/api/tx`. Behind the same JWT middleware as `/api/agent/v1/vault/*` and `/api/tool-signing/*`.

### 4.2 Request body

```ts
{
  serializedTx: string         // base64-encoded signed transaction bytes
  blockhash: string            // recent blockhash used when signing
  lastValidBlockHeight: number // expiry height for confirmation
}
```

Validation:
- `serializedTx`: non-empty string, valid base64, deserializable as `Transaction` or `VersionedTransaction`. Deserialization is for validation only — the original bytes are what we broadcast.
- `blockhash`: non-empty string.
- `lastValidBlockHeight`: finite positive number.

### 4.3 Response

**Success (200):**
```ts
{ signature: string }
```

The signature is returned only after the cluster has confirmed the transaction at `'confirmed'` commitment.

**Error envelope** (matches existing sipher error shape across `vault-deposit-tx.ts`, `tool-signing.ts`, etc.):
```ts
{ error: { code: string, message: string } }
```

| HTTP | `code` | When |
|---|---|---|
| 401 | `UNAUTHENTICATED` | `req.wallet` not attached by JWT middleware |
| 400 | `VALIDATION_FAILED` | Body shape invalid, malformed base64, or undeserializable bytes |
| 400 | `BLOCKHASH_EXPIRED` | Current `getBlockHeight()` already exceeds `lastValidBlockHeight` at receive time (no point trying) |
| 502 | `BROADCAST_FAILED` | First `sendRawTransaction` call throws a non-recoverable RPC error (e.g., invalid tx) |
| 504 | `CONFIRMATION_TIMEOUT` | Resubmit loop ran out the blockhash without confirmation (tx truly dropped or never confirmed) |
| 500 | `INTERNAL` | Anything else. Response message must never leak stack traces or env-key fragments. |

**Why 504 over 502 for timeout:** distinguishes "we tried, RPC didn't see it" from "RPC rejected outright." Lets the FE class retries differently — `CONFIRMATION_TIMEOUT` is "retry-with-fresh-blockhash" territory, `BROADCAST_FAILED` is "show the user, don't retry."

### 4.4 Timing

Solana blockhash validity is ~60-90 seconds. The backend's confirmation polling has an upper bound of `lastValidBlockHeight`. Cloudflare's default request timeout is 100s, which sits above the expected blockhash window.

The endpoint does **not** stream progress — single sync POST, single sync response.

## 5. Backend implementation

### 5.1 New files

```
packages/agent/src/lib/sendWithRetry.ts
packages/agent/src/lib/__tests__/sendWithRetry.test.ts
packages/agent/src/routes/tx-broadcast.ts
packages/agent/src/routes/__tests__/tx-broadcast-routes.test.ts
```

### 5.2 `packages/agent/src/lib/sendWithRetry.ts`

Direct port of `app/src/lib/sendWithRetry.ts`. Identical logic:

```ts
import type { Connection } from '@solana/web3.js'

const RESUBMIT_INTERVAL_MS = 2000

export interface SendAndConfirmDeps {
  resubmitIntervalMs?: number
  sleep?: (ms: number) => Promise<void>
}

export async function sendAndConfirmWithRetry(
  connection: Connection,
  signedTx: Uint8Array,
  blockhash: string,
  lastValidBlockHeight: number,
  deps: SendAndConfirmDeps = {},
): Promise<string> {
  const interval = deps.resubmitIntervalMs ?? RESUBMIT_INTERVAL_MS
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)))

  const submitOnce = () =>
    connection.sendRawTransaction(signedTx, { skipPreflight: true, maxRetries: 0 })

  const signature = await submitOnce()

  let stopped = false
  const resubmit = async () => {
    while (!stopped) {
      await sleep(interval)
      if (stopped) return
      submitOnce().catch(() => {})
    }
  }
  const resubmitPromise = resubmit()

  try {
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed',
    )
    return signature
  } finally {
    stopped = true
    await resubmitPromise.catch(() => {})
  }
}
```

The dependency-injection shape (`resubmitIntervalMs`, `sleep`) is preserved so tests stay deterministic without faking timers globally.

**Why a port and not a shared `@sipher/sdk` export?** The two helpers run in different environments (browser vs Node), and adding to SDK expands PR scope. The FE copy is deleted in this PR (FE no longer broadcasts), so we're not maintaining two implementations going forward. Promoting to SDK is a follow-up (see §10).

### 5.3 `packages/agent/src/routes/tx-broadcast.ts`

Style mirrors `vault-deposit-tx.ts`:

```ts
import { Router, type Request, type Response } from 'express'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { createConnection } from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'
import { sendAndConfirmWithRetry } from '../lib/sendWithRetry.js'

export const txBroadcastRouter = Router()

txBroadcastRouter.post('/broadcast', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authenticated wallet required' },
    })
    return
  }

  const { serializedTx, blockhash, lastValidBlockHeight } = req.body as {
    serializedTx?: unknown
    blockhash?: unknown
    lastValidBlockHeight?: unknown
  }

  // Shape validation
  if (typeof serializedTx !== 'string' || serializedTx.length === 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'serializedTx must be a non-empty base64 string' },
    })
    return
  }
  if (typeof blockhash !== 'string' || blockhash.length === 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'blockhash must be a non-empty string' },
    })
    return
  }
  if (typeof lastValidBlockHeight !== 'number' || !Number.isFinite(lastValidBlockHeight) || lastValidBlockHeight <= 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'lastValidBlockHeight must be a positive number' },
    })
    return
  }

  // Decode + validate deserializable (one-way: we broadcast the original bytes)
  let signedBytes: Uint8Array
  try {
    signedBytes = base64ToBytes(serializedTx)
    try {
      Transaction.from(signedBytes)
    } catch {
      VersionedTransaction.deserialize(signedBytes) // throws if neither shape
    }
  } catch {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'serializedTx is not a valid signed Solana transaction' },
    })
    return
  }

  // Build Helius-backed connection
  const net = loadNetworkConfig()
  const connection = createConnection(net.clusterName, net.rpcUrl)

  // Optional pre-flight: if blockhash already expired, fail fast
  try {
    const currentHeight = await connection.getBlockHeight('confirmed')
    if (currentHeight > lastValidBlockHeight) {
      res.status(400).json({
        error: { code: 'BLOCKHASH_EXPIRED', message: 'lastValidBlockHeight already in the past — re-sign with a fresh blockhash' },
      })
      return
    }
  } catch {
    // getBlockHeight failure isn't fatal — let the actual broadcast surface the real error
  }

  // Broadcast + confirm
  try {
    const signature = await sendAndConfirmWithRetry(
      connection,
      signedBytes,
      blockhash,
      lastValidBlockHeight,
    )
    res.status(200).json({ signature })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    // BlockheightExceeded surfaces as a specific class in solana-web3.js
    if (isBlockheightExceeded(err)) {
      res.status(504).json({
        error: { code: 'CONFIRMATION_TIMEOUT', message: 'Transaction expired before confirmation. Retry with a fresh blockhash.' },
      })
      return
    }
    // First-send rejection (invalid tx, etc.)
    if (isSendError(err)) {
      res.status(502).json({
        error: { code: 'BROADCAST_FAILED', message: `RPC rejected transaction: ${redact(message)}` },
      })
      return
    }
    res.status(500).json({
      error: { code: 'INTERNAL', message: redact(message) },
    })
  }
})
```

Notes on the error classifiers:
- `isBlockheightExceeded(err)` — checks for `err.name === 'TransactionExpiredBlockheightExceededError'` (the solana-web3.js class thrown by `confirmTransaction` when the blockhash expires). Falls back to message-substring check for resilience.
- `isSendError(err)` — distinguishes "the very first `sendRawTransaction` rejected" from "we resubmitted indefinitely and expired." Implementation: caught error during initial send vs. during confirm. Cleanest with a small wrapper that tags errors.
- `redact(message)` — strips any substring matching the Helius API key pattern. The connection URL contains the key; if web3.js ever surfaces it in an error message, we must not echo it to the client.

### 5.4 Mount in `packages/agent/src/index.ts`

```ts
import { txBroadcastRouter } from './routes/tx-broadcast.js'
// ...
app.use('/api/tx', verifyJwt, txBroadcastRouter)
```

Sits adjacent to existing fund-moving routers. Exact middleware chain pattern matches `vault-deposit-tx.ts` registration.

## 6. Frontend implementation

### 6.1 New file: `app/src/lib/broadcast.ts`

Thin wrapper around `apiFetch` for consistent JWT + error envelope handling:

```ts
import { apiFetch } from '../api/client'

export interface BroadcastInput {
  serializedTx: string         // base64
  blockhash: string
  lastValidBlockHeight: number
}

export interface BroadcastResult {
  signature: string
}

export class BroadcastError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'BroadcastError'
  }
}

export async function broadcastViaBackend(input: BroadcastInput): Promise<BroadcastResult> {
  const res = await apiFetch('/api/tx/broadcast', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const code = body?.error?.code ?? 'UNKNOWN'
    const message = formatBroadcastMessage(code, body?.error?.message)
    throw new BroadcastError(code, message)
  }

  const body = await res.json()
  return { signature: body.signature }
}

function formatBroadcastMessage(code: string, fallback?: string): string {
  switch (code) {
    case 'BLOCKHASH_EXPIRED':
    case 'CONFIRMATION_TIMEOUT':
      return 'Transaction expired before reaching the network. Please try again.'
    case 'BROADCAST_FAILED':
      return fallback ?? 'Network rejected the transaction.'
    case 'UNAUTHENTICATED':
      return 'Session expired. Please sign in again.'
    default:
      return fallback ?? 'Broadcast failed. Please try again.'
  }
}
```

### 6.2 Modify `app/src/hooks/useTransactionSigner.ts`

Replace the local `sendAndConfirmWithRetry` call with `broadcastViaBackend`:

```ts
// (status transitions stay the same: idle → signing → broadcasting → confirmed/error)

const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

if (tx instanceof Transaction) {
  tx.recentBlockhash = blockhash
  tx.feePayer = publicKey
} else {
  tx.message.recentBlockhash = blockhash
}

const signed = await signTransaction(tx)
const serializedTx = bytesToBase64(signed.serialize())

setStatus('broadcasting')
const { signature } = await broadcastViaBackend({
  serializedTx,
  blockhash,
  lastValidBlockHeight,
})
setStatus('confirmed')
return { signature }
```

Notes:
- `getLatestBlockhash` still uses the public-RPC `Connection` via `useConnection()`. This is a read; it has its own rate-limit risk but hasn't been the demo-blocker. Backend blockhash endpoint is a follow-up (§10).
- The `useCallback` dependency list shrinks (no longer depends on the `connection` object's send methods, though `connection` is still in deps for `getLatestBlockhash`).
- `bytesToBase64` is a small helper; existing `base64ToBytes` covers the inverse. Add to `app/src/lib/broadcast.ts` or inline as appropriate.

### 6.3 Deletions

- `app/src/lib/sendWithRetry.ts`
- `app/src/lib/__tests__/sendWithRetry.test.ts`

The helper had exactly one caller (`useTransactionSigner`); deletion is clean.

### 6.4 No-change surfaces

- `App.tsx` `ConnectionProvider` — still wired to `publicRpcUrl`
- `/api/config` response shape — `publicRpcUrl` still in the whitelist
- `SignTxCard` component — `signAndBroadcast` external shape unchanged
- `/api/tool-signing/:flagId/confirm` flow — FE calls it after `signAndBroadcast` returns

## 7. Testing

### 7.1 Backend

**`packages/agent/src/lib/__tests__/sendWithRetry.test.ts`** — port the 5 existing FE tests:

| Test | Assertion |
|---|---|
| happy path | first send confirms; signature returned |
| resubmits while pending | `sendRawTransaction` called multiple times before `confirmTransaction` resolves |
| swallows resubmit errors | rate-limit errors from resubmits don't propagate |
| first-send error propagates | initial send throw stops the loop, throws to caller |
| block-height-exceeded propagates | `confirmTransaction` throw stops the loop, throws to caller |

**`packages/agent/src/routes/__tests__/tx-broadcast-routes.test.ts`** — supertest against an express app with mocked `Connection`:

| Test | Assertion |
|---|---|
| no JWT | 401 `UNAUTHENTICATED` |
| missing serializedTx | 400 `VALIDATION_FAILED` |
| non-string blockhash | 400 `VALIDATION_FAILED` |
| non-number lastValidBlockHeight | 400 `VALIDATION_FAILED` |
| malformed base64 | 400 `VALIDATION_FAILED` |
| undeserializable bytes | 400 `VALIDATION_FAILED` |
| expired blockhash (pre-flight) | 400 `BLOCKHASH_EXPIRED` |
| happy path | 200 `{ signature: "..." }` |
| send throws non-recoverable | 502 `BROADCAST_FAILED` |
| confirm throws BlockheightExceeded | 504 `CONFIRMATION_TIMEOUT` |
| unknown error | 500 `INTERNAL`, no stack trace in body |
| error message redaction | response body never contains the Helius API key fragment |

### 7.2 Frontend

**`app/src/lib/__tests__/broadcast.test.ts`** (new):

| Test | Assertion |
|---|---|
| POSTs correct body shape | `apiFetch` called with `serializedTx`, `blockhash`, `lastValidBlockHeight` |
| 200 returns signature | `{ signature }` from response body |
| 4xx maps code to BroadcastError | typed error with `code` field |
| BLOCKHASH_EXPIRED → user-friendly message | "Transaction expired..." |
| CONFIRMATION_TIMEOUT → user-friendly message | "Transaction expired..." |
| Uses apiFetch (JWT flows) | `apiFetch` mock receives the request, not raw `fetch` |

**`app/src/hooks/__tests__/useTransactionSigner.test.tsx`** (update):
- Replace `connection.sendRawTransaction` / `sendAndConfirmWithRetry` mocks with `broadcastViaBackend` mock.
- Status transitions unchanged (`idle → signing → broadcasting → confirmed`).
- Error case: backend returns `BLOCKHASH_EXPIRED` → hook returns `{ error: "..." }`, status `error`.

**Delete** `app/src/lib/__tests__/sendWithRetry.test.ts`.

### 7.3 Baseline shifts

| Suite | Before | After (expected) | Delta |
|---|---|---|---|
| agent (`pnpm --filter @sipher/agent test -- --run`) | 1630 | ~1645 | +~15 |
| app (`pnpm --filter @sipher/app test -- --run`) | 577 | ~574 | −5 + ~2 |

### 7.4 Manual post-deploy verification

After Vercel + VPS deploys land:

1. Log in to `https://sipher.sip-protocol.org` with cipher-admin wallet (devnet network).
2. In chat: "send 0.001 SOL to therector.sol" (or any small amount to a known address).
3. Confirm SignTxCard renders, sign in Phantom.
4. Expect: status → broadcasting → confirmed within 30s. Signature in chat message.
5. Verify signature on `https://solscan.io/tx/<sig>?cluster=devnet`.
6. Confirm chat continues (SENTINEL pending-signing resolved).
7. **Closes PR #288 verification path** — Phase D claim auto-derive can finally be exercised end-to-end on prod.

## 8. Migration / rollout

1. **PR opens** — branch `fix/issue-297-backend-broadcast` from `main`.
2. **CI green** — typecheck, app tests, agent tests, e2e, playwright, gitleaks.
3. **Self-review + RECTOR review** — verify PR description matches the spec, sanity-check the redact helper, verify no AI attribution in commit log.
4. **Merge** — squash or merge per recent PR convention.
5. **Auto-deploys:**
   - Vercel FE (~3 min Vite build) — picks up new useTransactionSigner + broadcast helper.
   - VPS backend (~11 min Docker build + deploy via "Test, Build & Deploy" workflow) — picks up new route.
6. **Verify deploy** — `curl https://sipher-api.sip-protocol.org/api/health` shows OK, container revision changed.
7. **Post-deploy manual test** — §7.4 above.

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Helius API key leak in error message | Critical | `redact(message)` strips key pattern before any client-bound response. Test asserts no key fragment in body. |
| Cloudflare 100s timeout hit before confirmation | Medium | Blockhash validity is ~60-90s; backend confirmation finishes within that window. If demo network is congested, FE shows `CONFIRMATION_TIMEOUT` and prompts retry. |
| Backend Helius connection rate-limited too | Low | Helius is paid tier with much higher quotas than public RPC. Unlikely under demo load (single wallet, ~10 tx total). |
| Race: `tool-signing/:flagId/confirm` verify fails because tx not yet propagated | Low | `/api/tx/broadcast` only returns after `confirmTransaction` succeeds at `'confirmed'`. By that point, `getTransaction` from `/confirm` will see it. |
| FE deployed before backend → FE calls 404 endpoint | Medium | Vercel FE deploys faster (~3 min) than VPS (~11 min). Hold the merge until VPS workflow finishes, or accept a short window of broken broadcasts on prod (Frontier demo isn't until 2026-05-27 so a few minutes of staging breakage is acceptable). |
| User aborts before backend confirms | Low | Backend continues the resubmit loop until blockhash expiry, then 504s. User sees no signature on FE; tx may still land on-chain (idempotent). Acceptable for Frontier. |

## 10. Out of scope (follow-ups)

1. **Flip `/api/config.publicRpcUrl` to backend proxy** — issue #297's optional next step. Not doing in this PR.
2. **Backend blockhash endpoint** — `GET /api/tx/blockhash` if public RPC reads start failing. ~30 min follow-up.
3. **Promote `sendAndConfirmWithRetry` to `@sipher/sdk`** — right long-term home, expands PR scope.
4. **Per-wallet rate limiting on /api/tx/broadcast** — JWT-auth'd, no per-wallet quota. Post-Frontier hardening.
5. **Durable nonce migration** — architecturally-correct fix for "tx hangs on blockhash expiry forever." Big lift. Resubmit loop covers the deadline.
6. **SENTINEL pending-signing bundling** — explicitly decided against (§2.1, decision 3). Separate flows.
7. **sipher#292 (Cloudflare HTTP/3 toggle)** — RECTOR-driven 5-min dashboard task. Independent of this PR.
8. **`tool-signing.ts` verify dependency on broadcast** — `verifySignature` calls `getTransaction` against the same Helius connection. After this PR, the tx is already confirmed before the FE calls `/confirm`, so verify will succeed. No code change needed, but worth noting the timing improvement.

## 11. Effort estimate

| Phase | Estimate |
|---|---|
| Backend: helper port + tests | 30 min |
| Backend: route + tests | 60 min |
| FE: broadcast helper + tests | 30 min |
| FE: useTransactionSigner update + test update | 30 min |
| FE: delete sendWithRetry + test | 5 min |
| Self-review + spec/plan polish | 30 min |
| **Total** | **~3 hours** |

Single PR. Branch: `fix/issue-297-backend-broadcast`. Conventional prefix. GPG-signed commits. NO AI attribution.

## 12. References

- [Issue sipher#297](https://github.com/sip-protocol/sipher/issues/297) — the bug + proposal
- [Issue sipher#291](https://github.com/sip-protocol/sipher/issues/291) — the FE-side resubmit predecessor (closed via PR #296)
- [Issue sipher#292](https://github.com/sip-protocol/sipher/issues/292) — Cloudflare HTTP/3 drop (parallel Frontier blocker, RECTOR-driven)
- [Session handoff frontier_sip_17](../../../../Documents/secret/claude-strategy/sip-protocol/session-handoff-2026-05-23.md)
- [PR #296 (merged 2026-05-23)](https://github.com/sip-protocol/sipher/pull/296) — FE-side resubmit loop, commit `1552043`
- Existing patterns followed:
  - `packages/agent/src/routes/vault-deposit-tx.ts` — JWT + serialized tx response shape
  - `packages/agent/src/routes/tool-signing.ts` — Helius-backed `Connection`, error envelope
  - `packages/agent/src/config/network.ts` — `loadNetworkConfig()` + Helius URL construction
  - `app/src/lib/sendWithRetry.ts` — the helper being ported (will be deleted from FE in this PR)
