# sipher#262 — Tx Signing Callback (Chat-Driven Send + Swap)

**Date:** 2026-05-14
**Author:** RECTOR (via brainstorm with CIPHER)
**Status:** Draft — awaiting review
**Tracking issue:** [sipher#262](https://github.com/sip-protocol/sipher/issues/262)
**Related PR (predecessor):** [sipher#269](https://github.com/sip-protocol/sipher/pull/269) (PR-E Torque canonical-ingest rewrite)
**Predecessor session:** `session-handoff-2026-05-14.md`

---

## 1. Problem

The Torque growth-hook (`packages/agent/src/integrations/torque/growth-hook.ts`) emits a `sipher_*_completed` event to Torque ingest when a fund-moving tool returns a successful result with a `signature` field. Today, `send` and `swap` (chat-driven) never produce that signature because their executors return `{ status: 'awaiting_signature', serializedTx }` BEFORE the transaction is broadcast — and the chat UI never reads `serializedTx`, never signs, never broadcasts. Net effect: chat-driven send/swap are decorative (the assistant says "preparing send…" but nothing happens on-chain), and the growth-hook has nothing to emit.

This problem was surfaced in the holistic post-PR-D code review of the Torque MCP integration (PRs #256/#258/#260/#261) and tracked in [sipher#262](https://github.com/sip-protocol/sipher/issues/262). The issue body recommended option (c) (claim-only emission) for the Frontier hackathon shadow window and option (a) (confirmation callback) as the proper fix for post-judging mainnet rollout. This spec covers option (a) for **chat-driven send + swap**.

### 1.1 What's broken today

The agent has three fund-moving paths, each broken for a different reason:

| Path | Tools | What happens | Why it's broken |
|---|---|---|---|
| Chat-driven live ops | `send`, `swap` | Tool returns `serializedTx`; chat UI ignores it | Chat UI has no sign-and-broadcast flow; SSE `tool_result` event drops the payload |
| Scheduled ops (via crank) | `drip`, `splitSend`, `sweep`, `consolidate`, `recurring`, `scheduleSend` | Tool writes pending row to `scheduled_ops`; `crank.ts` polls every 60s and calls `executeTool('send', params)` | Crank has no wallet, can't sign. Each tick returns `serializedTx`, logs "prepared", repeats. |
| Dedicated UI flows | `deposit`, `refund` | `DepositView` / `WithdrawView` call `/api/vault/*-tx`, use `useTransactionSigner` to sign + broadcast | Works. Bypasses the chat path entirely. |

The growth-hook reads `result.signature || result.txSignature` (`growth-hook.ts:101-106`). Of all chat tools, only `claim` populates `txSignature` — and it does so with the user's INPUT deposit-tx-signature, not a fresh broadcast signature. That's semantically dubious (the event represents claim-broadcast, but the signature is from the deposit it's claiming) but produces enough events to demo with on devnet.

### 1.2 Why this spec is scoped to chat-driven send + swap only

The scheduled-op path needs a different architecture — pre-signed batches, durable nonces, delegated keys, programmable wallets, or user re-engagement. Each option has privacy/security tradeoffs that deserve their own brainstorm. The promise-gate pattern in this spec cannot solve the scheduled-op problem (no human at the other end to resolve the promise).

Claim Phase 2 (wiring the real ECDH derivation + `claim_transfer` instruction) is also separate scope — claim today is Phase 1-stubbed (`serializedTx: null`), and the SDK work for ECDH key derivation lives upstream in `@sip-protocol/sdk`.

Filing both as follow-ups (see §11) lets this spec stay tight and shippable in a small number of PRs.

---

## 2. Scope

**In scope:**

- New SSE event type `tool_signing_required` carried by `chatStream`
- New server-side pending registry `pending-signing.ts` (sibling of SENTINEL's `pending.ts`)
- New endpoints `POST /api/tool-signing/:flagId/confirm` and `POST /api/tool-signing/:flagId/reject`
- New executor wrapper layer (in `chatStream`) that intercepts `awaiting_signature` for `send`/`swap` and blocks until callback
- New React component `SignTxCard.tsx` (sibling of `SentinelConfirm.tsx`)
- New `ChatSidebar.tsx` branch that renders SignTxCard on `tool_signing_required` events
- Result mutation: signing-wait wrapper attaches `signature` to the tool result before returning so growth-hook fires naturally
- Tech-debt cleanup: delete `packages/agent/src/routes/confirm.ts` (dead code; superseded)

**Out of scope (follow-up issues):**

- Scheduled-op broadcasts (drip / splitSend / sweep / consolidate / recurring / scheduleSend)
- Claim Phase 2 (ECDH derivation + claim_transfer instruction wiring)
- `tool_signing_expired` proactive expiry SSE event
- Server-side signature verification via `getSignatureStatus` (revisit if abuse appears in Torque ingest)
- Adding `amount_lamports` + `asset` to send growth events (current design keeps send amount-private end-to-end; swap is amount-visible because Jupiter is amount-visible)
- Playwright wallet-mock E2E tests

---

## 3. Architecture — happy path data flow

```
USER (in chat)              SERVER (agent)                    CLIENT (ChatSidebar)
     |                            |                                   |
     | "send 1 SOL to alice.sol"  |                                   |
     |--------------------------->|                                   |
     |                            | Pi → tool_use(send, {...})        |
     |                            |    → executeTool('send', ...)     |
     |                            |       → preflight gate            |
     |                            |       → executeSend → builds tx,  |
     |                            |         returns {serializedTx,    |
     |                            |         status: awaiting_signature}|
     |                            |       → signing-wait wrapper:     |
     |                            |         createPendingSigning()    |
     |                            |         emit SSE tool_signing     |
     |                            |         _required + await promise |
     |                            |--------- SSE: tool_signing_required-->|
     |                            |          {flagId, toolName,       |   render
     |                            |           serializedTx, network,  |   SignTxCard
     |                            |           walletPubkey, display}  |
     |                            |          (await pending promise)  |
     |                            |                                   | user clicks Sign
     |                            |                                   | wallet popup
     |                            |                                   | signAndBroadcast()
     |                            |                                   | → signature on-chain
     |                            |  POST /api/tool-signing/:flagId/  |
     |                            |    confirm  body: { signature }   |
     |                            |<----------------------------------|
     |                            | resolvePendingSigning(flagId, sig)|
     |                            | promise resolves → wrapper        |
     |                            |   returns {...result, signature,  |
     |                            |             status: 'completed'}  |
     |                            | growth-hook reads result.signature|
     |                            |   → emits ingest event to Torque  |
     |                            | Pi continues → final assistant    |
     |                            |   text "Sent 1 SOL, tx XYZ..."    |
     |                            |--------- SSE: tool_result ------->|   complete card
     |                            |          + content_block_delta    |   show tx link
     |<---------------------------|---------- SSE: message_complete --|
     | "Sent 1 SOL to alice.sol,  |                                   |
     |  signed and broadcast.     |                                   |
     |  tx: XYZ..."               |                                   |
```

### Key properties

1. **Executor blocks during signing.** The signing-wait wrapper awaits the pending promise; Pi's tool loop blocks; the SSE stream stays open the whole time. Node async I/O + SSE keep-alives handle this fine. Already proven by SENTINEL's identical pattern.
2. **Tool result carries `signature` on return.** The signing-wait wrapper mutates the result to add `signature` before bubbling out. Growth-hook reads `result.signature` via the existing `extractTxSignature` helper — zero code changes to growth-hook.
3. **One registry per concern.** SENTINEL has `pending.ts` (advisory pauses, 2-min default). Signing gets a parallel `pending-signing.ts` (signing pauses, 5-min default). Mirror, don't generalize — see §4.3 for rationale.
4. **Cancellation = rejected promise.** Reuses the synthetic `cancelled_by_user` short-circuit pattern from SENTINEL (`agent.ts:418-435`). Tool returns `{ status: 'cancelled_by_user', reason }` with no `signature` → growth-hook skips emit.

---

## 4. Design — server side

### 4.1 New SSE event

Add to the existing `SSEEvent` union in `packages/agent/src/agent.ts`:

```typescript
export interface SSEToolSigningRequired {
  type: 'tool_signing_required'
  /** Server-issued invocation ID; client POSTs back here */
  flagId: string
  /** Tool name — 'send' | 'swap' for v1 */
  toolName: 'send' | 'swap'
  /** Base64-serialized unsigned transaction */
  serializedTx: string
  /** 'mainnet-beta' | 'devnet' — for client-side sanity check vs. connected RPC */
  network: 'mainnet-beta' | 'devnet'
  /** Wallet that should sign — client should verify still-connected pubkey matches */
  walletPubkey: string
  /** Server-formatted display payload — keeps client rendering tool-agnostic */
  display: {
    title: string         // "Send 1 SOL to alice.sol" | "Swap 1 SOL → ~150 USDC"
    primaryDetail: string // "Stealth recipient (auto-generated)" | "Routed via Jupiter v6"
    secondaryDetails: string[]  // fee, slippage, route, net amount, etc.
  }
}
```

Why `display` is server-formatted: matches the existing `sentinel_pause` pattern (the server humanizes `action`, `amount`, `description`). One `<SignTxCard />` component handles all signing flows without per-tool branching on the client. Mobile and other clients can reuse the same payload.

### 4.2 New endpoints

Both JWT-authenticated (use existing `verifyJwt` middleware). Mounted under `/api/tool-signing` in `packages/agent/src/index.ts`.

```
POST /api/tool-signing/:flagId/confirm
  Body:     { signature: string }   // base58 Solana tx signature, 64-88 chars
  Success:  { status: "accepted" }
  Errors:   400 VALIDATION_FAILED — signature missing/malformed/empty
            403 FORBIDDEN        — JWT wallet ≠ pending entry's wallet
            404 NOT_FOUND        — flagId doesn't exist or expired
            500 INTERNAL         — JWT middleware didn't attach wallet

POST /api/tool-signing/:flagId/reject
  Body:     {} (or { reason?: string })
  Success:  { status: "rejected" }
  Errors:   403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL
```

Error envelope reuses `packages/agent/src/routes/sentinel-errors.ts` (`{ error: { code, message } }`) from PR #167.

**Why two endpoints, not one with action-in-body:** Mirrors SENTINEL's `/promise-gate/:id/resolve` and `/reject` (renamed in PR #168). One mental model: confirm vs reject = resolve vs reject.

**Signature validation policy (v1):** Server accepts the signature as-claimed. Does NOT call `connection.getSignatureStatus()` before resolving the promise. Reason: adds an RPC round-trip and external dependency to the critical callback path. Solana itself is the source of truth — a fake signature emits a fake growth event, but Torque's downstream attribution will simply not award it (the tx doesn't exist). The privacy/cost tradeoff is acceptable. Defense-in-depth verification is a follow-up if Torque ingest reveals fake-emission abuse.

### 4.3 Pending registry — `pending-signing.ts`

New module: `packages/agent/src/sentinel/pending-signing.ts`. Mirrors `pending.ts` exactly, with three deltas:

```typescript
export interface PendingSigningFlag {
  sessionId: string
  toolName: 'send' | 'swap'
  /** Wallet that initiated — JWT wallet on callback must match */
  wallet: string
  /** Base64 serialized tx; stored for inspection/audit, not re-emitted */
  serializedTx: string
  /** 'mainnet-beta' | 'devnet' */
  network: 'mainnet-beta' | 'devnet'
  /** Original tool input — useful for audit/debug */
  toolInput: unknown
  createdAt: number
  resolver: (signature: string) => void   // ← carries the signature
  rejecter: (reason: Error) => void
  timeoutHandle: NodeJS.Timeout
}

const TIMEOUT_MS_DEFAULT = 5 * 60 * 1000   // 5 min (vs SENTINEL's 2 min)

export function createPendingSigning(params: {
  sessionId: string
  toolName: 'send' | 'swap'
  wallet: string
  serializedTx: string
  network: 'mainnet-beta' | 'devnet'
  toolInput: unknown
}): { flagId: string; promise: Promise<string> }   // ← resolves with signature

export function resolvePendingSigning(flagId: string, signature: string): boolean
export function rejectPendingSigning(flagId: string, reason: string): boolean
export function clearAllSigning(sessionId: string): void
export function getPendingSigning(flagId: string): PendingSigningFlag | undefined
export function _setTimeoutMsForTests(ms: number): void
```

**Why mirror, not generalize.** Considered unifying SENTINEL + signing into one "interactive promise gate" module with a discriminated payload union. Rejected for two reasons:

1. **Resolver type differs.** SENTINEL resolves `() → void`; signing resolves `(signature: string) → void`. A union resolver erodes type safety at every call site.
2. **Lifecycles drift.** 2 min vs 5 min; different "disconnect" semantics — SENTINEL pause survives partial disconnects ambiguously; signing should clear hard. Premature abstraction.

If a third interactive flow appears, that's the moment to generalize.

### 4.4 Executor wrapper — `chatStream`

Extends the existing wrapper stack in `agent.ts` `chatStream`. New ordering, outer → inner:

```
growth-hook wrapper          ← unchanged
  signing-wait wrapper       ← NEW (this spec)
    SENTINEL pause wrapper   ← unchanged
      preflight gate         ← unchanged
        executeSend / executeSwap
```

The signing-wait wrapper:

```typescript
const signingWrappedExecutor = async (name, input) => {
  // SENTINEL layer evaluates first (gates intent, not tx bytes)
  const result = await sentinelWrappedExecutor(name, input)

  // Intercept awaiting_signature for send/swap only
  if (
    (name === 'send' || name === 'swap') &&
    isAwaitingSignatureResult(result) &&
    hasSerializedTx(result) &&
    typeof input.wallet === 'string'
  ) {
    const { flagId, promise } = createPendingSigning({
      sessionId,
      toolName: name,
      wallet: input.wallet,
      serializedTx: result.serializedTx!,
      network: net.clusterName,
      toolInput: input,
    })

    externalQueue.push({
      type: 'tool_signing_required',
      flagId,
      toolName: name,
      serializedTx: result.serializedTx!,
      network: net.clusterName,
      walletPubkey: input.wallet,
      display: formatSigningDisplay(name, input, result),
    })
    if (externalWake) externalWake()

    let signature: string
    try {
      signature = await promise
    } catch (err) {
      return {
        ...result,
        status: 'cancelled_by_user',
        reason: err instanceof Error ? err.message : 'cancelled',
      }
    }

    return { ...result, signature, status: 'completed' }
  }

  return result
}
```

**Why this wrapper order (outer → inner: growth-hook → signing → SENTINEL → preflight):**

- SENTINEL gates on intent before the tx is built (innermost interactive layer).
- Signing-wait must come AFTER `executeSend` returns the built tx.
- Growth-hook runs on the OUTERMOST wrapper because it must fire only after both gates passed AND signature received.

**Preview-mode guard:** When user types "send 1 SOL" without `wallet` in input, `executeSend` returns `serializedTx: null`. The `hasSerializedTx(result)` check fails → wrapper falls through → no signing pause → no signature → growth-hook skips emit. Preview-mode behavior preserved.

**Display formatter:** New helper `formatSigningDisplay(name, input, result)` lives next to the wrapper. Per-tool branches:

- `send`: title = `"Send {amount} {token} to {recipient-short}"`; primaryDetail describes stealth privacy; secondaryDetails list fee + net amount
- `swap`: title = `"Swap {fromAmount} {fromToken} → ~{toAmount} {toToken}"`; primaryDetail describes route; secondaryDetails list slippage + route + stealth output

### 4.5 SSE disconnect cleanup

The existing `chatStream` cleanup hook (where `clearAll(sessionId)` is called for SENTINEL pending) gets a parallel `clearAllSigning(sessionId)` call. Same teardown moment — when the underlying response stream ends or the client disconnects.

### 4.6 Status-field semantics after this change

| Where | `status` value | `signature` | Meaning |
|---|---|---|---|
| `executeSend` / `executeSwap` return | `'awaiting_signature'` | absent | Tool built tx; signing pending |
| Signing-wait wrapper success | `'completed'` | present (base58 string) | User signed + broadcast + confirmed on-chain |
| Signing-wait wrapper reject | `'cancelled_by_user'` | absent | Promise rejected (cancel, timeout, disconnect) |

Growth-hook's `extractTxSignature(result)` already reads `result.signature` → works unchanged.

---

## 5. Design — frontend

### 5.1 New component — `SignTxCard.tsx`

Path: `app/src/components/SignTxCard.tsx`. Mirrors the self-contained shape of `SentinelConfirm.tsx`.

```typescript
interface Props {
  flagId: string
  toolName: 'send' | 'swap'
  serializedTx: string
  network: 'mainnet-beta' | 'devnet'
  walletPubkey: string
  display: {
    title: string
    primaryDetail: string
    secondaryDetails: string[]
  }
  onResolved: (decision: 'confirm' | 'reject') => void
}
```

### 5.2 State machine

```
idle ─── Sign clicked ─── signing ─── signed ─── broadcasting ─── confirmed-on-chain
  │                                                                       │
  │                                                                       ▼
  │                                                                callback-posting
  │                                                                       │
  │                                                                       ▼
  └─── Cancel clicked ─── rejecting ─── rejected ─── done                success
                                                                          │
       error in signing/broadcast ─── error ─── (Retry → idle)            ▼
                                                                         done
```

Status derives from `useTransactionSigner().status` (`idle | signing | broadcasting | confirmed | error`) plus three card-local states: `callback-posting`, `rejecting`, `done`.

### 5.3 Sign path

1. User clicks "Sign with Wallet" → call `useTransactionSigner().signAndBroadcast(serializedTx)`. Existing hook handles blockhash refresh, deserialize, sign, broadcast, `connection.confirmTransaction()` to `'confirmed'` commitment.
2. On `{ signature }` from hook: POST `/api/tool-signing/:flagId/confirm` with `{ signature }`. On 2xx, set state to `done`, call `onResolved('confirm')`. On non-2xx, show error + Retry button.
3. On `{ error }` from hook (wallet rejected, RPC failure, blockhash expired): show inline error + Retry/Cancel buttons.

### 5.4 Cancel path

1. User clicks Cancel → POST `/api/tool-signing/:flagId/reject`. On success, call `onResolved('reject')`.
2. **Unmount-before-resolution cleanup:** `useEffect` cleanup function fires a best-effort POST reject when card unmounts in `idle` state, using `navigator.sendBeacon` if available or `fetch(..., { keepalive: true })` as fallback. Prevents stale server pending entries when the user closes the tab.

### 5.5 Wallet sanity-check

Before signing, the card verifies `useWallet().publicKey?.toBase58() === walletPubkey`. If user switched wallets between request and click, render "Reconnect [pubkey] to sign this transaction" with Sign disabled.

### 5.6 Network sanity-check

Reads `useConnection()` endpoint. If `network: 'mainnet-beta'` but connected RPC is devnet (or vice versa), render "Wrong network: connected to {connected}, this tx is for {expected}" with Sign disabled. Prevents accidental sign-on-wrong-network when the user has overridden their wallet RPC.

### 5.7 Visual style

Uses the same Tailwind tokens as `ConfirmCard` (`bg-glass-1`, `border-line`, etc.) so the visual language matches the rest of the chat UI. Layout is custom because we render structured `display.secondaryDetails` (a list) and state-dependent status text + signature link on success — `ConfirmCard`'s `action + amount + description` shape doesn't fit.

### 5.8 ChatSidebar wiring

Add a new branch to the existing SSE event handler (`ChatSidebar.tsx:165`):

```typescript
} else if (event.type === 'tool_signing_required') {
  addMessage({
    id: crypto.randomUUID(),
    role: 'system',
    content: '',
    kind: 'tool_signing_required' as const,
    meta: {
      flagId: event.flagId,
      toolName: event.toolName,
      serializedTx: event.serializedTx,
      network: event.network,
      walletPubkey: event.walletPubkey,
      display: event.display,
    },
  })
}
```

Render branch (parallel to `sentinel_pause` render at line 289):

```typescript
if (msg.role === 'system' && msg.kind === 'tool_signing_required' && token) {
  const meta = (msg.meta ?? {}) as { /* typed meta */ }
  return (
    <div key={msg.id} className="flex justify-start">
      <div className="max-w-[90%] w-full">
        <SignTxCard
          flagId={meta.flagId ?? ''}
          toolName={meta.toolName ?? 'send'}
          serializedTx={meta.serializedTx ?? ''}
          network={meta.network ?? 'devnet'}
          walletPubkey={meta.walletPubkey ?? ''}
          display={meta.display ?? { title: '', primaryDetail: '', secondaryDetails: [] }}
          onResolved={() => dismissMessage(msg.id)}
        />
      </div>
    </div>
  )
}
```

### 5.9 Why an explicit Sign button, not auto-trigger

Wallet popups should only fire from explicit user gesture for security/UX hygiene. The Sign button enforces that. Matches `WalletStandard` provider expectations — wallets often refuse signature requests not tied to user gestures.

---

## 6. Growth-hook integration

**Zero changes to `growth-hook.ts`.** This is the design's biggest payoff.

### 6.1 Emission firing order (chronological)

1. User clicks Sign in SignTxCard
2. `useTransactionSigner.signAndBroadcast`: wallet popup → user signs
3. `connection.sendRawTransaction` → returns signature
4. `connection.confirmTransaction` → on-chain confirmation reached (commitment 'confirmed')
5. SignTxCard POSTs `/api/tool-signing/:flagId/confirm` with `{ signature }`
6. Server: `resolvePendingSigning(flagId, signature)` → promise resolves
7. Signing-wait wrapper: `result = { ...originalResult, signature, status: 'completed' }`
8. Wrapper returns to growth-hook layer
9. `wrapExecutorWithGrowthHook`: `void emitGrowthEvent(name, input, result, client, opts).catch(...)` (fire-and-forget)
10. Pi receives result, continues turn, emits content_block_delta + tool_result + message_complete

By step 9, the tx is **already confirmed on-chain** (step 4). The growth event represents a real, finalized event. Fake-emission risk on cancel/timeout paths is structurally impossible because those return `{ status: 'cancelled_by_user' }` without `signature` → `extractTxSignature → undefined` → emit skipped.

### 6.2 Event-shape mapping

| Tool | Event name | `amount_lamports` | `asset` |
|---|---|---|---|
| `send` | `sipher_private_send_completed` | — | — |
| `swap` | `sipher_private_swap_completed` | `result.amountInLamports \|\| result.amountLamports` | `result.asset \|\| result.outputMint` |

Send is amount-private end-to-end. Swap is amount-visible because Jupiter is amount-visible anyway. Aligns with the privacy spec; matches the existing `AMOUNT_INCLUDED_TOOLS = new Set(['swap'])` set in growth-hook.

### 6.3 Rebate destination derivation

Unchanged. `deriveRebateDestination` already takes `{ wallet, domain, connection }` from the wrapper closure. For send + swap, `input.recipient` may or may not be a `.sol` domain — the function handles both paths. Per-event fresh stealth derivation prevents Torque from learning recipient identity.

---

## 7. Failure modes + timeouts

### 7.1 Failure-mode matrix

| Source | Trigger | Server response | Client response |
|---|---|---|---|
| Wallet popup | User rejects | (server unaware) | hook → `error`; card shows error + Retry/Cancel |
| RPC broadcast | `sendRawTransaction` throws | (server unaware) | hook → `error`; same |
| RPC confirm | `confirmTransaction` blockhash expired | (server unaware) | hook → `error`; same |
| Callback POST | Network failure | (server unaware) | Card stays in `callback-posting`; show error + Retry |
| Callback POST | flagId not found | 404 `NOT_FOUND` | "Session expired — please ask SIPHER again" |
| Callback POST | JWT wallet ≠ pending wallet | 403 `FORBIDDEN` | "Wallet mismatch — reconnect [pubkey]" |
| Callback POST | Signature missing/malformed | 400 `VALIDATION_FAILED` | Inline error |
| Server timeout | 5 min elapsed | `rejectPendingSigning(flagId, 'timeout')` | Card stays mounted; subsequent Sign click 404s |
| SSE disconnect | Client closes tab/socket | `clearAllSigning(sessionId)` rejects all pending entries with `'client_disconnected'` | Card unmounts naturally |
| Component unmount | React parent removes card | best-effort POST reject via sendBeacon/keepalive | Server cleanup |

### 7.2 Timeout policy

Server has the only timer. 5 min default, configurable via `_setTimeoutMsForTests`. No client-side countdown for v1 — don't pile UX onto the card. If user lets the card sit, signing 404s on click (with "Session expired" message). Future enhancement (out of scope): emit a `tool_signing_expired` SSE event when the server timer fires so the card can grey out proactively.

### 7.3 Error envelope

All endpoint errors use `packages/agent/src/routes/sentinel-errors.ts` (from PR #167): `{ error: { code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'UNAVAILABLE' | 'INTERNAL', message: string } }`. One error shape across the codebase.

---

## 8. Testing strategy

### 8.1 Agent (Vitest)

1. **`pending-signing.test.ts`** — registry unit tests:
   - `createPendingSigning` issues distinct flagIds per call
   - `resolvePendingSigning(flagId, signature)` resolves the promise with the signature
   - `rejectPendingSigning(flagId, reason)` rejects the promise with the reason
   - Default 5-min timeout auto-rejects with `'operation timed out'`
   - `clearAllSigning(sessionId)` rejects all entries for that session with `'client_disconnected'`
   - `getPendingSigning(flagId)` returns the entry or undefined
   - `_setTimeoutMsForTests(ms)` controls timeout for fast tests

2. **`agent.test.ts`** (extend `chatStream` suite) — signing-wait wrapper:
   - Triggers for `send` results with serializedTx + wallet
   - Triggers for `swap` results with serializedTx + wallet
   - Skips for preview-mode results (`serializedTx === null`)
   - Skips for tools other than `send`/`swap`
   - Respects SENTINEL cancellation (synthetic `cancelled_by_user` from inner SENTINEL layer short-circuits before signing wrapper attempts)
   - Mutates result to include `signature` after promise resolves
   - Returns synthetic `cancelled_by_user` on promise reject (cancel/timeout/disconnect)
   - Emits `tool_signing_required` SSE event through `externalQueue` with correct payload

3. **`tool-signing-routes.test.ts`** — endpoint handlers:
   - 200 + `{ status: 'accepted' }` on valid flagId + matching wallet + valid signature
   - 200 + `{ status: 'rejected' }` on `/reject` with valid flagId + matching wallet
   - 404 NOT_FOUND on missing/expired flagId
   - 403 FORBIDDEN on JWT wallet mismatch
   - 400 VALIDATION_FAILED on missing signature, empty signature, malformed base58
   - 500 INTERNAL when JWT middleware fails to attach wallet (safety check)

4. **Integration test** — full chat → signing → growth-hook emit cycle:
   - User chat message → SSE captures `tool_signing_required`
   - Test POSTs to `/api/tool-signing/:flagId/confirm` with fake signature
   - Growth-hook mock asserts `emitEvent` called with correct event shape (correct `eventName`, `tx_signature`, `rebate_destination`, `network`)
   - Verifies cancel path: POST `/reject` → no emit call

### 8.2 Frontend (Vitest)

1. **`SignTxCard.test.tsx`** — full state machine:
   - idle → signing → broadcasting → callback-posting → done (happy path)
   - Cancel path POSTs `/reject`, calls onResolved('reject')
   - Wallet mismatch disables Sign button + shows reconnect message
   - Network mismatch disables Sign button + shows wrong-network message
   - Error path enables Retry; Retry returns to idle
   - Unmount-while-idle fires best-effort reject beacon

2. **`ChatSidebar.test.tsx`** (extend existing) — SSE `tool_signing_required` event:
   - Creates system message with `kind: 'tool_signing_required'`
   - Renders SignTxCard with meta forwarded
   - Dismisses message after `onResolved` fires

### 8.3 Frontend E2E (Playwright)

Skipped for v1. Requires wallet-adapter mocks that aren't in the current Playwright infra. Defer to follow-up unless an existing test pattern is reusable.

### 8.4 Coverage targets

- Agent: 80%+ statement/branch on new modules (`pending-signing.ts`, routes, wrapper) per project standard
- Frontend: 80%+ statement/branch on `SignTxCard.tsx`

---

## 9. Tech-debt cleanup tracked in this spec

1. **Delete `packages/agent/src/routes/confirm.ts`** + its mount in `index.ts:198` + its console.log in `index.ts:349`. Dead code: `requestConfirmation` is defined but never called from production code. Replaced by the new `/api/tool-signing/*` endpoints. (Git blame: it was scaffolded in commit `b7f316f` and never wired up; see #95, #106-110 for related hardening commits that touched it.)

2. **Update `packages/agent/src/integrations/torque/README.md`** to note which tools emit today vs. which require follow-up specs.

---

## 10. Out-of-scope follow-up issues to file

These should be filed as separate GitHub issues after this spec is merged:

1. **Claim Phase 2** — wire `@sip-protocol/sdk` ECDH derivation + the real `claim_transfer` instruction, then route claim through the same promise-gate pattern for signing. Replaces today's input-signature-as-emission-key hack.

2. **Scheduled-op broadcasts** — design a wallet-delegation or pre-signed-batch architecture for `drip`, `splitSend`, `sweep`, `consolidate`, `recurring`, `scheduleSend`. Requires its own brainstorm covering: pre-signed batch (durable nonces), delegated key (custodial-style), programmable wallet (Squads Smart Account / session keys), re-engagement notification. Each has different privacy/security tradeoffs.

3. **`tool_signing_expired` SSE event** — proactive expiry signal so clients can grey out stale SignTxCards. Low priority — current behavior (signing 404s on click) is acceptable.

4. **Defense-in-depth signature verification** — server calls `connection.getSignatureStatus(signature)` before resolving the promise. Revisit if Torque ingest reveals fake-emission abuse patterns.

5. **Playwright wallet-mock E2E** — full browser-driven test of the signing flow with a deterministic mock wallet adapter.

6. **Amount fields on send growth events** — if Torque's downstream attribution needs send amounts, add `amount_lamports` to `SendToolResult` top-level and to `AMOUNT_INCLUDED_TOOLS`. Note this breaks the current privacy property (sends are amount-private end-to-end).

---

## 11. Open questions / risks

### 11.1 Concurrent signing requests

What if a user invokes two `send` tools in quick succession (e.g., asks the LLM to send to two addresses in one message)? Pi processes tool calls sequentially within a turn, so the second send waits for the first to return. The first send blocks on signing. As long as the first resolves (or rejects), the second proceeds normally. The card UI shows one card at a time. No concurrency-control needed at the registry level.

### 11.2 Multi-tab signing

Not actually an issue: each `POST /api/chat/stream` opens a fresh SSE stream with its own server-generated `sessionId` (the frontend doesn't pass one — see `chatStream` `opts.sessionId ?? randomUUID()` in `agent.ts`). Two tabs sending two messages produce two independent streams with two independent registries. A SignTxCard only exists in the tab whose request created it. No coordination needed.

### 11.3 Wallet adapter compatibility

`useTransactionSigner` uses `useWallet().signTransaction`. Most major Solana wallet adapters (Phantom, Solflare, Backpack, Glow, Coinbase) support this. The hook also handles both legacy and VersionedTransaction. Mobile Wallet Adapter (Seeker, Phantom mobile) — should work but not explicitly tested in v1. Note that the WithdrawView already exercises the same hook in production; signing send/swap is the same code path with different tx contents.

### 11.4 Tx expiry during user idle time

The server-built tx includes a recent blockhash at build time. If the user takes >60s to click Sign, the blockhash expires. `useTransactionSigner.signAndBroadcast` mitigates this by calling `connection.getLatestBlockhash` before signing and updating the tx blockhash. Works for `Transaction`; `VersionedTransaction` blockhash update is also handled (see `useTransactionSigner.ts:46-54`). No spec change needed.

### 11.5 SENTINEL pause + signing pause sequencing

A `send` with SENTINEL advisory ON would render `sentinel_pause` card first (block → user approves) → `executeSend` runs → signing-wait wrapper fires `tool_signing_required` card. The user sees TWO cards in sequence. Acceptable — they're different prompts (risk approval vs sign). Both auto-dismiss on resolution.

### 11.6 Growth-hook breakage if wrapper order is wrong

If the wrapper stack were ordered `signing → growth-hook → SENTINEL → preflight` (signing as the outer-most wrapper), growth-hook would fire on the inner SENTINEL/preflight result — which doesn't include the signature yet — and emission would silently regress. The correct order is documented in §4.4. The agent test suite must lock the wrapper order (test that growth-hook receives the signature-mutated result, not the pre-mutation result).

---

## 12. Acceptance criteria

A PR implementing this spec MUST satisfy ALL of the following:

- [ ] `packages/agent/src/sentinel/pending-signing.ts` exists with the API spec'd in §4.3
- [ ] `packages/agent/src/routes/tool-signing.ts` exposes `/api/tool-signing/:flagId/confirm` and `/api/tool-signing/:flagId/reject` per §4.2
- [ ] `packages/agent/src/index.ts` mounts the new router behind `verifyJwt`
- [ ] `packages/agent/src/agent.ts` `chatStream` includes the signing-wait wrapper per §4.4
- [ ] `packages/agent/src/agent.ts` `SSEEvent` union includes `SSEToolSigningRequired` per §4.1
- [ ] `app/src/components/SignTxCard.tsx` exists with the state machine per §5.2
- [ ] `app/src/components/ChatSidebar.tsx` SSE handler + render branch include `tool_signing_required` per §5.8
- [ ] `packages/agent/src/routes/confirm.ts` is deleted + its mount + console.log removed
- [ ] `packages/agent/src/integrations/torque/README.md` updated per §9
- [ ] All tests in §8 pass; agent test count grows by ≥30 net; frontend test count grows by ≥10 net
- [ ] CI green: scan-for-secrets, test, component, playwright, build
- [ ] Manual smoke test on devnet: chat "send 0.01 SOL to <devnet stealth addr>" → SignTxCard renders → wallet sign → broadcast confirms → growth event observed in Torque dashboard custom_event stream
- [ ] Follow-up issues filed (claim Phase 2, scheduled-op broadcasts, the rest of §10)

---

## 13. Implementation plan handoff

Next step: invoke the `superpowers:writing-plans` skill to break this design into a task-by-task implementation plan suitable for subagent-driven development. Per project rules:

- All commits GPG-signed, no AI attribution
- Conventional-commit prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- Subagent-driven for complex tasks; inline for mechanical
- Two-stage review per task (spec adherence + code quality) + final holistic review before push
- `.env.example` check on any env-var change (lesson from PR-E)
- Co-Authored-By trailer audit before push (lesson from PR-E)
