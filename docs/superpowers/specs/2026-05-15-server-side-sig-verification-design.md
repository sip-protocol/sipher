# Server-Side Signature Verification — Design

**Date:** 2026-05-15
**Session:** frontier_sip_13
**Status:** Proposed — awaiting RECTOR review
**Predecessor:**
  - PR #271 (sipher#262) shipped the signing callback — `POST /api/tool-signing/:flagId/confirm` blindly trusts the client-supplied signature string
  - [[project_torque-mcp-integration-shipped]] PR-E lesson 1 (review noted defense-in-depth gap)
  - Today's confirm route: `packages/agent/src/routes/tool-signing.ts:17-44`
**Scope:** Add server-side verification that the signature submitted to `/api/tool-signing/:flagId/confirm` corresponds to a real on-chain Solana transaction signed by `entry.wallet` with instructions matching what the server originally serialized. Verify BEFORE resolving the promise gate, which gates downstream Torque growth-hook emission.
**Out of scope:** Verifying claim transactions (currently emits without on-chain proof — see [[2026-05-15-claim-phase-2-design]]); Ethereum verification path; replacing RPC dependence with a Helius webhook subscription (potential future optimization).
**Estimated work-time:** 2-3 days, 1 PR.

---

## Why this build

**Today's trust boundary is wrong.** When the user clicks Sign, the wallet adapter signs the serialized transaction, broadcasts to the network, and returns the resulting signature to the frontend. The frontend posts that string to `/confirm`. The server takes the client at its word — calls `resolvePendingSigning(flagId, signature)`, the promise resolves, the tool returns success, the growth-hook fires a Torque `sipher_private_send_completed` event with the signature in `data.tx_signature`.

