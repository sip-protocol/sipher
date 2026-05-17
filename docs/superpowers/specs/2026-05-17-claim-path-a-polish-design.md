# Claim Path A Polish — Auto-Derive `destinationWallet` + Human-Readable Amount — Design

**Date:** 2026-05-17
**Session:** frontier_sip_14 (continued, post-merge of PR #281)
**Status:** Proposed — awaiting RECTOR review
**Predecessor:**
  - Path A claim flow: `packages/agent/src/tools/claim.ts` (executeClaim) + `packages/agent/src/tools/claim-helpers.ts` (resolveStealthContext) — shipped via [sipher#281](https://github.com/sip-protocol/sipher/pull/281), merged at `4501045`
  - Path A scope-limits called out in PR review: (1) `deriveDestinationFromSpending` was deleted as a placeholder throw; `destinationWallet` made required to close the schema-vs-runtime gap. (2) Chat message format `${amount} units` is opaque — user can't tell if it's 1 USDC or 1 token-with-9-decimals.
  - Tracking issue: [sipher#286](https://github.com/sip-protocol/sipher/issues/286)
**Scope:** Two independent polish features for the claim tool, shipped together: (1) auto-derive the destination wallet from the user's spending pubkey when `destinationWallet` is omitted from tool input, removing the Path A scope-limit; (2) format the SDK's `bigint` claim amount as a human-readable string (`"1.5 SOL"`, `"1 USDC"`, `"1 EPjF...Dt1v"` for unknown SPL mints) in the chat result message. Note: `fromBaseUnits` in `@sipher/sdk` returns `"1"` not `"1.0"` for whole-number amounts (trailing zeros are stripped); test assertions match that exact format.
**Out of scope:** On-chain mint decimals lookup for unknown mints (uses SDK's `getTokenDecimals` default of 9); stealth keypair memory zeroization (still tracked under Path A's general scope notes); SDK-level token symbol export.
**Estimated work-time:** 1-1.5 hour, single PR, ~6 net new tests.

---

## Why this build

**Auto-derive (Part 1).** Path A's `executeClaim` requires `destinationWallet` as an explicit input today. This was the right move to close the schema-vs-runtime gap when the original `deriveDestinationFromSpending` was a throwing placeholder. But the spending privkey contains everything needed to derive the corresponding ed25519 pubkey (which IS the user's main wallet for sipher's stealth payment model), so the auto-derive is straightforward and removes a required-input that the user-facing chat agent has to thread through. After this change, an LLM agent invoking `claim` can omit `destinationWallet` and the result will land at the user's main wallet automatically.

**Human-readable amount (Part 2).** Current chat message: `Claimed payment X... → claim tx Y... (1000000 units to Z...)`. The user has no idea if `1000000` is 1 USDC, 1 millionth of SOL, or 1 of some 9-decimal SPL token. Replacing `units` with the proper symbol + decimal-adjusted amount gives the user actionable feedback at a glance.

**Why now.** Both polish items improve the Frontier demo (2026-05-27) — auto-derive simplifies the agent's tool input contract; human-readable amount makes the demo's claim cell read as `"Claimed... 1.0 USDC to FGSk..."` instead of `"Claimed... 1000000 units to FGSk..."`. Together they finish the claim UX so it doesn't feel like a "Path A initial scope" placeholder.

---

## Architecture

### New helpers in `packages/agent/src/tools/claim-helpers.ts`

Both helpers are pure functions — no IO, no state. Testable in isolation.

```ts
import { ed25519 } from '@noble/curves/ed25519'
import { PublicKey } from '@solana/web3.js'
import { WSOL_MINT, USDC_MINT, USDT_MINT, getTokenDecimals, fromBaseUnits } from '@sipher/sdk'

/**
 * Derive the base58 ed25519 pubkey corresponding to a hex-encoded spending
 * private key. The spending key in sipher's stealth model corresponds 1:1
 * with the user's main Solana wallet — this pubkey is the natural default
 * destination for claimed funds.
 *
 * @throws if `spendingPrivateKey` is not valid hex (with or without 0x prefix)
 */
export function deriveDestinationFromSpending(spendingPrivateKey: string): string

/**
 * Format an SDK-returned base-units amount as a human-readable token string.
 * Returns `"<amount> <symbol>"` for known mints (SOL/USDC/USDT) or
 * `"<amount> <mint_prefix>...<mint_suffix>"` for unknown SPL mints.
 *
 * `<amount>` format: matches `@sipher/sdk`'s `fromBaseUnits` — `"1"` for
 * whole numbers (no trailing `.0`), `"1.5"` / `"0.000001"` for fractional.
 *
 * Token decimals come from `@sipher/sdk`'s `getTokenDecimals` (returns 9
 * for unknown mints — accurate for most SPL but imprecise for low-decimal
 * exotics; out of scope for this polish).
 */
export function formatClaimAmount(amountBaseUnits: bigint, mintBase58: string): string
```

### `executeClaim` in `packages/agent/src/tools/claim.ts`

Three coordinated edits:

```ts
// 1. ClaimParams.destinationWallet — make optional again
export interface ClaimParams {
  txSignature: string
  viewingKey: string
  spendingKey: string
  destinationWallet?: string   // ← was required in Path A; now optional with auto-derive
  mint?: string
}

// 2. Anthropic schema — restore "Defaults to the spending pubkey" + drop from required
//    `required: ['txSignature', 'viewingKey', 'spendingKey']` (no destinationWallet)
//    description: 'Wallet address (base58) to receive claimed tokens. Defaults to the spending pubkey.'

// 3. executeClaim body — auto-derive when omitted
const destinationAddress =
  params.destinationWallet ?? deriveDestinationFromSpending(params.spendingKey)

// 4. Result message — use formatClaimAmount instead of `${amount} units`
message: `Claimed payment ${params.txSignature.slice(0, 12)}... → claim tx ${sdkResult.txSignature.slice(0, 12)}... ` +
  `(${formatClaimAmount(sdkResult.amount, mintBase58)} to ${sdkResult.destinationAddress.slice(0, 8)}...)`,
```

### Token symbol mapping (inline in `formatClaimAmount`)

```ts
function tokenSymbol(mintBase58: string): string {
  if (mintBase58 === WSOL_MINT.toBase58()) return 'SOL'    // UX: users think SOL, not WSOL
  if (mintBase58 === USDC_MINT.toBase58()) return 'USDC'
  if (mintBase58 === USDT_MINT.toBase58()) return 'USDT'
  return `${mintBase58.slice(0, 4)}...${mintBase58.slice(-4)}`
}
```

---

## Implementation

### Step 1 — Add `deriveDestinationFromSpending` helper + tests (RED → GREEN)

`@noble/curves/ed25519` is already a transitive dep via `@sip-protocol/sdk` and imported directly in `packages/sdk/src/privacy.ts:11`. `Buffer` is already imported in claim-helpers.ts from Path A; reuse for hex → bytes conversion:

```ts
const stripped = spendingPrivateKey.startsWith('0x') ? spendingPrivateKey.slice(2) : spendingPrivateKey
if (!/^[0-9a-fA-F]+$/.test(stripped) || stripped.length !== 64) {
  throw new Error('Spending key must be 32-byte hex (64 chars, with or without 0x prefix)')
}
const privKeyBytes = Buffer.from(stripped, 'hex')
const pubKeyBytes = ed25519.getPublicKey(privKeyBytes)
return new PublicKey(pubKeyBytes).toBase58()
```

Test fixture: use `Keypair.generate()` from `@solana/web3.js` to produce a (privkey-bytes, pubkey-base58) pair. Convert privkey bytes → hex, pass to helper, assert pubkey matches. Solana keypairs are 64-byte (32-byte private + 32-byte public); use `keypair.secretKey.slice(0, 32)` for the seed bytes that match ed25519's input.

### Step 2 — Add `formatClaimAmount` helper + tests (RED → GREEN)

Use `@sipher/sdk`'s `getTokenDecimals(mint)` + `fromBaseUnits(amount, decimals)`:

```ts
const decimals = getTokenDecimals(new PublicKey(mintBase58))
const human = fromBaseUnits(amountBaseUnits, decimals)
const symbol = tokenSymbol(mintBase58)
return `${human} ${symbol}`
```

Tests cover: SOL (1.5e9 → "1.5 SOL"), USDC (1e6 → "1.0 USDC"), unknown mint (1000 + arbitrary mint → "1000 EPjF...Dt1v").

### Step 3 — Restore `ClaimParams.destinationWallet` to optional + schema update + wire helper

Three coordinated edits to `claim.ts` (described above). Single commit.

### Step 4 — Update `claim.test.ts` to cover auto-derive + human-readable message

- Update the 4 `executeClaim — input validation (regression)` tests to NOT pass `destinationWallet` (no longer required; tests still verify the validation errors fire on missing required inputs).
- New test: `executeClaim — happy path` block adds 1 test exercising the auto-derive path (omits `destinationWallet`, verifies result's `destinationWallet` matches the helper-derived value).
- Update the existing `'truncates deposit signature in message'` test to also check `/1\.0 USDC|1\.5 SOL/` appears in the message (proves human-readable format).

### Step 5 — Verify `consolidate.ts` still passes `destinationWallet`

Already passes per the post-Path-A fix at commit `3b937ef`. Re-verify on the rebased branch — should be no-op.

---

## Test plan

### Unit tests for new helpers (`packages/agent/tests/tools/claim-helpers.test.ts`)

- [ ] `deriveDestinationFromSpending` happy path: known hex privkey from `Keypair.generate()` → matches `Keypair.publicKey.toBase58()`
- [ ] `deriveDestinationFromSpending` rejects non-hex input via `hexToBytes` throw
- [ ] `formatClaimAmount` SOL: `1_500_000_000n` + `WSOL_MINT.toBase58()` → `"1.5 SOL"` (not `"1.5 WSOL"`)
- [ ] `formatClaimAmount` USDC: `1_000_000n` + `USDC_MINT.toBase58()` → `"1 USDC"` (whole number, no trailing `.0` — matches `fromBaseUnits`)
- [ ] `formatClaimAmount` unknown mint: `1_000_000_000n` + arbitrary base58 mint → `"1 XXXX...YYYY"` (default 9 decimals from SDK, prefix-suffix format for unknown)

### `claim.test.ts` updates

- [ ] Existing 4 input-validation tests no longer pass `destinationWallet` (cleanup — they don't reach the auto-derive path anyway)
- [ ] New test: `executeClaim` without `destinationWallet` derives + uses auto-derived address; SDK call receives the derived `destinationAddress`
- [ ] Existing message-truncation test extends to assert `/1 USDC|1\.5 SOL/` in message (matches mocked SDK return of `1_000_000n` USDC OR adjust mock to return SOL amount per existing test setup)

### Tool definition test update

- [ ] `'declares required input fields'` array updated back to `['txSignature', 'viewingKey', 'spendingKey']` (no destinationWallet)
- [ ] `'declares destinationWallet and mint properties'` test still passes (both still in `properties`)

### Regression

- [ ] Full agent suite: `pnpm test -- --run` — was 1612 at PR #281 merge, expect ~1618 (+6 net new tests)
- [ ] Workspace typecheck clean

---

## Risks

**Imprecise decimals for unknown mints.** SDK's `getTokenDecimals` returns 9 for any mint not in {WSOL, USDC, USDT}. If a user claims an exotic 4-decimal token, the message would display `100.0001` instead of `10.00010000`. Cosmetic, not a security issue. Documented in helper JSDoc. Future enhancement: on-chain decimals fetch (in scope of issue #286 follow-up).

**`@noble/curves/ed25519` availability.** Already imported in `packages/sdk/src/privacy.ts` so resolution is guaranteed. Sipher's `pnpm-lock.yaml` pins the version via `@sip-protocol/sdk` transitively.

**Schema-runtime alignment regression.** This change re-opens the optional-vs-required dance Path A closed. Mitigation: this time the runtime DOES handle the absent case (via auto-derive), so the schema and runtime are in lockstep. Verified via the new happy-path test.

**Existing `consolidate.ts` call site.** Currently passes `destinationWallet: params.wallet` (after PR #281's `3b937ef` fix). Optional ≠ rejected, so this keeps working. No change needed in consolidate.ts.

**LLM tool-input drift.** Anthropic LLM may have already learned the post-Path-A schema (destinationWallet required). Updating to optional doesn't break — the LLM can still provide it. But it may continue providing it out of habit until next system-prompt refresh. Acceptable — both modes work.

---

## Migration / rollout

**Single PR, no env changes.** Roll forward — no feature flag, no kill switch.

**Backward compat:** any current caller passing `destinationWallet` continues to work (optional ≠ rejected). The schema relaxation widens the accept surface; nothing narrows.

**Deploy:** PR merges → main triggers `Test, Build & Deploy` workflow → Docker build + GHCR push + VPS ssh deploy → health check on port 5006. Same flow as PR #281.

**Verification post-deploy:** Trigger a claim from sipher chat. With `destinationWallet` omitted, verify the result lands at the user's main wallet (the spending pubkey). With known mints, verify the message displays `"X.Y SOL"` or `"X.Y USDC"`.

---

## Follow-ups (out of scope for this spec)

- On-chain mint decimals lookup for unknown mints (could fetch + cache by mint string)
- Extract `normalizeKey` (and now `deriveDestinationFromSpending`) to a shared utility module — tracked in [sipher#287](https://github.com/sip-protocol/sipher/issues/287)
- Export `getTokenSymbol(mint)` from `@sipher/sdk` for reuse by send/swap chat messages (currently inline in claim only)
- Stealth keypair memory zeroization (cross-cutting, not claim-specific)
