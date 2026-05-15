# Claim Phase 2 — ECDH Derivation + Real `claim_transfer` Instruction — Design

**Date:** 2026-05-15
**Session:** frontier_sip_13
**Status:** Proposed — awaiting RECTOR review
**Predecessor:**
  - Phase 1 stub: `packages/agent/src/tools/claim.ts:64-95` (returns `serializedTx: null` + `stealthKeyDerived: true` placeholder)
  - README emission caveat: `packages/agent/src/integrations/torque/README.md:128` ("Uses input deposit-tx-signature as the emission key. Proper fix tracked in the claim Phase 2 follow-up.")
  - On-chain program reference: `programs/sip_privacy/src/instructions/claim_transfer.rs` (mainnet `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`, devnet same)
  - SDK ECDH primitive: `@sip-protocol/sdk` — `stealth.ts` derive functions
**Scope:** Replace the Phase 1 placeholder with a working claim flow: ECDH-derive the stealth private key from the deposit announcement + receiver's viewing/spending keys, build the `claim_transfer` instruction, serialize the unsigned tx, route through the existing tool-signing promise-gate, and emit the Torque event with the CLAIM tx signature (not the deposit tx signature).
**Out of scope:** SPL token claim path (Phase 1 also doesn't cover this; tracked separately); Ethereum claim flow; UI changes beyond what the existing SignTxCard already handles for send/swap.
**Estimated work-time:** 4-6 days, 1 PR (or 2 PRs if cleanly splittable into "ECDH module" + "claim wiring").

---

## Why this build

**The current placeholder lies.** When a user runs `claim` today, `executeClaim` validates inputs, returns `{ status: 'awaiting_signature', serializedTx: null, details: { stealthKeyDerived: true } }`. No ECDH actually happens. No claim transaction is built. No on-chain claim occurs. The chat UX shows "Claim prepared..." and the user has no path forward.

Yet the Torque growth-hook fires `sipher_private_claim_completed` because `executeClaim` returns a result containing a `txSignature` field (which is actually the *deposit* tx signature — not a real claim tx). Torque attribution is meaningless: a `claim_completed` event is fired when no claim occurred.

**Why now.** Phase 1 was an explicit placeholder during initial sipher build. M17 Solana same-chain privacy completed. The on-chain `claim_transfer` instruction is live on mainnet (`S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`). The SDK ECDH primitives are tested. There's no remaining blocker to making claim real.

**What this fix delivers.**
1. Real ECDH derivation: the stealth private key is recovered from the deposit's ephemeral pubkey + the recipient's viewing+spending keys.
2. Real `claim_transfer` instruction built and serialized.
3. Real tool-signing UX: the user gets a SignTxCard in chat with the actual claim tx, signs, and the tokens land in their destination wallet.
4. Honest Torque telemetry: `sipher_private_claim_completed` fires only when the claim tx confirms, with the CLAIM tx signature as the attribution key.

---

## Architecture

### Crypto background (one paragraph)

The deposit transaction posts an announcement to the `sip_privacy` program with:
- `ephemeralPubkey` — sender's per-payment fresh secp256k1 pubkey
- `stealthPubkey` — the one-time recipient address derived as `H(ECDH(ephemeral, viewing)) * G + spending`
- `commitment` — Pedersen commitment to the amount (binding + hiding)

The recipient holds `viewingPrivateKey` + `spendingPrivateKey`. ECDH gives back the shared secret `s = ECDH(viewingPrivateKey, ephemeralPubkey)`. Hashing `s` gives the stealth derivation tweak `t = H(s)`. The stealth private key is then `stealthPrivKey = t + spendingPrivateKey (mod n)`. This corresponds to `stealthPubkey` and is the signer for the `claim_transfer` instruction.

### Module structure

New module: `packages/agent/src/tools/claim-helpers.ts` (or extend existing `tools/claim.ts`):

```ts
import { Connection, Transaction, PublicKey } from '@solana/web3.js'
import { deriveStealthPrivateKey, parseAnnouncementPDA } from '@sip-protocol/sdk'

export interface ClaimContext {
  connection: Connection
  programId: PublicKey          // S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at
  depositTxSignature: string    // input from user
  viewingPrivateKey: string     // hex or base58
  spendingPrivateKey: string    // hex or base58
  destinationWallet: PublicKey  // where to send claimed tokens
}

export interface BuiltClaimTx {
  serializedTx: string          // base64
  stealthPubkey: PublicKey
  expectedAmount: bigint
  expectedMint: PublicKey | null  // null for SOL
}

export async function buildClaimTx(ctx: ClaimContext): Promise<BuiltClaimTx>
```

### Flow

```
User: "claim payment 3QCoHcJ..."
   │
   ▼
executeClaim (refactored)
   │
   ├─ validate inputs (existing)
   ├─ fetch deposit tx via connection.getTransaction(depositTxSignature)
   ├─ parse announcement PDA from tx → { ephemeralPubkey, stealthPubkey, commitment, encryptedMeta }
   ├─ ECDH-derive stealth privkey: deriveStealthPrivateKey({ ephemeralPubkey, viewingPrivKey, spendingPrivKey })
   ├─ assert derived pubkey === announced stealthPubkey (sanity check; catches wrong keys)
   ├─ decrypt encryptedMeta to get amount + token mint
   ├─ build claim_transfer instruction (sip_privacy program)
   ├─ build transaction with recent blockhash + fee payer = destinationWallet
   ├─ partially sign with stealth privkey (signer needed for claim_transfer)
   ├─ serialize tx → base64
   │
   ▼
return {
  action: 'claim',
  status: 'awaiting_signature',
  serializedTx: <base64>,
  ...
}
   │
   ▼
chatStream's tool-signing wrapper picks up status === 'awaiting_signature'
   │
   ▼
emit `tool_signing_required` SSE → frontend SignTxCard appears
   │
   ▼
User clicks Sign → wallet adds fee-payer signature → broadcasts → returns claim_tx_signature
   │
   ▼
POST /api/tool-signing/:flagId/confirm { signature: claim_tx_signature }
   │
   ▼ (Phase 1, today)
resolvePendingSigning → tool returns { signature: claim_tx_signature, status: 'confirmed' }
   │
   ▼
growth-hook → emit sipher_private_claim_completed with data.tx_signature = claim_tx_signature
```

### Signer accounts

The `claim_transfer` instruction requires TWO signers:
1. **Stealth keypair** — proves recipient identity (server has the privkey from ECDH; signs server-side BEFORE returning to SignTxCard)
2. **Fee payer** — the destination wallet (signs client-side via SignTxCard)

Server's role is to assemble a partially-signed transaction. The stealth keypair is ephemeral — derived in memory, used to sign, then dropped. Never persisted.

This is acceptable because the stealth privkey is uniquely tied to the destination wallet's spending key — leaking it doesn't compromise anything beyond this single claim. (The viewing key, however, is sensitive — see security section.)

### Growth-hook update

Current `extractTxSignature` reads `r.signature || r.txSignature`. For Phase 1 claim, the result's `txSignature` is the DEPOSIT tx; this is wrong.

Phase 2 should return the CLAIM tx signature in the standard `signature` field (matching send/swap). Rename `txSignature` in `ClaimToolResult` → `depositTxSignature` for clarity; add `signature?: string` (the claim tx, populated after sign-and-confirm by the signing-callback path).

The growth-hook will pick up `r.signature` (claim tx), not `r.txSignature` (deposit). Existing extraction priority order helps the migration.

### Viewing key handling

**The viewing key is sensitive.** It allows the holder to scan all of the recipient's incoming payments. Sending it to the server is a real trust delegation.

Today's Phase 1 already accepts viewing key in the tool input — the threat surface exists. Phase 2 doesn't expand it but should be explicit:

- The viewing key MUST be transmitted over TLS only (sipher.sip-protocol.org is HTTPS; OK).
- The viewing key MUST NOT be logged at any verbosity.
- The viewing key MUST NOT be persisted — kept in tool-call-scoped memory and zeroized after the claim is built (best-effort; JS GC limits guarantees).
- A future option: a "claim co-signer" mode where the user runs the ECDH derivation locally, then sends only the resulting stealth privkey to the server (still a leak but smaller). Out of scope.

**Recommend:** add a privacy warning callout in the README + the chat tool description that running claim shares the viewing key with the server, distinct from send/swap which don't.

---

## Implementation

### Step 1 — ECDH helper (`packages/agent/src/tools/claim-helpers.ts`)

Centralizes the cryptographic derivation. Uses `@sip-protocol/sdk` primitives. Pure function — no IO, easily unit-tested with known fixture vectors.

### Step 2 — Announcement parser

`parseAnnouncementFromTx(connection, depositTxSignature)`:
1. `connection.getTransaction(depositTxSignature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })`
2. Iterate instructions, find the one targeting `sip_privacy` program
3. Decode the instruction data per the IDL → `{ ephemeralPubkey, stealthPubkey, commitment, encryptedMeta }`
4. Return parsed announcement

### Step 3 — Claim tx builder

`buildClaimTx(ctx)`:
1. Parse announcement
2. ECDH-derive stealth privkey
3. Sanity check: derived pubkey === announced stealthPubkey
4. Decrypt `encryptedMeta` (XChaCha20-Poly1305 with viewing-key-derived key per SDK convention)
5. Construct `claim_transfer` instruction
6. Build `Transaction`, set recent blockhash + fee payer
7. Partially sign with stealth keypair
8. Serialize → base64

### Step 4 — Refactor `executeClaim`

Replace the Phase 1 placeholder. New signature:
```ts
export interface ClaimToolResult {
  action: 'claim'
  status: 'awaiting_signature' | 'confirmed' | 'failed'
  depositTxSignature: string
  signature?: string            // populated after sign+confirm
  serializedTx: string          // no longer null
  expectedAmount: string        // human-readable
  expectedMint: string | null   // null for SOL
  destinationWallet: string
  message: string
}
```

`executeClaim` returns `awaiting_signature` with `serializedTx` populated. The tool-signing wrapper (already used by send/swap) handles the rest.

### Step 5 — Wire into chatStream's tool-signing wrapper

Today's wrapper (in agent.ts) detects send/swap by tool name. Extend to include claim. The wrapper emits `tool_signing_required`, awaits the promise-gate, returns `{ signature, status: 'confirmed' }` after the client posts confirm.

### Step 6 — Growth-hook adjustment

Add `signature` extraction priority (already present in `extractTxSignature`). Verify by inspection that the result's `signature` field is preferred over `txSignature`.

### Step 7 — Tests (heavy)

Discussed below.

### Step 8 — README updates

- `packages/agent/src/integrations/torque/README.md` table: update claim row "Partial → Yes (since #<PR>)"
- New section in main repo README: privacy implication of sending viewing key

---

## Test plan

### Unit tests for `claim-helpers.ts`

- [ ] `parseAnnouncementFromTx` — happy path with known fixture (deposit tx from devnet)
- [ ] `parseAnnouncementFromTx` — tx not found → throws `AnnouncementNotFoundError`
- [ ] `parseAnnouncementFromTx` — tx exists but no sip_privacy instruction → throws `NoAnnouncementError`
- [ ] `deriveStealthPrivateKey` round-trip: deposit fixture → derived privkey → derived pubkey matches announcement
- [ ] `deriveStealthPrivateKey` with wrong viewing key → derived pubkey DOES NOT MATCH announcement (sanity)
- [ ] `buildClaimTx` — happy path: builds valid tx with correct accounts, correctly signed by stealth keypair

### Unit tests for `executeClaim`

- [ ] Existing validation tests still pass (txSignature required, viewing/spending keys required)
- [ ] Returns `serializedTx` (no longer null)
- [ ] Returns `expectedAmount` matching decrypted metadata
- [ ] Returns `destinationWallet` from input OR derived from spending pubkey
- [ ] Wrong viewing key for the deposit → throws actionable error ("stealth address mismatch; check viewing key")
- [ ] Already-claimed deposit (rare race) → returns useful error from chain via simulate, not server crash

### Integration tests

- [ ] Devnet end-to-end: scan finds payment → claim → SignTxCard → user signs → claim tx confirms → Torque event fires with CLAIM tx signature
- [ ] Mock SignTxCard signer to avoid wallet UI in tests
- [ ] Use `SIP_TEST_DEPOSIT_TX` env var to drive the fixture

### Growth-hook tests (extend existing)

- [ ] Add: claim emission uses `result.signature` (claim tx), not `result.txSignature` (deposit)
- [ ] Add: claim emission skipped if status === 'awaiting_signature' (no signature yet)

### Security tests

- [ ] Viewing key never appears in any log line (grep test on captured log output)
- [ ] Server-allocated stealth keypair zeroized after tx serialization (best-effort assertion on the keypair buffer being filled with zeros — JS-engine-specific, may be removed if unreliable)

### Regression

- [ ] Full agent suite: `pnpm --filter @sipher/agent test`
- [ ] Existing claim tool tests still pass

---

## Risks

**Viewing key exposure surface.** Today's Phase 1 already accepts it; this spec doesn't expand the threat. But Phase 2 making claim real means usage will increase, scrutiny will increase. Mitigate with README disclosure + audit-log redaction guarantees.

**Stealth keypair handling in JS.** JavaScript doesn't offer guaranteed memory zeroization. Best effort with `Uint8Array.fill(0)` is acceptable but not bulletproof. Mitigation: limit the lifetime to a single function scope; never serialize to logs or persistent storage.

**Announcement parse fragility.** If sip_privacy program adds new instruction variants, the parser may misclassify. Mitigation: version the IDL parsing, fail loud on unknown variants, never silent-default.

**Replay protection.** Once a claim tx is built, what stops two sequential `claim` invocations from building two valid claim txs? The on-chain program rejects double claims (the announcement PDA is consumed), but the server can race: build tx A, then build tx B referencing same deposit, both fee-payer-signed; one confirms, one fails on-chain. Cosmetic issue. Mitigation: short-lived server-side "in-flight claim" cache, dedupe by `(depositTxSignature, destinationWallet)`. Out-of-scope mitigation; track as follow-up.

**Recent blockhash freshness.** Building a tx with a blockhash that expires before the user signs (5-min TTL) → broadcast fails. Mitigation: refetch blockhash if the SignTxCard sits idle > 60s and the user clicks Sign late. Adds complexity; alternatively, accept that occasional expiry is recoverable via "request again" UX.

**Privacy degradation if viewing key leaked from server.** Defense-in-depth measures (TLS-only, no logs, memory hygiene) reduce but don't eliminate. The honest framing: server-assisted claim is a trust delegation. Out-of-scope long-term alternative: client-side claim (no server involvement) — needs a richer frontend.

**Torque attribution change.** Today's emission fires on the deposit tx signature. After Phase 2, it fires on the claim tx signature. This is the correct behavior but breaks any downstream consumer that joined on deposit-tx-sig. Verify with RECTOR before rollout that no live Incentive joins on the old key.

---

## Migration / rollout

**Phase 1 deprecation.** Existing Phase 1 placeholder returns `serializedTx: null`. Frontend never produced a SignTxCard for claim. After Phase 2 lands, claim begins producing real SignTxCards. No data migration; the placeholder didn't persist anything.

**Coordinated env config.** Ensure `SIPHER_HELIUS_API_KEY` (mainnet RPC) is configured on VPS — required for both ECDH announcement lookup and claim tx broadcast. Already configured per current send/swap path.

**No flag gate.** This is a correctness fix; the prior behavior was a known stub. Roll forward.

**README + chat tool description update** — surface the viewing-key-sharing disclosure prominently.

**Backward compat for Torque event payload.** `data.tx_signature` field stays a string. Only the meaning shifts (deposit-tx → claim-tx). Document in the Torque integration README's "Tool emission coverage" table.

---

## Follow-ups (out of scope)

- SPL token claim path (Phase 1 also doesn't cover this — `claim_token_transfer` instruction)
- Client-side ECDH alternative (no viewing key sent to server)
- In-flight claim deduplication cache
- Replay protection in growth-hook (also tracked in [[2026-05-15-server-side-sig-verification-design]])
- Ethereum claim path (depends on contracts/sip-ethereum claim instruction)
- Verification of the claim tx using the same RPC verifier from [[2026-05-15-server-side-sig-verification-design]] — this should compose cleanly

---

## Amendment — SDK reality check (2026-05-15, frontier_sip_13)

**Discovered during implementation scoping:** the original spec above (Implementation Steps 1-7) assumed the server would build claim_transfer from scratch — own announcement parser, own ECDH derivation, own partial-sign + serialize for client-side fee-payer signing. **This is more work than necessary.** `@sip-protocol/sdk@^0.7.4` already exposes the complete primitive surface:

```ts
// All exported from @sip-protocol/sdk
declare function parseAnnouncement(memo: string): SolanaAnnouncement | null
declare function scanForPayments(params: SolanaScanParams): Promise<SolanaScanResult[]>
declare function claimStealthPayment(params: SolanaClaimParams): Promise<SolanaClaimResult>
declare function deriveStealthPrivateKey(...): ...
declare function deriveSolanaStealthKeys(...): ...
```

`claimStealthPayment(params: SolanaClaimParams)` accepts the user's `viewingPrivateKey` + `spendingPrivateKey` and **internally derives the stealth privkey + builds claim_transfer + signs + broadcasts**, returning `{ txSignature, destinationAddress, ... }`. Steps 1, 2, and 3 of the original Implementation section are entirely subsumed by this single call.

### What changes

The original spec's flow diagram (lines 73-115) hinges on a tool-signing wrapper / SignTxCard round-trip where the user signs as the fee payer. **That UX does not match the SDK's broadcast-internal claim primitive.** Server-side, the stealth address itself signs as fee payer (using the stealth privkey derived from the user's viewing+spending keys). The destination wallet does not need to sign — it's only the recipient of the claim transfer.

This collapses the "client signing UX" assumption. There are two coherent paths from here:

### Path A — SDK-driven claim (recommended for first ship)

**One-shot server execution. No SignTxCard. No tool-signing wrapper extension.**

```
User invokes `claim` tool with depositTxSignature + viewingKey + spendingKey + destination
   │
   ▼
executeClaim
   ├─ validate inputs (existing)
   ├─ fetch deposit tx via getTransaction
   ├─ extract announcement via parseAnnouncement (sip_privacy memo)
   ├─ resolve stealthAddress (from scanForPayments OR from announcement decode)
   ├─ resolve mint (from the deposit's token transfer instruction)
   │
   ▼
claimStealthPayment({ connection, stealthAddress, ephemeralPublicKey, viewingPrivateKey, spendingPrivateKey, destinationAddress, mint })
   │ (SDK derives stealth privkey + builds claim_transfer + signs + broadcasts)
   │
   ▼
return { action: 'claim', status: 'confirmed', signature: claim_tx_sig, depositTxSignature, destinationWallet, message, ... }
   │
   ▼
growth-hook → emits sipher_private_claim_completed with data.tx_signature = claim_tx_sig
```

**Trade-offs:**
- ✅ Minimum new code — the SDK is the implementation
- ✅ Honest Torque attribution from day one (claim-tx-sig, not deposit-tx-sig)
- ✅ Closes the Phase 1 stub correctness gap
- ❌ Loses explicit user consent at sign-time — calling `claim` is the consent
- ❌ Loses the SignTxCard visual confirmation that send/swap have
- ❌ Server can't pause-and-confirm pending claims (the SDK is one-shot)

The user-consent loss is bounded: the chat-tool invocation IS the consent. Compare to how SDK CLI users invoke `claimStealthPayment` directly — they consent by calling the function. The chat-driven flow is equivalent.

### Path B — Fork SDK to separate build + broadcast

**Match the original spec's tool-signing UX. Replicate `claimStealthPayment`'s internals (or call lower-level SDK primitives) so build and broadcast are separable.**

```
executeClaim builds the claim tx (no broadcast) → returns serializedTx + status: awaiting_signature
   │
   ▼ tool-signing wrapper emits SSE → SignTxCard appears
   │
User confirms in SignTxCard → server broadcasts (still using SDK or raw RPC)
```

**Trade-offs:**
- ✅ Explicit user consent moment (SignTxCard)
- ✅ Symmetric with send/swap UX
- ❌ Must duplicate or fork SDK internals — fragile, maintenance burden
- ❌ The stealth keypair signing happens server-side regardless of which path; SignTxCard is cosmetic security theater (the user can't actually refuse — they already passed the keys)
- ❌ Larger implementation surface (4-6 days remains true)

The "security theater" point is real. In Path A, the user's consent is the tool invocation. In Path B, the user's consent is the SignTxCard click — but the underlying signing authority was already delegated (the viewing+spending keys are server-side). The SignTxCard doesn't gate anything cryptographically.

### Revised recommendation

**Ship Path A.** Defer Path B's SignTxCard surface as a follow-up if RECTOR decides the consent ceremony is worth the build cost. The Phase 1 stub is shipping incorrect Torque events today; Path A fixes that in a clean, small PR.

### Revised Implementation steps (Path A)

1. **Locate the announcement memo in the deposit tx** — `connection.getTransaction(depositTxSig)` → find the SPL memo instruction → call SDK's `parseAnnouncement(memoString)` → get `{ ephemeralPublicKey, viewTag, stealthAddress? }`
2. **Resolve the stealth address** — if absent from announcement, derive from `(ephemeralPublicKey + viewingPrivateKey + spendingPublicKey)` via SDK's `generateSolanaStealthAddress` OR use `scanForPayments` to locate the matching incoming entry
3. **Resolve the mint** — inspect the deposit tx's token transfer instruction (or sentinel-style account parse)
4. **Call `claimStealthPayment`** — pass viewing+spending privkeys + the resolved stealth address + ephemeral pubkey + mint + destination
5. **Return the result** — `{ status: 'confirmed', signature: result.txSignature, ... }`. The growth-hook extracts `signature` (already supported, lines 101-107 of growth-hook.ts).

### Revised test plan (Path A)

- Unit: executeClaim happy path with mocked SDK call (3 tests)
- Unit: input validation (existing tests should still pass)
- Unit: wrong viewing key → SDK throws → executeClaim re-throws as actionable error
- Unit: deposit tx not found → throws actionable error
- Unit: announcement parse fails → throws actionable error
- Growth-hook: claim emission carries `signature` field (claim-tx-sig), not `txSignature` (deposit-tx-sig). One new test.
- Skip: the entire "ECDH derive in helpers module" test set (lines 220-228 of original spec) — SDK is the implementation.

### Revised viewing-key trust posture

Same trust delegation as Path B (the user shares viewing+spending keys with the server). The fact that the SDK does the broadcast doesn't change the trust surface — the keys are already on the server regardless. The README disclosure section (line 146) still applies verbatim.

### Revised migration / rollout

Path A is a CORRECTNESS FIX (replaces stub with working flow). The chat tool's contract changes only in the return shape — `status: 'confirmed'` instead of `'awaiting_signature'`, plus a real `signature` field. No frontend changes required: today's frontend treats the claim result as plain text in the assistant message, which still works.

### Risks (Path A specific)

**Stealth address resolution.** If `scanForPayments` returns multiple matches or zero matches for the given deposit tx, the code must handle gracefully. Recommend: pass `fromSlot: depositTxSlot - 1, toSlot: depositTxSlot + 1` to narrow scan scope.

**SDK version drift.** Current dep is `@sip-protocol/sdk@^0.7.4`. The primitives used here have been stable since at least 0.5.x but verify before assuming. Pin to a known-good version if needed.

**SDK error surfaces.** `claimStealthPayment` throws on various error conditions (RPC failure, signature mismatch, insufficient lamports). Wrap with try/catch in executeClaim and map to actionable error messages.

**No client consent moment.** Documented above. Acceptable for the chat-driven invocation pattern. If a future deployment requires explicit confirmation (e.g. high-value claims), revisit Path B.

---

This amendment supersedes the original Implementation (Step 1-3) and Test plan sections for the **default first-ship choice**. The original sections remain in this document as the Path B reference if the consent-ceremony UX is later prioritized.