Failure modes that bypass today's guards:
1. **Compromised client.** A malicious browser extension or XSS replaces the signature with a syntactically-valid but bogus string. Server accepts, Torque event fires with garbage. Rebate distribution attribution polluted.
2. **Buggy client.** Frontend bug substitutes the wrong signature (e.g. from a previous tx, or a different user's tx in localStorage). Same outcome.
3. **Replay.** Same signature is submitted twice for different flagIds. Server has no idea.
4. **Wrong transaction.** Wallet substitutes a different transaction (e.g. malicious wallet returns the user's signature for a tx that pays the attacker, not the intended recipient). Server treats it as success.

Solana RPC can answer all four. The verification cost (one RPC call) is small relative to the value of trustworthy telemetry feeding Torque.

**What this fix delivers.** Three verification tiers, gated before `resolvePendingSigning` runs. If any tier fails, the confirm route returns 4xx and the pending entry is rejected, not resolved. Torque growth-hook never fires for unverified signatures.

---

## Architecture

### Three-tier verification

| Tier | Check | What it catches | RPC call |
|---|---|---|---|
| T1 (existence) | `getSignatureStatuses([sig])` → confirmed/finalized, no err | Fake signatures; signatures from failed txs | `getSignatureStatuses` |
| T2 (sender binding) | tx fee payer (accountKeys[0]) === entry.wallet | Signature from a different wallet's tx | `getTransaction` (decoded) |
| T3 (instruction match) | Decoded tx instructions structurally match `entry.serializedTx` | Wallet-substituted tx (signed wrong tx) | reuses T2's `getTransaction` |

T1 alone catches most malicious scenarios. T2 closes the wrong-wallet attack. T3 is the gold standard but requires careful structural comparison.

**Recommendation:** ship T1 + T2 in the initial PR. T3 in a follow-up after observing real-world false-positive rates.

### Flow

```
POST /api/tool-signing/:flagId/confirm
   │
   ├─ existing checks (entry exists, wallet matches, signature non-empty)
   │
   ▼
verifySignature(signature, entry)
   │
   ├─ T1: getSignatureStatuses
   │     ├─ not-found / err / not-confirmed → return { ok: false, reason: 'not_confirmed' }
   │     └─ confirmed →
   │
   ├─ T2: getTransaction → decode → check fee payer === entry.wallet
   │     ├─ payer mismatch → return { ok: false, reason: 'wallet_mismatch' }
   │     └─ match →
   │
   ├─ (T3 deferred)
   │
   └─ return { ok: true }
   │
   ├─ ok: resolvePendingSigning(flagId, signature) + 200 { status: 'accepted', verified: true }
   └─ !ok: rejectPendingSigning(flagId, reason) + 4xx VALIDATION_FAILED envelope
```

### RPC client + network routing

The verifier needs an RPC URL. Existing convention (per `loadNetworkConfig`):
- `entry.network === 'mainnet-beta'` → `SIPHER_HELIUS_API_KEY` mainnet
- `entry.network === 'devnet'` → devnet RPC

Reuse `createConnection(loadNetworkConfig().clusterName)` (the same path the agent tools use). The verifier accepts a `Connection` injected at construction so unit tests can mock without hitting the real network.

### Timing budget

`getSignatureStatuses` typically responds in 50-200ms for known signatures. `getTransaction` can take 200-800ms (fetching the full tx body). With both calls in series the confirm-route latency goes from ~5ms (current) to ~250-1000ms.

This is acceptable for a UX path where the user just signed a transaction; they expect a brief confirmation lag. **Hard ceiling:** if total verification > 3s, time out and return `503 UNAVAILABLE` with a `Retry-After` hint. The frontend may retry once.

Confirmation level: use `'confirmed'` (~1s after submission) not `'finalized'` (~12s). Confirmed is sufficient for telemetry; finalized would block the UX too long. The signature can still later be unrolled by chain reorg, but Solana reorg risk on confirmed txs is rare enough that downstream Torque attribution is acceptable.

### Failure posture

| Failure | Action | Why |
|---|---|---|
| RPC down / network error | 503 UNAVAILABLE + auto-reject pending (configurable) | Closed posture by default — better to retry than to admit unverified. Operator may flip to open-posture via env flag for outage tolerance. |
| Signature not yet confirmed (in-flight) | 503 UNAVAILABLE + Retry-After: 2 | Confirm may complete in seconds; retry is the right answer |
| Signature explicitly not found (after retries with backoff) | 4xx VALIDATION_FAILED + reject pending | Likely fake |
| Wallet mismatch | 4xx VALIDATION_FAILED + reject pending | Definitely fake |

**Env flag:** `SIPHER_SIG_VERIFY=strict|advisory|off` (default `strict`).
- `strict` — all failures reject the pending entry as designed above
- `advisory` — verification runs but failures only LOG; promise resolves on the client's word (today's behavior). Used for soak-testing the verifier with no UX regression.
- `off` — skip verification entirely. Emergency lever only; should never be the long-term value.

Mirrors the `SENTINEL_MODE` precedent — a kill-switch posture is established practice in this codebase.

---

## Implementation

### New module: `packages/agent/src/sentinel/verify-signature.ts`

```ts
import { Connection, PublicKey } from '@solana/web3.js'
import type { PendingSigningFlag } from './pending-signing.js'

export type VerifyResult =
  | { ok: true; slot: number }
  | { ok: false; reason: 'not_confirmed' | 'wallet_mismatch' | 'rpc_error' | 'timeout'; detail?: string }

export interface VerifyOptions {
  connection: Connection
  /** ms; default 3000 */
  timeoutMs?: number
  /** Number of getSignatureStatuses attempts; default 3 with linear backoff */
  retries?: number
}

export async function verifySignature(
  signature: string,
  entry: PendingSigningFlag,
  opts: VerifyOptions,
): Promise<VerifyResult> {
  // T1: existence + confirmation
  // T2: fee-payer match
  // (T3 deferred)
}
```

Return type is a discriminated union — pairs cleanly with [[2026-05-15-assert-never-exhaustiveness-design]] for downstream switches.

### Confirm-route changes (`packages/agent/src/routes/tool-signing.ts`)

```ts
toolSigningRouter.post('/:flagId/confirm', async (req, res) => {
  // ... existing checks ...

  // NEW: verify
  const mode = (process.env.SIPHER_SIG_VERIFY ?? 'strict').toLowerCase()
  if (mode !== 'off') {
    const result = await verifySignature(signature, entry, {
      connection: createConnection(entry.network),
      timeoutMs: 3000,
    })
    if (!result.ok) {
      if (mode === 'strict') {
        rejectPendingSigning(flagId, `verification_failed: ${result.reason}`)
        sendSentinelError(res, 'VALIDATION_FAILED', `signature verification failed: ${result.reason}`)
        return
      }
      // advisory mode — log and continue
      console.warn(`[signing] verify failed (advisory mode): flagId=${flagId} reason=${result.reason}`)
    }
  }

  resolvePendingSigning(flagId, signature)
  res.status(200).json({ status: 'accepted', verified: mode === 'strict' })
})
```

Note `async` — Express 5 supports async handlers natively.

### Env vars

```bash
SIPHER_SIG_VERIFY=strict   # strict | advisory | off
```

Add to `.env.example`. Default `strict`.

---

## Test plan

### Unit tests for `verifySignature` (`packages/agent/tests/sentinel/verify-signature.test.ts`)

- [ ] Confirmed signature + matching wallet → `{ ok: true, slot: <n> }`
- [ ] Signature not found via getSignatureStatuses (returns null) → `{ ok: false, reason: 'not_confirmed' }`
- [ ] Signature found but err: not-null → `{ ok: false, reason: 'not_confirmed', detail: <err string> }`
- [ ] Signature confirmed but fee payer != entry.wallet → `{ ok: false, reason: 'wallet_mismatch' }`
- [ ] RPC throws → `{ ok: false, reason: 'rpc_error' }` (with detail)
- [ ] Times out after `timeoutMs` → `{ ok: false, reason: 'timeout' }`
- [ ] Retries on transient nulls with linear backoff (verify call count + timing via fake timers)

### Route integration tests (`packages/agent/tests/routes/tool-signing.test.ts`)

- [ ] `strict` mode + verifier returns ok → 200 `{ status: 'accepted', verified: true }`, pending resolved
- [ ] `strict` mode + verifier fails → 4xx VALIDATION_FAILED envelope, pending REJECTED (not resolved)
- [ ] `advisory` mode + verifier fails → 200 `{ status: 'accepted', verified: false }`, pending resolved, warn logged
- [ ] `off` mode + invalid signature → 200, pending resolved (verifier never called)
- [ ] Verifier RPC error in strict → 503 with Retry-After header
- [ ] verified flag in response body is correct for each mode

### Existing tests

- [ ] No regression in `packages/agent/tests/routes/tool-signing.test.ts` (existing 4 cases)
- [ ] Full agent suite: `pnpm --filter @sipher/agent test`

### Manual smoke (post-deploy)

- [ ] Submit a valid signature via sipher.sip-protocol.org chat send flow → 200 accepted
- [ ] Submit a known-invalid signature via curl → 4xx VALIDATION_FAILED
- [ ] Set `SIPHER_SIG_VERIFY=advisory`, repeat invalid → 200 accepted + warn in logs
- [ ] Devnet vs mainnet routing: verify mainnet signature on devnet RPC returns not_confirmed (proves network routing)

---

## Risks

**Increased latency on confirm.** ~250-1000ms added per request. UX-acceptable (user just signed; brief lag is normal) but logged for monitoring. If P99 > 2s, consider parallelizing T1+T2 calls (today specified sequentially for clarity).

**RPC quota burn.** Each confirm adds 1-2 RPC calls. At Helius rates these are cheap (< $0.0001 per call) but at scale (1000 confirms/day) adds up. Mainnet Helius API key has known limits — verify the budget at rollout.

**False positives from RPC inconsistency.** Different RPC endpoints can disagree on confirmation status briefly. Mitigation: use the same network's primary RPC (Helius for mainnet) consistently; retry with linear backoff.

**T3 (instruction match) skipped — residual attack surface.** A wallet that signs a DIFFERENT transaction than the server requested (substituted via wallet UI manipulation) still passes T1+T2. The user-signed tx will land on chain. Telemetry attribution is correct (it IS the user's signature), but the user got a different outcome than intended. Mitigation: T3 in a follow-up. For now, document the known limit.

**Replay (same signature for two flagIds).** Not addressed by T1+T2. Two pending flags could both confirm with the same signature, Torque double-fires. Mitigation: dedupe at growth-hook level using a `seenSignatures` LRU cache. Out of scope for this spec; tracked as follow-up.

**Mode `off` risk.** Easy to leave on in production by mistake. Mitigation: admin-status endpoint surfaces the current mode, and `assertNever` on the mode union would prevent typo'd values. RECTOR-driven audit before deploys.

**Webhook alternative deferred.** Helius webhook subscriptions could push confirmations to sipher rather than polling RPC, eliminating polling cost. Bigger build. Tracked as follow-up.

---

## Migration / rollout

**Phase 1 (this PR):**
1. Land code with `SIPHER_SIG_VERIFY=advisory` as the default on the **VPS** for one week. Verify alerts in logs match expectations (most should be `ok`, occasional `not_confirmed` from race conditions).
2. After confidence, flip env to `strict` on VPS. No code change needed.

**Phase 2 (follow-up):**
1. Add T3 (instruction match).
2. Add `seenSignatures` LRU to growth-hook for replay prevention.
3. Consider migrating to Helius webhooks if quota burn is meaningful.

**No data migration.** No DB schema changes. In-memory `pending` Map untouched in shape (verification is upstream of resolve/reject).

**Frontend changes: none required.** The `verified` field in response body is additive and ignored by today's frontend. If the frontend wants to surface the verification result (e.g. a green checkmark on the chat message), that's a separate UI tweak.

---

## Follow-ups (out of scope)

- T3 instruction-match: structural comparison of deserialized tx vs `entry.serializedTx`. Tricky because Solana versioned txs and lookup tables make byte-level comparison fragile; needs decoded-instruction equivalence.
- Replay dedupe: LRU of seen signatures in growth-hook so Torque can't be tricked into double-attribution.
- Helius webhook-based confirmation instead of polling.
- Apply the same pattern to claim transactions — see [[2026-05-15-claim-phase-2-design]] for the broader claim rework.
