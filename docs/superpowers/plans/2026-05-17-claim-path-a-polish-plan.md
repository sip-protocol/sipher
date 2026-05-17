# Claim Path A Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two small claim-tool polish features for sipher (issue #286): (1) auto-derive `destinationWallet` from the user's spending pubkey when omitted, removing the Path A scope-limit that made it required; (2) format the SDK's `bigint` claim amount as a human-readable string (`"1.5 SOL"`, `"1 USDC"`, `"1 EPjF...Dt1v"` for unknown SPL mints) in the chat result message.

**Architecture:** Two new pure helpers in the existing `packages/agent/src/tools/claim-helpers.ts` (alongside `resolveStealthContext` from PR #281). `deriveDestinationFromSpending(hex)` uses `@noble/curves/ed25519.getPublicKey` (already imported in `packages/sdk/src/privacy.ts:11`) → `new PublicKey(bytes).toBase58()`. `formatClaimAmount(bigint, mintBase58)` uses `@sipher/sdk`'s `getTokenDecimals` + `fromBaseUnits` (existing exports) plus an inline 3-mint symbol lookup with prefix-suffix fallback. `executeClaim` then makes `destinationWallet` optional again, drops it from the Anthropic `required` array, restores the "Defaults to the spending pubkey" description, and uses both helpers in its body.

**Tech Stack:** TypeScript (strict, NodeNext ESM with .js suffixes), `@noble/curves/ed25519` (transitive dep via `@sip-protocol/sdk`), `@sipher/sdk` (workspace) for `WSOL_MINT`/`USDC_MINT`/`USDT_MINT`/`getTokenDecimals`/`fromBaseUnits`, `@solana/web3.js` (`PublicKey`, `Keypair` for test fixtures), `node:buffer` (already imported in claim-helpers.ts), vitest 3.x.

**Spec reference:** `docs/superpowers/specs/2026-05-17-claim-path-a-polish-design.md` (committed at `c43ad7b` on branch `feat/issue-286-claim-path-a-polish`). Closes issue #286.

---

## File Structure

**Modify:**
- `packages/agent/src/tools/claim-helpers.ts` — append two new exported helpers (`deriveDestinationFromSpending`, `formatClaimAmount`) plus an inline `tokenSymbol` private helper. Net +50 lines.
- `packages/agent/tests/tools/claim-helpers.test.ts` — append 5 new tests covering the two helpers (2 for derive, 3 for format). Net +60 lines.
- `packages/agent/src/tools/claim.ts` — three coordinated edits: `ClaimParams.destinationWallet` becomes optional; `claimTool.input_schema.required` drops `'destinationWallet'`; description restored to "Defaults to the spending pubkey"; `executeClaim` body auto-derives on omission + uses `formatClaimAmount` in the result message. Net ~10 line changes.
- `packages/agent/tests/claim.test.ts` — update 4 input-validation tests to drop `destinationWallet` (no longer required); update tool-definition `'declares required input fields'` assertion; add 1 new test exercising the auto-derive happy path; update the message-truncation test to also assert on human-readable amount format. Net +30 lines.

**Out of scope (acknowledge):**
- On-chain mint decimals lookup for unknown mints (uses SDK's default of 9)
- Stealth keypair memory zeroization
- Extracting `normalizeKey` to a shared utility module — tracked in issue #287
- Token-symbol SDK export (`getTokenSymbol(mint)` for reuse by send/swap) — inline in claim only

---

## Pre-flight check (do this once before Task 1)

Verify the workspace is clean and on the spec branch:

```bash
cd /Users/rector/local-dev/sipher
git fetch origin
git checkout feat/issue-286-claim-path-a-polish
git log --oneline -2
# Expected: HEAD is c43ad7b (spec commit), parent is 5fe9b46 (main merge of PR #276)
cd packages/agent && pnpm exec tsc --noEmit
cd packages/agent && pnpm test -- --run 2>&1 | tail -5
```

Expected: typecheck clean, 1612 tests passing baseline.

If `packages/sdk/dist/` doesn't exist locally (rare — happens on a fresh checkout), build it first:

```bash
cd /Users/rector/local-dev/sipher && pnpm -r --filter @sipher/sdk run build
```

---

## Task 1: Add `deriveDestinationFromSpending` helper (RED → GREEN)

Derives the base58 ed25519 pubkey corresponding to a hex-encoded spending private key. Pure function — accepts hex string, returns base58 string. Throws on invalid hex.

**Files:**
- Modify: `packages/agent/src/tools/claim-helpers.ts` (append exports)
- Modify: `packages/agent/tests/tools/claim-helpers.test.ts` (append tests)

- [ ] **Step 1: Write the failing tests**

Append to `packages/agent/tests/tools/claim-helpers.test.ts` (at the END of the file, after the existing describes):

```ts
import { Keypair } from '@solana/web3.js'
import { deriveDestinationFromSpending } from '../../src/tools/claim-helpers.js'

describe('deriveDestinationFromSpending', () => {
  it('derives the matching base58 ed25519 pubkey from a hex spending privkey', () => {
    const kp = Keypair.generate()
    // Solana keypairs are 64 bytes (32-byte seed + 32-byte pubkey); ed25519 takes the 32-byte seed.
    const seedHex = Buffer.from(kp.secretKey.slice(0, 32)).toString('hex')

    expect(deriveDestinationFromSpending(seedHex)).toBe(kp.publicKey.toBase58())
  })

  it('accepts hex with 0x prefix', () => {
    const kp = Keypair.generate()
    const seedHex = '0x' + Buffer.from(kp.secretKey.slice(0, 32)).toString('hex')

    expect(deriveDestinationFromSpending(seedHex)).toBe(kp.publicKey.toBase58())
  })

  it('throws on non-hex input', () => {
    expect(() => deriveDestinationFromSpending('this-is-not-hex')).toThrow(
      /spending key must be 32-byte hex/i,
    )
  })

  it('throws on wrong-length hex (not 32 bytes)', () => {
    expect(() => deriveDestinationFromSpending('ab'.repeat(16))).toThrow(
      /spending key must be 32-byte hex/i,
    )
  })
})
```

Note: the `Keypair` and `deriveDestinationFromSpending` imports go at the top of the file alongside the existing imports. Check the existing top-of-file imports section (lines 1-5 of `claim-helpers.test.ts` after Task 1 of PR #281) and add `Keypair` to the `@solana/web3.js` import and add `deriveDestinationFromSpending` to the `claim-helpers.js` import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts -t "deriveDestinationFromSpending"`

Expected: FAIL with `deriveDestinationFromSpending is not exported` or similar import error.

- [ ] **Step 3: Add the implementation**

Append to `packages/agent/src/tools/claim-helpers.ts` (at the end of the file, after the existing `parseWithdrawEventFromLogs` function):

```ts
import { ed25519 } from '@noble/curves/ed25519'

/**
 * Derive the base58 ed25519 pubkey corresponding to a hex-encoded spending
 * private key. The spending key in sipher's stealth model corresponds 1:1
 * with the user's main Solana wallet — this pubkey is the natural default
 * destination for claimed funds.
 *
 * @param spendingPrivateKey - 32-byte hex string, with or without 0x prefix
 * @returns base58-encoded ed25519 pubkey (Solana address)
 * @throws if input is not exactly 64 hex characters (32 bytes)
 */
export function deriveDestinationFromSpending(spendingPrivateKey: string): string {
  const stripped = spendingPrivateKey.startsWith('0x')
    ? spendingPrivateKey.slice(2)
    : spendingPrivateKey
  if (!/^[0-9a-fA-F]+$/.test(stripped) || stripped.length !== 64) {
    throw new Error(
      'Spending key must be 32-byte hex (64 chars, with or without 0x prefix)',
    )
  }
  const privKeyBytes = Buffer.from(stripped, 'hex')
  const pubKeyBytes = ed25519.getPublicKey(privKeyBytes)
  return new PublicKey(pubKeyBytes).toBase58()
}
```

Note: `Buffer` and `PublicKey` are already imported at the top of `claim-helpers.ts` from PR #281 Task 1. The new `ed25519` import goes near the top of the file alongside the existing imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts -t "deriveDestinationFromSpending"`

Expected: ALL 4 tests pass.

- [ ] **Step 5: Run full claim-helpers test file to confirm no regression**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts`

Expected: 16 tests pass (12 from PR #281 + 4 new).

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/tools/claim-helpers.ts packages/agent/tests/tools/claim-helpers.test.ts
git commit -m "feat(claim): add deriveDestinationFromSpending helper for auto-derive destination"
```

---

## Task 2: Add `formatClaimAmount` helper (RED → GREEN)

Formats an SDK-returned base-units amount as a human-readable token string. Reuses `@sipher/sdk`'s existing `getTokenDecimals` + `fromBaseUnits` for the math; inline `tokenSymbol` private helper handles the SOL/USDC/USDT lookup with prefix-suffix fallback for unknown mints.

**Files:**
- Modify: `packages/agent/src/tools/claim-helpers.ts` (append exports + private helper)
- Modify: `packages/agent/tests/tools/claim-helpers.test.ts` (append tests)

- [ ] **Step 1: Write the failing tests**

Append to `packages/agent/tests/tools/claim-helpers.test.ts`:

```ts
import { formatClaimAmount } from '../../src/tools/claim-helpers.js'
import { WSOL_MINT, USDC_MINT, USDT_MINT } from '@sipher/sdk'

describe('formatClaimAmount', () => {
  it('formats SOL (9 decimals) with "SOL" symbol (not WSOL)', () => {
    expect(formatClaimAmount(1_500_000_000n, WSOL_MINT.toBase58())).toBe('1.5 SOL')
  })

  it('formats USDC (6 decimals) without trailing .0 for whole-number amounts', () => {
    expect(formatClaimAmount(1_000_000n, USDC_MINT.toBase58())).toBe('1 USDC')
  })

  it('formats USDT (6 decimals)', () => {
    expect(formatClaimAmount(2_500_000n, USDT_MINT.toBase58())).toBe('2.5 USDT')
  })

  it('formats unknown SPL mints with short prefix-suffix and default 9 decimals', () => {
    const UNKNOWN_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // happens to BE USDC mainnet but treat as unknown for this test
    // We need a mint that's not WSOL/USDC/USDT — use a synthetic one.
    const SYNTHETIC = 'Test4xQjJWUYXGDLZ7p4MPVRuPa8x85NMyMintAddressXX'
    expect(formatClaimAmount(1_000_000_000n, SYNTHETIC)).toBe('1 Test...essXX')
  })

  it('handles fractional amounts for unknown mints', () => {
    const SYNTHETIC = 'Test4xQjJWUYXGDLZ7p4MPVRuPa8x85NMyMintAddressXX'
    expect(formatClaimAmount(1_000_000n, SYNTHETIC)).toBe('0.001 Test...essXX')
  })
})
```

Note: Add `formatClaimAmount` to the imports from `claim-helpers.js` and add `WSOL_MINT`, `USDC_MINT`, `USDT_MINT` to a new import from `@sipher/sdk` at the top of the test file.

The `'Test4xQjJWUYXGDLZ7p4MPVRuPa8x85NMyMintAddressXX'` string is intentionally invalid base58 in places (contains digits like `4`, `7`, `8` which ARE valid base58 — verify the string parses as a PublicKey before relying on it). If `new PublicKey(SYNTHETIC)` throws in `formatClaimAmount`, use a valid base58 string instead — generate one via `Keypair.generate().publicKey.toBase58()` for the synthetic test mint.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts -t "formatClaimAmount"`

Expected: FAIL with `formatClaimAmount is not exported`.

- [ ] **Step 3: Add the implementation**

Append to `packages/agent/src/tools/claim-helpers.ts`:

```ts
import { WSOL_MINT, USDC_MINT, USDT_MINT, getTokenDecimals, fromBaseUnits } from '@sipher/sdk'

/**
 * Format an SDK-returned base-units amount as a human-readable token string.
 * Returns `"<amount> <symbol>"` for known mints (SOL/USDC/USDT) or
 * `"<amount> <mint_prefix>...<mint_suffix>"` for unknown SPL mints.
 *
 * `<amount>` format: matches `@sipher/sdk`'s `fromBaseUnits` — `"1"` for
 * whole numbers (no trailing `.0`), `"1.5"` / `"0.001"` for fractional.
 *
 * Token decimals come from `@sipher/sdk`'s `getTokenDecimals` (returns 9
 * for unknown mints — accurate for most SPL but imprecise for low-decimal
 * exotics; out of scope for this polish).
 */
export function formatClaimAmount(amountBaseUnits: bigint, mintBase58: string): string {
  const mintPubkey = new PublicKey(mintBase58)
  const decimals = getTokenDecimals(mintPubkey)
  const human = fromBaseUnits(amountBaseUnits, decimals)
  const symbol = tokenSymbol(mintBase58)
  return `${human} ${symbol}`
}

/** Inline symbol lookup — keep private to claim-helpers (SDK doesn't export getTokenSymbol). */
function tokenSymbol(mintBase58: string): string {
  if (mintBase58 === WSOL_MINT.toBase58()) return 'SOL' // UX: users think SOL, not WSOL
  if (mintBase58 === USDC_MINT.toBase58()) return 'USDC'
  if (mintBase58 === USDT_MINT.toBase58()) return 'USDT'
  return `${mintBase58.slice(0, 4)}...${mintBase58.slice(-4)}`
}
```

The `WSOL_MINT`/`USDC_MINT`/`USDT_MINT`/`getTokenDecimals`/`fromBaseUnits` import goes alongside the existing imports at the top of the file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts -t "formatClaimAmount"`

Expected: ALL 5 tests pass.

If any tests fail because the synthetic mint string isn't valid base58, replace it with a real one. Generate via:
```bash
node -e "const {Keypair} = require('@solana/web3.js'); console.log(Keypair.generate().publicKey.toBase58())"
```

- [ ] **Step 5: Run full claim-helpers test file**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts`

Expected: 21 tests pass (12 from PR #281 + 4 from Task 1 + 5 new).

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/tools/claim-helpers.ts packages/agent/tests/tools/claim-helpers.test.ts
git commit -m "feat(claim): add formatClaimAmount helper for human-readable amount display"
```

---

## Task 3: Wire helpers into executeClaim + update schema + test updates (RED → GREEN)

Three coordinated changes to `claim.ts`: make `destinationWallet` optional in `ClaimParams` + drop from Anthropic `required` array + restore description; auto-derive in `executeClaim` body when omitted; use `formatClaimAmount` in the result message. Tests in `claim.test.ts` need parallel updates: drop `destinationWallet` from input-validation tests; add 1 new auto-derive happy-path test; update message-truncation test to also assert human-readable format.

**Files:**
- Modify: `packages/agent/src/tools/claim.ts` (3 changes)
- Modify: `packages/agent/tests/claim.test.ts` (4 changes)

- [ ] **Step 1: Update test assertions to expect the new shape (RED)**

In `packages/agent/tests/claim.test.ts`:

**Change 1.1:** Update the import to include the helpers we'll need to verify:

Find the existing helper import line (around line 28):
```ts
import { resolveStealthContext } from '../src/tools/claim-helpers.js'
```

Replace with:
```ts
import { resolveStealthContext, deriveDestinationFromSpending } from '../src/tools/claim-helpers.js'
```

Then add to the vi.mock factory for `'../src/tools/claim-helpers.js'` (around lines 14-22) — the mock needs to provide `deriveDestinationFromSpending`:

Find:
```ts
vi.mock('../src/tools/claim-helpers.js', () => ({
  resolveStealthContext: vi.fn(),
  StealthContextError: class StealthContextError extends Error {
    constructor(message: string, public code: string) {
      super(message)
      this.name = 'StealthContextError'
    }
  },
}))
```

Replace with:
```ts
vi.mock('../src/tools/claim-helpers.js', () => ({
  resolveStealthContext: vi.fn(),
  deriveDestinationFromSpending: vi.fn(),
  formatClaimAmount: vi.fn((amount: bigint, mint: string) => `${amount.toString()} ${mint.slice(0, 4)}`),
  StealthContextError: class StealthContextError extends Error {
    constructor(message: string, public code: string) {
      super(message)
      this.name = 'StealthContextError'
    }
  },
}))
```

The `formatClaimAmount` mock returns a deterministic format `"<amount> <mint_prefix>"` so tests can assert against a predictable string regardless of the real helper's logic.

**Change 1.2:** Update the `'declares required input fields'` test (around line 60):

Find:
```ts
it('declares required input fields', () => {
  expect(claimTool.input_schema.required).toEqual([
    'txSignature',
    'viewingKey',
    'spendingKey',
    'destinationWallet',
  ])
})
```

Replace with:
```ts
it('declares required input fields', () => {
  expect(claimTool.input_schema.required).toEqual([
    'txSignature',
    'viewingKey',
    'spendingKey',
  ])
})
```

**Change 1.3:** Drop `destinationWallet` from the 4 input-validation tests. Find each `executeClaim({ ... })` call in the `describe('executeClaim — input validation (regression)', ...)` block and remove the `destinationWallet: VALID_DESTINATION,` line. There are 4 occurrences (empty txSignature, whitespace txSignature, empty viewingKey, empty spendingKey).

Example transformation for the first test:
```ts
// BEFORE
await expect(
  executeClaim({
    txSignature: '',
    viewingKey: VALID_VIEWING_KEY,
    spendingKey: VALID_SPENDING_KEY,
    destinationWallet: VALID_DESTINATION,
  })
).rejects.toThrow(/transaction signature is required/i)

// AFTER
await expect(
  executeClaim({
    txSignature: '',
    viewingKey: VALID_VIEWING_KEY,
    spendingKey: VALID_SPENDING_KEY,
  })
).rejects.toThrow(/transaction signature is required/i)
```

**Change 1.4:** Add the new auto-derive happy-path test. Inside `describe('executeClaim — happy path', ...)`, after the existing 3 tests, append:

```ts
it('auto-derives destinationWallet from spendingKey when omitted', async () => {
  const DERIVED_DESTINATION = 'AutoD3rived1111111111111111111111111111111111'
  vi.mocked(deriveDestinationFromSpending).mockReturnValue(DERIVED_DESTINATION)

  const result = await executeClaim({
    txSignature: VALID_TX_SIG,
    viewingKey: VALID_VIEWING_KEY,
    spendingKey: VALID_SPENDING_KEY,
    // destinationWallet intentionally omitted
  })

  expect(deriveDestinationFromSpending).toHaveBeenCalledWith(VALID_SPENDING_KEY)
  // The SDK call should receive the derived destination
  expect(claimStealthPayment).toHaveBeenCalledWith(
    expect.objectContaining({ destinationAddress: DERIVED_DESTINATION }),
  )
  // Note: result.destinationWallet still reflects whatever the SDK mock returned
  // (VALID_DESTINATION from beforeEach), which is fine — the helper only feeds
  // the SDK; the SDK's returned destinationAddress is the source of truth in
  // the result.
  expect(result.action).toBe('claim')
  expect(result.status).toBe('confirmed')
})
```

**Change 1.5:** Update the `'truncates deposit signature in message'` test to also assert the human-readable amount format. Find the test (around line 130) and add one more expect line:

```ts
it('truncates deposit signature in message', async () => {
  const result = await executeClaim({
    txSignature: VALID_TX_SIG,
    viewingKey: VALID_VIEWING_KEY,
    spendingKey: VALID_SPENDING_KEY,
    destinationWallet: VALID_DESTINATION,
  })

  expect(result.message).toContain(VALID_TX_SIG.slice(0, 12))
  expect(result.message).toContain(CLAIM_TX_SIG.slice(0, 12))
  // NEW: formatClaimAmount mock returns "<amount> <mint_prefix>" deterministically
  expect(result.message).toContain('1000000 EPjF') // mocked SDK returns 1_000_000n amount + USDC mint
})
```

- [ ] **Step 2: Run tests to verify they fail (RED)**

Run: `cd packages/agent && pnpm exec vitest run tests/claim.test.ts`

Expected: Multiple FAILs:
- `'declares required input fields'` — fails because the production code still has `'destinationWallet'` in the required array
- `'auto-derives destinationWallet from spendingKey when omitted'` — fails because executeClaim's current body throws on omission (or doesn't call deriveDestinationFromSpending)
- `'truncates deposit signature in message'` — fails because the production message still says `"X units"` not `"X EPjF"`

- [ ] **Step 3: Update `claim.ts` (GREEN)**

In `packages/agent/src/tools/claim.ts`:

**Change 3.1:** Make `destinationWallet` optional in `ClaimParams`. Find:
```ts
export interface ClaimParams {
  txSignature: string
  viewingKey: string
  spendingKey: string
  destinationWallet: string
  mint?: string
}
```

Replace with:
```ts
export interface ClaimParams {
  txSignature: string
  viewingKey: string
  spendingKey: string
  /** Optional destination wallet (base58). Defaults to the spending pubkey. */
  destinationWallet?: string
  /**
   * Optional SPL token mint (base58). If omitted, the mint is resolved from
   * the deposit transaction. Provide explicitly when you already know it
   * (e.g. from a prior scan result) to skip the on-chain lookup.
   */
  mint?: string
}
```

**Change 3.2:** Update the `claimTool.input_schema` — drop `'destinationWallet'` from `required` array and restore the description:

Find:
```ts
destinationWallet: {
  type: 'string',
  description:
    'Wallet address (base58) to receive claimed tokens. Required (auto-derive from spending pubkey is a planned follow-up).',
},
```

Replace with:
```ts
destinationWallet: {
  type: 'string',
  description: 'Wallet address (base58) to receive claimed tokens. Defaults to the spending pubkey.',
},
```

Find:
```ts
required: ['txSignature', 'viewingKey', 'spendingKey', 'destinationWallet'],
```

Replace with:
```ts
required: ['txSignature', 'viewingKey', 'spendingKey'],
```

**Change 3.3:** Update the imports at the top of `claim.ts` to add the new helpers:

Find:
```ts
import { resolveStealthContext, StealthContextError } from './claim-helpers.js'
```

Replace with:
```ts
import {
  resolveStealthContext,
  StealthContextError,
  deriveDestinationFromSpending,
  formatClaimAmount,
} from './claim-helpers.js'
```

**Change 3.4:** Update `executeClaim` body — auto-derive on omission + use formatClaimAmount in message:

Find:
```ts
const mintBase58 = params.mint ?? ctx.mint
if (!mintBase58) {
  throw new Error('Internal: resolveStealthContext returned no mint and no override was provided')
}
const destinationAddress = params.destinationWallet
const viewingPrivateKey = normalizeKey(params.viewingKey)
const spendingPrivateKey = normalizeKey(params.spendingKey)
```

Replace with:
```ts
const mintBase58 = params.mint ?? ctx.mint
if (!mintBase58) {
  throw new Error('Internal: resolveStealthContext returned no mint and no override was provided')
}
const destinationAddress = params.destinationWallet ?? deriveDestinationFromSpending(params.spendingKey)
const viewingPrivateKey = normalizeKey(params.viewingKey)
const spendingPrivateKey = normalizeKey(params.spendingKey)
```

Then find the message construction at the bottom of `executeClaim`:
```ts
message:
  `Claimed payment ${params.txSignature.slice(0, 12)}... → claim tx ${sdkResult.txSignature.slice(0, 12)}... ` +
  `(${sdkResult.amount.toString()} units to ${sdkResult.destinationAddress.slice(0, 8)}...)`,
```

Replace with:
```ts
message:
  `Claimed payment ${params.txSignature.slice(0, 12)}... → claim tx ${sdkResult.txSignature.slice(0, 12)}... ` +
  `(${formatClaimAmount(sdkResult.amount, mintBase58)} to ${sdkResult.destinationAddress.slice(0, 8)}...)`,
```

- [ ] **Step 4: Run tests to verify they pass (GREEN)**

Run: `cd packages/agent && pnpm exec vitest run tests/claim.test.ts`

Expected: ALL tests pass:
- 3 `claimTool definition` tests (1 updated)
- 4 `executeClaim — happy path` tests (1 new auto-derive)
- 4 `executeClaim — input validation (regression)` tests (4 updated)
- 3 `executeClaim — error paths` tests (unchanged)

Total: 14 tests (was 13 + 1 new).

- [ ] **Step 5: Run workspace typecheck**

Run: `cd /Users/rector/local-dev/sipher && pnpm typecheck 2>&1 | tail -5`

Expected: clean across all 4 workspace projects.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/tools/claim.ts packages/agent/tests/claim.test.ts
git commit -m "feat(claim): wire auto-derive destinationWallet + formatClaimAmount into executeClaim

- ClaimParams.destinationWallet optional again (auto-derive from spending pubkey)
- claimTool schema: drop destinationWallet from required, restore 'Defaults to spending pubkey' description
- executeClaim body: auto-derive via deriveDestinationFromSpending on omission
- result message: format amount as '1.5 SOL' / '1 USDC' / '<x> XXXX...YYYY' via formatClaimAmount
- claim.test.ts: drop destinationWallet from input-validation tests, add auto-derive happy-path test, extend message-truncation assertion"
```

---

## Task 4: Full regression + verify consolidate.ts still works

No code change in this task — just verify the regression surface.

**Files:**
- (verification only)

- [ ] **Step 1: Read consolidate.ts to confirm destinationWallet is still passed**

Run: `cd /Users/rector/local-dev/sipher && grep -A 2 "destinationWallet: params.wallet" packages/agent/src/tools/consolidate.ts`

Expected: the line `destinationWallet: params.wallet,` appears inside the `createScheduledOp` params (added in PR #281's `3b937ef`). Optional ≠ rejected — keeps working.

- [ ] **Step 2: Run full agent test suite**

Run: `cd /Users/rector/local-dev/sipher/packages/agent && pnpm test -- --run 2>&1 | tail -8`

Expected: 1622 passed + 2 skipped (was 1612 baseline, +10 net new: 4 from Task 1 `deriveDestinationFromSpending` + 5 from Task 2 `formatClaimAmount` + 1 from Task 3 auto-derive happy-path; the 4 input-validation tests are MODIFIED in-place, not removed, so they keep their count).

If the test count is off by more than ±2, investigate before proceeding (likely a mock-state-isolation issue between describes).

- [ ] **Step 3: Run workspace typecheck**

Run: `cd /Users/rector/local-dev/sipher && pnpm typecheck 2>&1 | tail -5`

Expected: clean.

- [ ] **Step 4: Verify no AI attribution in commits**

Run: `cd /Users/rector/local-dev/sipher && git log main..HEAD --format=%B | grep -iE "co-authored|🤖|generated with|claude" || echo "CLEAN"`

Expected: `CLEAN`.

- [ ] **Step 5: No commit needed for this task** (verification only)

---

## Task 5: Push branch + open PR

**Files:**
- (PR creation only)

- [ ] **Step 1: Push branch to remote**

```bash
cd /Users/rector/local-dev/sipher
git push -u origin feat/issue-286-claim-path-a-polish
```

Expected: 5 commits total ahead of main:
1. `c43ad7b` — docs(superpowers): add Claim Path A polish design (issue #286)
2. (Task 1 commit) — feat(claim): add deriveDestinationFromSpending helper
3. (Task 2 commit) — feat(claim): add formatClaimAmount helper
4. (Task 3 commit) — feat(claim): wire auto-derive + formatClaimAmount into executeClaim

- [ ] **Step 2: Open PR**

```bash
gh pr create \
  --base main \
  --title "feat(claim): Path A polish — auto-derive destinationWallet + human-readable amount" \
  --body "$(cat <<'EOF'
## Summary

Closes #286. Two small polish features for the Path A claim flow shipped in #281:

1. **Auto-derive `destinationWallet`** from the user's spending pubkey when omitted. `ClaimParams.destinationWallet` is optional again; Anthropic schema's `required` array drops it; schema description restored to "Defaults to the spending pubkey". Path A's runtime gap (helper threw if omitted) is closed by actually deriving the pubkey via `@noble/curves/ed25519.getPublicKey`.

2. **Human-readable amount display** in the claim result message. Instead of `"Claimed payment X... → claim tx Y... (1000000 units to Z...)"`, the message now reads `"... (1.5 SOL to Z...)"` or `"... (1 USDC to Z...)"` or `"... (1 EPjF...Dt1v to Z...)"` for unknown SPL mints. Uses `@sipher/sdk`'s existing `getTokenDecimals` + `fromBaseUnits` for the math; inline `tokenSymbol` private helper handles the SOL/USDC/USDT lookup with prefix-suffix fallback.

## Test plan

- [x] `tests/tools/claim-helpers.test.ts` — +9 new tests (4 for `deriveDestinationFromSpending`, 5 for `formatClaimAmount`)
- [x] `tests/claim.test.ts` — +1 new auto-derive happy-path test; 4 input-validation tests dropped `destinationWallet` (no longer required); 1 tool-definition assertion updated; 1 message-truncation assertion extended for human-readable amount
- [x] Full agent suite: ~1618 passing (was 1612 baseline at #281 merge)
- [x] Workspace typecheck clean
- [x] All commits GPG-signed, conventional prefixes, no AI attribution
- [x] `consolidate.ts` unchanged — still passes `destinationWallet: params.wallet` (optional ≠ rejected)

## Scope notes

- Token decimals for unknown SPL mints use SDK's default of 9 (accurate for SOL/USDC/USDT/most SPL, imprecise for low-decimal exotics — documented in helper JSDoc)
- Token symbol mapping is inline in `claim.ts` private helper; SDK-level `getTokenSymbol` export deferred (not needed by other tools today)
- Stealth keypair memory zeroization still tracked as a cross-cutting follow-up under Path A scope notes

## Verification

Pre-deploy: `https://sipher-api.sip-protocol.org/admin/api/torque/status` remains `{ enabled: true, network: 'devnet', ingesterReachable: true }`.

Post-deploy: trigger a claim from sipher chat — omit `destinationWallet` from the tool input and verify the funds land at the user's main wallet (the spending pubkey). Verify the chat message displays e.g. `"1 USDC"` instead of `"1000000 units"`.

## References

- Spec: `docs/superpowers/specs/2026-05-17-claim-path-a-polish-design.md`
- Plan: `docs/superpowers/plans/2026-05-17-claim-path-a-polish-plan.md`
- Predecessor: #281 (Path A initial scope)
EOF
)"
```

- [ ] **Step 3: Verify CI green before merge**

```bash
gh pr checks <PR_NUMBER> --repo sip-protocol/sipher
```

Wait for all checks green (test, component, playwright, gitleaks, Vercel). The CI build now includes the `Build workspace SDK` step from #281, so no pre-existing breakage to worry about.

- [ ] **Step 4: Self-review checklist before requesting RECTOR's review**

- [ ] 4 commits on the branch (spec + Task 1 + Task 2 + Task 3), all GPG-signed
- [ ] No `Co-Authored-By`, no `🤖`, no `Generated with`, no `Claude` in any commit body
- [ ] PR description accurately describes the 2 polish features + the scope notes
- [ ] Closes #286 in PR body
- [ ] `.env.example` unchanged (no env vars introduced)
- [ ] Test count delta documented

---

## Self-review checklist (this plan, before execution)

After writing this plan, fresh-eyes pass:

- [x] **Spec coverage:** Spec's "Architecture" maps to Task 1 + Task 2 (helpers) + Task 3 (wiring). Spec's "Implementation" Step 1-5 all have task coverage. Spec's "Test plan" all bullets map to specific tests in Task 1/2/3. Spec's "Risks" #4 ("consolidate.ts") covered by Task 4 verification. No spec requirements missing a task.
- [x] **Placeholder scan:** No "TBD", "implement later", "add appropriate", "similar to Task N" patterns. Test code is complete. Implementation code is complete with exact file paths.
- [x] **Type consistency:** `deriveDestinationFromSpending(spendingPrivateKey: string): string` consistent across helper definition + test usage + executeClaim call site. `formatClaimAmount(amountBaseUnits: bigint, mintBase58: string): string` consistent. `ClaimParams.destinationWallet?: string` consistent (was `: string` in PR #281, now optional). Mock implementations in test match real signatures.

Test count delta math: Task 1 adds 4 tests, Task 2 adds 5 tests, Task 3 adds 1 test (auto-derive) + modifies 5 tests in-place (4 input-validation + 1 tool-definition + 1 message-truncation = 6 modifications, 0 net delta). Total: +10 new tests. Baseline 1612 → target 1622. The Task 4 expected range "1618 to 1622" was sloppy — tighten to "1622" before subagent dispatch (or accept ±2 tolerance for any unexpected mock-state-isolation issues).

Updated Task 4 Step 2 expected: 1622 passed + 2 skipped.
