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
