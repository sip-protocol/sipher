# Claim Phase 2 Path A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 1 claim stub with a real, end-to-end SDK-driven claim flow so `sipher_private_claim_completed` Torque events fire with the actual claim transaction signature instead of the deposit transaction signature.

**Architecture:** Delegate cryptography and broadcast to `@sip-protocol/sdk`'s `claimStealthPayment(params)` primitive, which derives the stealth private key via ECDH, builds an SPL transfer from the stealth ATA to the recipient's destination ATA, signs as the stealth keypair (paying fees from the stealth address's SOL balance), and broadcasts in one server-side call. Sipher's `executeClaim` resolves the stealth context (stealth address, ephemeral public key, mint) from the deposit transaction via `getParsedTransaction`, then hands off to the SDK. A new `signature` field on `ClaimToolResult` carries the claim transaction signature; the existing growth-hook `extractTxSignature` already prefers `signature` over `txSignature` (growth-hook.ts:104), so attribution becomes correct without touching the hook.

**Tech Stack:** TypeScript (strict, NodeNext ESM with .js suffixes), @sip-protocol/sdk@^0.7.4 (`claimStealthPayment`, `parseAnnouncement`, `SolanaClaimResult`), @sipher/sdk (workspace) for `createConnection` + `USDC_MINT` + `resolveTokenMint`, @solana/web3.js (`Connection`, `PublicKey`, `getParsedTransaction`), vitest 3.x with `vi.mock` for SDK isolation.

**Spec reference:** `docs/superpowers/specs/2026-05-15-claim-phase-2-design.md` — specifically the "Amendment — SDK reality check" section (lines 300–420) which documents Path A's scope and trade-offs.

---

## File Structure

**Create:**
- `packages/agent/src/tools/claim-helpers.ts` — pure async helpers for stealth-context resolution and destination/mint resolution. Pure functions where possible; the one IO call (`resolveStealthContext`) accepts an injected `Connection` so tests can mock it. No persistent state, no top-level side effects.
- `packages/agent/tests/tools/claim-helpers.test.ts` — vitest suite covering the three helpers' happy + error paths.

**Modify:**
- `packages/agent/src/tools/claim.ts` — replace Phase 1 stub: new `ClaimParams` (adds optional `mint`), new `ClaimToolResult` (status always `'confirmed'`, drops `details` placeholder, renames `txSignature` → `depositTxSignature`, adds `signature` + `amount` + `mint` + `explorerUrl`), refactor `executeClaim` to: validate → resolve stealth context → resolve destination + mint → call SDK → map result. Updates `claimTool.description` + `input_schema` to document the new optional `mint` field.
- `packages/agent/tests/claim.test.ts` — keep the input-validation tests (still valid), replace the Phase 1 happy-path expectations with the new SDK-mocked happy path + error paths.
- `packages/agent/tests/integrations/torque/growth-hook.test.ts` — add one test asserting that when `executeClaim`-shaped result has both `signature` and `depositTxSignature`, the growth-hook emits with `data.tx_signature === signature` (the claim tx), not the deposit tx.
- `packages/agent/src/integrations/torque/README.md` — update line 128 "Tool emission coverage" table claim row from `Partial` to `Yes`, drop the "Proper fix tracked in claim Phase 2 follow-up" caveat, point at this PR for context.

**Out of scope (track as GH issues post-merge):**
- Stealth keypair memory zeroization
- Replay deduplication for the growth-hook (covered separately by Spec 3 follow-up)
- Frontend SignTxCard for claim (Path B — separate GH issue, post-judges)
- T3 instruction-match verification of broadcast tx
- Manual mint-extraction from deposit tx (if user omits mint AND default USDC doesn't apply)

---

## Pre-flight check (do this once before Task 1)

Verify the workspace is clean and the baseline tests pass on `main`:

```bash
cd /Users/rector/local-dev/sipher
git fetch origin
git checkout main
git pull --ff-only
git checkout -b feat/spec-4-path-a-claim-phase-2
cd packages/agent && pnpm exec tsc --noEmit
cd packages/agent && pnpm test -- --run 2>&1 | tail -10
```

Expected: typecheck clean, all 1602 agent tests pass.

---

## Task 1: Add `resolveStealthContext` helper (RED → GREEN)

Resolves the deposit transaction into the stealth address + ephemeral public key + mint needed by the SDK's claim primitive. Pure async — accepts injected `Connection`, makes one `getParsedTransaction` call, parses the result.

**Files:**
- Create: `packages/agent/src/tools/claim-helpers.ts`
- Create: `packages/agent/tests/tools/claim-helpers.test.ts`

- [ ] **Step 1: Write the failing test for happy path**

Create `packages/agent/tests/tools/claim-helpers.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { resolveStealthContext, StealthContextError } from '../../src/tools/claim-helpers.js'

const DEPOSIT_SIG =
  '4Hc3vQBhYzS5xQZK1RtwvkLqxg1JhWf5pSr6vKQYVbTtFNxRr5jJp2k4QvJqwn3aB6XzMpYsLqHv2QwRcVbN8mY5s5c'
const STEALTH_PUBKEY = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const EPHEMERAL_PUBKEY = 'GqvBwYTWWZRyDQ4ZeNvFLgfbA8wYjBvE6cKxFQXjHvSr'
const STEALTH_ATA = 'AfPXfQs5MNJyEnUYvxRJ6BHwQNyKqJVE9Y3CDbHwfXVc'
const MINT_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

function mockTxWithMemoAndSplTransfer() {
  return {
    transaction: {
      message: {
        instructions: [
          {
            program: 'spl-memo',
            programId: { toString: () => 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' },
            parsed: `SIP:1:${EPHEMERAL_PUBKEY}:a3`,
          },
          {
            program: 'spl-token',
            programId: { toString: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            parsed: {
              type: 'transferChecked',
              info: {
                destination: STEALTH_ATA,
                mint: MINT_USDC,
                tokenAmount: { amount: '1000000', decimals: 6 },
              },
            },
          },
        ],
      },
    },
    meta: { err: null },
  }
}

describe('resolveStealthContext — happy path', () => {
  it('returns stealth address, ephemeral pubkey, and mint from a parsed deposit', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue(mockTxWithMemoAndSplTransfer()),
      getParsedAccountInfo: vi.fn().mockResolvedValue({
        value: { data: { parsed: { info: { owner: STEALTH_PUBKEY, mint: MINT_USDC } } } },
      }),
    } as unknown as Connection

    const ctx = await resolveStealthContext(mockConnection, DEPOSIT_SIG)

    expect(ctx.stealthAddress).toBe(STEALTH_PUBKEY)
    expect(ctx.ephemeralPublicKey).toBe(EPHEMERAL_PUBKEY)
    expect(ctx.mint).toBe(MINT_USDC)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts`

Expected: FAIL with `Cannot find module '../../src/tools/claim-helpers.js'`.

- [ ] **Step 3: Write minimal implementation for happy path**

Create `packages/agent/src/tools/claim-helpers.ts`:

```ts
import { PublicKey, type Connection } from '@solana/web3.js'

export class StealthContextError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'deposit_not_found'
      | 'no_announcement_memo'
      | 'invalid_announcement'
      | 'no_token_transfer'
      | 'stealth_ata_unreadable',
  ) {
    super(message)
    this.name = 'StealthContextError'
  }
}

export interface StealthContext {
  /** Base58-encoded stealth pubkey (owner of the stealth ATA). */
  stealthAddress: string
  /** Base58-encoded ephemeral pubkey parsed from the announcement memo. */
  ephemeralPublicKey: string
  /** Base58-encoded SPL token mint of the stealth ATA. */
  mint: string
}

/**
 * Resolves a deposit transaction signature into the cryptographic context
 * needed by `claimStealthPayment`. One RPC call (getParsedTransaction)
 * plus optional account lookup for the stealth ATA owner.
 */
export async function resolveStealthContext(
  connection: Connection,
  depositTxSignature: string,
): Promise<StealthContext> {
  const tx = await connection.getParsedTransaction(depositTxSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })

  if (!tx) {
    throw new StealthContextError(
      `Deposit transaction ${depositTxSignature.slice(0, 12)}... not found on chain`,
      'deposit_not_found',
    )
  }

  const instructions = tx.transaction.message.instructions
  const memoIx = instructions.find(
    (ix): ix is typeof ix & { parsed: string } =>
      'program' in ix && ix.program === 'spl-memo' && typeof (ix as { parsed?: unknown }).parsed === 'string',
  )
  if (!memoIx) {
    throw new StealthContextError(
      `No announcement memo in deposit ${depositTxSignature.slice(0, 12)}...`,
      'no_announcement_memo',
    )
  }

  const announcement = parseAnnouncementMemo(memoIx.parsed)
  if (!announcement) {
    throw new StealthContextError(
      `Announcement memo is malformed: ${memoIx.parsed.slice(0, 32)}...`,
      'invalid_announcement',
    )
  }

  const tokenIx = instructions.find(
    (ix): ix is typeof ix & { parsed: { type: string; info: { destination: string; mint: string } } } =>
      'program' in ix &&
      ix.program === 'spl-token' &&
      typeof (ix as { parsed?: { type?: string } }).parsed === 'object' &&
      (ix as { parsed?: { type?: string } }).parsed?.type === 'transferChecked',
  )
  if (!tokenIx) {
    throw new StealthContextError(
      `No SPL token transfer instruction in deposit ${depositTxSignature.slice(0, 12)}...`,
      'no_token_transfer',
    )
  }

  const stealthATA = tokenIx.parsed.info.destination
  const mint = tokenIx.parsed.info.mint

  const ataInfo = await connection.getParsedAccountInfo(new PublicKey(stealthATA))
  const parsed = (ataInfo?.value?.data as { parsed?: { info?: { owner?: string } } } | undefined)?.parsed
  const stealthAddress = parsed?.info?.owner
  if (!stealthAddress) {
    throw new StealthContextError(
      `Stealth ATA ${stealthATA.slice(0, 12)}... is unreadable or not a token account`,
      'stealth_ata_unreadable',
    )
  }

  return {
    stealthAddress,
    ephemeralPublicKey: announcement.ephemeralPublicKey,
    mint,
  }
}

function parseAnnouncementMemo(memo: string): { ephemeralPublicKey: string } | null {
  // Format: SIP:1:<ephemeral_pubkey_base58>:<view_tag_hex>
  const parts = memo.split(':')
  if (parts.length !== 4) return null
  if (parts[0] !== 'SIP' || parts[1] !== '1') return null
  if (!parts[2] || parts[2].length < 32) return null
  return { ephemeralPublicKey: parts[2] }
}
```

Note: `getParsedAccountInfo` returns `{ value: { data: { parsed: { info: { owner } } } } }` for SPL token ATAs (the `jsonParsed` encoding is automatic for known programs). The Task 1 test fixture mock must match this shape — update the `getAccountInfo` mock to `getParsedAccountInfo` returning `{ value: { data: { parsed: { info: { owner: STEALTH_PUBKEY, mint: MINT_USDC } } } } }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts -t "happy path"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/tools/claim-helpers.ts packages/agent/tests/tools/claim-helpers.test.ts
git commit -m "feat(claim): add resolveStealthContext helper for deposit tx parsing"
```

---

## Task 2: Add error path tests + handlers for `resolveStealthContext` (RED → GREEN)

**Files:**
- Modify: `packages/agent/tests/tools/claim-helpers.test.ts`

- [ ] **Step 1: Write failing tests for the four error codes**

Append to `packages/agent/tests/tools/claim-helpers.test.ts`:

```ts
describe('resolveStealthContext — error paths', () => {
  const DEPOSIT_SIG_NF = 'NotFoundTxSignaturePlaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

  it('throws deposit_not_found when getParsedTransaction returns null', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue(null),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG_NF))
      .rejects.toMatchObject({ name: 'StealthContextError', code: 'deposit_not_found' })
  })

  it('throws no_announcement_memo when no memo instruction exists', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: { message: { instructions: [] } },
        meta: { err: null },
      }),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG))
      .rejects.toMatchObject({ code: 'no_announcement_memo' })
  })

  it('throws invalid_announcement when memo does not match SIP:1:... format', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: {
          message: {
            instructions: [
              { program: 'spl-memo', programId: { toString: () => 'memo' }, parsed: 'garbage' },
            ],
          },
        },
        meta: { err: null },
      }),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG))
      .rejects.toMatchObject({ code: 'invalid_announcement' })
  })

  it('throws no_token_transfer when memo exists but no SPL transferChecked', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: {
          message: {
            instructions: [
              {
                program: 'spl-memo',
                programId: { toString: () => 'memo' },
                parsed: `SIP:1:${EPHEMERAL_PUBKEY}:a3`,
              },
            ],
          },
        },
        meta: { err: null },
      }),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG))
      .rejects.toMatchObject({ code: 'no_token_transfer' })
  })

  it('throws stealth_ata_unreadable when ATA account info has no owner', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue(mockTxWithMemoAndSplTransfer()),
      getParsedAccountInfo: vi.fn().mockResolvedValue({ value: null }),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG))
      .rejects.toMatchObject({ code: 'stealth_ata_unreadable' })
  })
})
```

- [ ] **Step 2: Run tests to verify they pass against the Task 1 implementation**

Run: `cd packages/agent && pnpm exec vitest run tests/tools/claim-helpers.test.ts`

Expected: ALL 6 tests pass (1 happy path from Task 1 + 5 error paths). If any fail, the Task 1 implementation needs tightening — fix the implementation rather than weakening the test.

- [ ] **Step 3: Commit**

```bash
git add packages/agent/tests/tools/claim-helpers.test.ts
git commit -m "test(claim): add error path coverage for resolveStealthContext"
```

---

## Task 3: Replace `ClaimParams` + `ClaimToolResult` with Path A shape (typecheck-driven)

This is a contract change. No runtime test yet — the type change will surface every consumer of `ClaimToolResult` at `tsc --noEmit`. Update each surfaced consumer in the same task.

**Files:**
- Modify: `packages/agent/src/tools/claim.ts`

- [ ] **Step 1: Replace ClaimParams + ClaimToolResult + claimTool description**

In `packages/agent/src/tools/claim.ts`, replace lines 13–62 (the interfaces and tool definition) with:

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

export interface ClaimToolResult {
  action: 'claim'
  status: 'confirmed'
  /** The input deposit-tx signature (for traceability). */
  depositTxSignature: string
  /** The CLAIM tx signature — growth-hook reads this as the Torque attribution key. */
  signature: string
  /** Base58 destination wallet that received the funds. */
  destinationWallet: string
  /** Claimed amount in the token's smallest unit, stringified to avoid BigInt JSON issues. */
  amount: string
  /** Base58 SPL token mint. */
  mint: string
  /** Explorer URL for the claim transaction. */
  explorerUrl: string
  /** Human-readable summary for the chat UX. */
  message: string
}

export const claimTool: AnthropicTool = {
  name: 'claim',
  description:
    'Claim a received stealth payment found by the scan tool. ' +
    'Derives the stealth private key from your viewing+spending keys, ' +
    'transfers the tokens to your destination wallet, and returns the claim tx signature.',
  input_schema: {
    type: 'object' as const,
    properties: {
      txSignature: {
        type: 'string',
        description: 'Transaction signature of the stealth payment to claim (from scan results)',
      },
      viewingKey: {
        type: 'string',
        description: 'Your viewing private key (hex or base58)',
      },
      spendingKey: {
        type: 'string',
        description: 'Your spending private key (hex or base58). Used to derive the stealth key.',
      },
      destinationWallet: {
        type: 'string',
        description: 'Wallet address (base58) to receive claimed tokens. Defaults to the spending pubkey.',
      },
      mint: {
        type: 'string',
        description:
          'Optional SPL token mint (base58). If omitted, the mint is resolved from the deposit transaction.',
      },
    },
    required: ['txSignature', 'viewingKey', 'spendingKey'],
  },
}
```

- [ ] **Step 2: Replace `executeClaim` body with a typed stub that returns the new shape**

Replace lines 64–95 of `packages/agent/src/tools/claim.ts` with:

```ts
export async function executeClaim(params: ClaimParams): Promise<ClaimToolResult> {
  if (!params.txSignature || params.txSignature.trim().length === 0) {
    throw new Error('Transaction signature is required')
  }
  if (!params.viewingKey || params.viewingKey.trim().length === 0) {
    throw new Error('Viewing key is required to derive stealth key')
  }
  if (!params.spendingKey || params.spendingKey.trim().length === 0) {
    throw new Error('Spending key is required to derive stealth key')
  }

  // Task 4 will replace this stub with the real SDK call.
  throw new Error('executeClaim Phase 2 not yet wired — Task 4 placeholder')
}
```

- [ ] **Step 3: Run typecheck to find broken consumers**

Run: `cd packages/agent && pnpm exec tsc --noEmit`

Expected: typecheck errors in `tests/claim.test.ts` (it asserts on `result.serializedTx`, `result.details.*`, `result.status === 'awaiting_signature'` — all of which were removed). Note the errors; Task 5 rewrites the test.

- [ ] **Step 4: Commit (the type change with stub body, before behavior wiring)**

```bash
git add packages/agent/src/tools/claim.ts
git commit -m "refactor(claim): switch ClaimToolResult to Path A shape (stub body)"
```

---

## Task 4: Wire `executeClaim` to SDK (RED → GREEN)

**Files:**
- Modify: `packages/agent/src/tools/claim.ts`
- Modify: `packages/agent/tests/claim.test.ts`

- [ ] **Step 1: Write failing happy-path test for executeClaim**

Replace the entire content of `packages/agent/tests/claim.test.ts` with:

```ts
// packages/agent/tests/claim.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the SDK BEFORE importing claim.ts
vi.mock('@sip-protocol/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sip-protocol/sdk')>('@sip-protocol/sdk')
  return {
    ...actual,
    claimStealthPayment: vi.fn(),
  }
})

// Mock helpers + sipher connection helper
vi.mock('../src/tools/claim-helpers.js', () => ({
  resolveStealthContext: vi.fn(),
  StealthContextError: class StealthContextError extends Error {
    constructor(message: string, public code: string) {
      super(message)
      this.name = 'StealthContextError'
    }
  },
}))

vi.mock('@sipher/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sipher/sdk')>('@sipher/sdk')
  return {
    ...actual,
    createConnection: vi.fn(() => ({
      // Minimal Connection mock surface — methods called by claim flow indirectly
    })),
  }
})

import { claimTool, executeClaim } from '../src/tools/claim.js'
import { claimStealthPayment } from '@sip-protocol/sdk'
import { resolveStealthContext } from '../src/tools/claim-helpers.js'

const VALID_TX_SIG = '5' + 'a'.repeat(87)
const VALID_VIEWING_KEY = 'ab'.repeat(32)
const VALID_SPENDING_KEY = 'cd'.repeat(32)
const VALID_DESTINATION = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const STEALTH_ADDR = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const EPHEMERAL_PUBKEY = 'GqvBwYTWWZRyDQ4ZeNvFLgfbA8wYjBvE6cKxFQXjHvSr'
const MINT_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const CLAIM_TX_SIG = '4Hc' + 'b'.repeat(85)

describe('claimTool definition', () => {
  it('has correct name', () => {
    expect(claimTool.name).toBe('claim')
  })

  it('declares required input fields', () => {
    expect(claimTool.input_schema.required).toEqual([
      'txSignature',
      'viewingKey',
      'spendingKey',
    ])
  })

  it('declares optional destinationWallet and mint fields', () => {
    expect(claimTool.input_schema.properties).toHaveProperty('destinationWallet')
    expect(claimTool.input_schema.properties).toHaveProperty('mint')
  })
})

describe('executeClaim — happy path', () => {
  beforeEach(() => {
    vi.mocked(resolveStealthContext).mockResolvedValue({
      stealthAddress: STEALTH_ADDR,
      ephemeralPublicKey: EPHEMERAL_PUBKEY,
      mint: MINT_USDC,
    })
    vi.mocked(claimStealthPayment).mockResolvedValue({
      txSignature: CLAIM_TX_SIG,
      destinationAddress: VALID_DESTINATION,
      amount: 1000000n,
      explorerUrl: `https://solscan.io/tx/${CLAIM_TX_SIG}`,
    })
  })

  it('returns confirmed status with claim signature', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
      destinationWallet: VALID_DESTINATION,
    })

    expect(result.action).toBe('claim')
    expect(result.status).toBe('confirmed')
    expect(result.signature).toBe(CLAIM_TX_SIG)
    expect(result.depositTxSignature).toBe(VALID_TX_SIG)
    expect(result.destinationWallet).toBe(VALID_DESTINATION)
    expect(result.amount).toBe('1000000')
    expect(result.mint).toBe(MINT_USDC)
    expect(result.explorerUrl).toContain(CLAIM_TX_SIG)
  })

  it('passes resolved stealth context to claimStealthPayment', async () => {
    await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
      destinationWallet: VALID_DESTINATION,
    })

    expect(claimStealthPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        stealthAddress: STEALTH_ADDR,
        ephemeralPublicKey: EPHEMERAL_PUBKEY,
        destinationAddress: VALID_DESTINATION,
      }),
    )
  })

  it('truncates deposit signature in message', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
      destinationWallet: VALID_DESTINATION,
    })

    expect(result.message).toContain(VALID_TX_SIG.slice(0, 12))
    expect(result.message).toContain(CLAIM_TX_SIG.slice(0, 12))
  })
})

describe('executeClaim — input validation (regression)', () => {
  it('rejects empty txSignature', async () => {
    await expect(
      executeClaim({
        txSignature: '',
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/transaction signature is required/i)
  })

  it('rejects whitespace-only txSignature', async () => {
    await expect(
      executeClaim({
        txSignature: '   ',
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/transaction signature is required/i)
  })

  it('rejects empty viewingKey', async () => {
    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: '',
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/viewing key is required/i)
  })

  it('rejects empty spendingKey', async () => {
    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: '',
      })
    ).rejects.toThrow(/spending key is required/i)
  })
})
```

- [ ] **Step 2: Run test to verify happy path fails (stub still throws)**

Run: `cd packages/agent && pnpm exec vitest run tests/claim.test.ts`

Expected: Input validation tests PASS (4), happy-path tests FAIL with the "Phase 2 not yet wired" error from Task 3's stub.

- [ ] **Step 3: Implement executeClaim using the SDK**

Replace `executeClaim` in `packages/agent/src/tools/claim.ts` with:

```ts
import { claimStealthPayment, type SolanaClaimResult } from '@sip-protocol/sdk'
import { PublicKey } from '@solana/web3.js'
import { createConnection, USDC_MINT } from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'
import { resolveStealthContext, StealthContextError } from './claim-helpers.js'

// Keep imports for type tooling
import type { AnthropicTool } from '../pi/tool-adapter.js'

// ... ClaimParams + ClaimToolResult + claimTool stay as in Task 3 ...

export async function executeClaim(params: ClaimParams): Promise<ClaimToolResult> {
  if (!params.txSignature || params.txSignature.trim().length === 0) {
    throw new Error('Transaction signature is required')
  }
  if (!params.viewingKey || params.viewingKey.trim().length === 0) {
    throw new Error('Viewing key is required to derive stealth key')
  }
  if (!params.spendingKey || params.spendingKey.trim().length === 0) {
    throw new Error('Spending key is required to derive stealth key')
  }

  const network = loadNetworkConfig().clusterName
  const connection = createConnection(network)

  let ctx
  try {
    ctx = await resolveStealthContext(connection, params.txSignature)
  } catch (err) {
    if (err instanceof StealthContextError) {
      throw new Error(`Cannot resolve stealth payment: ${err.message}`)
    }
    throw err
  }

  const mintBase58 = params.mint ?? ctx.mint ?? USDC_MINT.toBase58()
  const destinationAddress = params.destinationWallet ?? deriveDestinationFromSpending(params.spendingKey)
  const viewingPrivateKey = normalizeKey(params.viewingKey)
  const spendingPrivateKey = normalizeKey(params.spendingKey)

  let sdkResult: SolanaClaimResult
  try {
    sdkResult = await claimStealthPayment({
      connection,
      stealthAddress: ctx.stealthAddress,
      ephemeralPublicKey: ctx.ephemeralPublicKey,
      viewingPrivateKey,
      spendingPrivateKey,
      destinationAddress,
      mint: new PublicKey(mintBase58),
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Claim broadcast failed: ${detail}`)
  }

  return {
    action: 'claim',
    status: 'confirmed',
    depositTxSignature: params.txSignature,
    signature: sdkResult.txSignature,
    destinationWallet: sdkResult.destinationAddress,
    amount: sdkResult.amount.toString(),
    mint: mintBase58,
    explorerUrl: sdkResult.explorerUrl,
    message:
      `Claimed payment ${params.txSignature.slice(0, 12)}... → claim tx ${sdkResult.txSignature.slice(0, 12)}... ` +
      `(${sdkResult.amount.toString()} units to ${sdkResult.destinationAddress.slice(0, 8)}...)`,
  }
}

/** @internal — placeholder until SDK exposes spending pubkey derivation */
function deriveDestinationFromSpending(spendingKey: string): string {
  // For Path A initial scope: if user does not provide destinationWallet, throw —
  // mirroring the existing send tool's pattern. A follow-up PR can derive the
  // pubkey from the spending privkey, but for the initial ship the destination
  // is always supplied via the agent's tool input.
  void spendingKey
  throw new Error('destinationWallet is required (Path A initial scope — auto-derive in follow-up)')
}

/** Strip 0x prefix and validate hex shape for SDK consumption. */
function normalizeKey(key: string): `0x${string}` {
  const stripped = key.startsWith('0x') ? key.slice(2) : key
  if (!/^[0-9a-fA-F]+$/.test(stripped)) {
    throw new Error('Key must be hex (with or without 0x prefix)')
  }
  return `0x${stripped.toLowerCase()}` as `0x${string}`
}
```

Note: `deriveDestinationFromSpending` throws to force the caller to supply `destinationWallet`. This keeps Path A scope tight. Tests pass `destinationWallet` so they don't hit this path. A follow-up issue will add real derivation.

- [ ] **Step 4: Run tests to verify happy path passes**

Run: `cd packages/agent && pnpm exec vitest run tests/claim.test.ts`

Expected: ALL tests pass (4 tool-definition + 3 happy-path + 4 input-validation = 11 tests).

- [ ] **Step 5: Run agent typecheck to confirm no cross-file regression**

Run: `cd packages/agent && pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/tools/claim.ts packages/agent/tests/claim.test.ts
git commit -m "feat(claim): wire executeClaim to SDK claimStealthPayment (Path A)"
```

---

## Task 5: Add error path tests for SDK failure modes (RED → GREEN)

**Files:**
- Modify: `packages/agent/tests/claim.test.ts`

- [ ] **Step 1: Write failing tests for two error paths**

Append to `packages/agent/tests/claim.test.ts`:

```ts
describe('executeClaim — error paths', () => {
  it('wraps StealthContextError in actionable error', async () => {
    vi.mocked(resolveStealthContext).mockRejectedValue(
      Object.assign(new Error('Deposit transaction 5aaaaaa... not found on chain'), {
        name: 'StealthContextError',
        code: 'deposit_not_found',
      }),
    )

    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
        destinationWallet: VALID_DESTINATION,
      }),
    ).rejects.toThrow(/Cannot resolve stealth payment/i)
  })

  it('wraps SDK broadcast errors in actionable error', async () => {
    vi.mocked(resolveStealthContext).mockResolvedValue({
      stealthAddress: STEALTH_ADDR,
      ephemeralPublicKey: EPHEMERAL_PUBKEY,
      mint: MINT_USDC,
    })
    vi.mocked(claimStealthPayment).mockRejectedValue(
      new Error('Stealth key derivation failed: derived private key does not produce expected public key'),
    )

    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
        destinationWallet: VALID_DESTINATION,
      }),
    ).rejects.toThrow(/Claim broadcast failed:.*Stealth key derivation failed/i)
  })

  it('throws when destinationWallet is omitted (Path A scope)', async () => {
    vi.mocked(resolveStealthContext).mockResolvedValue({
      stealthAddress: STEALTH_ADDR,
      ephemeralPublicKey: EPHEMERAL_PUBKEY,
      mint: MINT_USDC,
    })

    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
      }),
    ).rejects.toThrow(/destinationWallet is required/i)
  })

  it('rejects non-hex viewing key', async () => {
    vi.mocked(resolveStealthContext).mockResolvedValue({
      stealthAddress: STEALTH_ADDR,
      ephemeralPublicKey: EPHEMERAL_PUBKEY,
      mint: MINT_USDC,
    })

    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: 'this-is-not-hex',
        spendingKey: VALID_SPENDING_KEY,
        destinationWallet: VALID_DESTINATION,
      }),
    ).rejects.toThrow(/key must be hex/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/agent && pnpm exec vitest run tests/claim.test.ts`

Expected: ALL 15 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/agent/tests/claim.test.ts
git commit -m "test(claim): cover SDK + helper error paths in executeClaim"
```

---

## Task 6: Growth-hook test — claim emission uses `signature` not `txSignature` (RED → GREEN)

**Files:**
- Modify: `packages/agent/tests/integrations/torque/growth-hook.test.ts`

- [ ] **Step 1: Read the existing growth-hook test setup to match its conventions**

Run: `cd packages/agent && head -80 tests/integrations/torque/growth-hook.test.ts`

Note the imports, mock pattern, and how `wrapExecutorWithGrowthHook` is exercised. The new test must follow the same pattern (likely uses an in-memory MCP client mock and asserts on `client.emitEvent` calls).

- [ ] **Step 2: Add a failing test for claim attribution**

Append to `packages/agent/tests/integrations/torque/growth-hook.test.ts` (adjust import paths + mock setup to match existing patterns observed in Step 1):

```ts
describe('growth-hook — claim emission attribution', () => {
  it('uses result.signature (claim tx) as data.tx_signature, not result.depositTxSignature', async () => {
    // Mirror the existing test's setup pattern. The key assertion: when the
    // wrapped executor returns a claim-shaped result with BOTH signature and
    // depositTxSignature populated, the emitted event's data.tx_signature
    // equals signature.

    const claimResult = {
      action: 'claim',
      status: 'confirmed',
      depositTxSignature: '5' + 'a'.repeat(87), // deposit
      signature: '4' + 'b'.repeat(87),           // CLAIM tx — what should be attributed
      destinationWallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: '1000000',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      explorerUrl: 'https://solscan.io/tx/...',
      message: '...',
    }

    // ... wire up the test harness following existing pattern ...
    // ... call wrapped executor with 'claim' tool name and a wallet input ...
    // ... assert emit was called with data.tx_signature === claimResult.signature ...

    // Specifically: emitEvent receives { data: { tx_signature: <claim_sig>, ... } }
    // NOT depositTxSignature.
  })
})
```

The implementer should fill in the harness-wiring portion using whatever fixtures + mocks the existing growth-hook.test.ts already uses (TorqueMCPClient stub, deriveRebateDestination stub returning `{ kind: 'stealth', address: 'X...' }`).

- [ ] **Step 3: Run test to verify it passes (growth-hook already prefers `signature` per line 104)**

Run: `cd packages/agent && pnpm exec vitest run tests/integrations/torque/growth-hook.test.ts -t "claim emission attribution"`

Expected: PASS — `extractTxSignature` (growth-hook.ts:101-107) already prefers `signature` over `txSignature`, and the new ClaimToolResult uses `signature` for the claim tx. No production code change needed.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/tests/integrations/torque/growth-hook.test.ts
git commit -m "test(torque): assert claim emission attributes to claim-tx-sig"
```

---

## Task 7: README update — Tool emission coverage table

**Files:**
- Modify: `packages/agent/src/integrations/torque/README.md`

- [ ] **Step 1: Read the existing emission table to find line 128**

Run: `cd packages/agent && sed -n '120,135p' src/integrations/torque/README.md`

Confirm the row format and the existing `Partial` value for `claim`.

- [ ] **Step 2: Update the claim row**

Edit `packages/agent/src/integrations/torque/README.md` line 128. Replace the existing claim row with:

```
| `claim` (chat-driven) | `sipher_private_claim_completed` | Yes | Uses the CLAIM tx signature as the emission key (Path A SDK-driven, since PR-<number>). |
```

If the table uses different column counts/separators, match the surrounding rows verbatim.

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/integrations/torque/README.md
git commit -m "docs(torque): mark claim emission Yes with claim-tx-sig attribution"
```

---

## Task 8: Full regression + PR

**Files:**
- (none — verification + PR creation)

- [ ] **Step 1: Strip any AI attribution from commit messages on this branch**

Run:

```bash
git log main..HEAD --format=%B | grep -iE "co-authored|🤖|generated with|claude" || echo "CLEAN"
```

Expected: `CLEAN`. If any commit has AI attribution, interactive-rebase to strip (or amend the offending commit). NEVER use `--no-verify` to bypass hooks.

- [ ] **Step 2: Run full per-package typechecks**

Run:

```bash
cd /Users/rector/local-dev/sipher
pnpm typecheck 2>&1 | tail -20
```

Expected: clean across all packages (recursive `pnpm -r --filter='!sipher' run typecheck` per PR #280).

- [ ] **Step 3: Run full agent test suite**

Run: `cd /Users/rector/local-dev/sipher/packages/agent && pnpm test -- --run 2>&1 | tail -5`

Expected: all previously-passing tests (1602 baseline) still pass, plus the new tests added in Tasks 1, 2, 4, 5, 6 (~15 net new). Approximate target: 1617+ passing.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/spec-4-path-a-claim-phase-2
```

- [ ] **Step 5: Open PR**

```bash
gh pr create \
  --base main \
  --title "feat(claim): Phase 2 Path A — SDK-driven claim flow with claim-tx-sig attribution" \
  --body "$(cat <<'EOF'
## Summary

Replaces the Phase 1 claim stub with an end-to-end SDK-driven claim flow per Spec 4 Path A (`docs/superpowers/specs/2026-05-15-claim-phase-2-design.md`, "Amendment — SDK reality check" section).

**Before:** `executeClaim` returned `serializedTx: null` and the growth-hook emitted `sipher_private_claim_completed` with the DEPOSIT tx signature as the attribution key (incorrect).

**After:** `executeClaim` resolves the stealth context from the deposit transaction, delegates ECDH derivation + tx build + broadcast to `@sip-protocol/sdk`'s `claimStealthPayment`, and returns `{ status: 'confirmed', signature: <claim-tx-sig>, depositTxSignature: <input>, ... }`. The growth-hook's existing `extractTxSignature` (line 104) prefers `signature` over `txSignature`, so Torque attribution now points at the actual claim transaction.

## Scope notes

- Path A trade-offs documented in the spec amendment. Path B (SignTxCard UX via SDK extension) tracked separately as a post-judges follow-up.
- `destinationWallet` is required in Path A initial scope (agent supplies it from prior scan context). Auto-derivation from spending pubkey is a fast-follow.
- SOL claims work via WSOL ATA (sipher's deposit model wraps SOL to WSOL on send).

## Test plan

- [x] `resolveStealthContext` helper: 6 unit tests (1 happy, 5 error codes)
- [x] `executeClaim` happy path: 3 tests (shape, SDK call args, message format)
- [x] `executeClaim` input validation (regression): 4 tests
- [x] `executeClaim` error paths: 4 tests (StealthContextError wrap, SDK broadcast error wrap, missing destination, malformed key)
- [x] Growth-hook attribution: 1 test asserting `data.tx_signature === signature` (not `depositTxSignature`)
- [x] Full agent suite green: ~1617 passing
- [x] Recursive typecheck clean

## Verification

Before deploy: `https://sipher-api.sip-protocol.org/admin/api/torque/status` still reports `enabled: true, network: devnet, ingesterReachable: true`. After deploy: trigger a claim from sipher chat with a known recent deposit; confirm the Torque event in the dashboard attributes to the claim tx signature (not the deposit signature).

## Follow-ups (separate issues, post-merge)

- Spec 4 Path B: SDK extension + SignTxCard claim UX
- Auto-derive `destinationWallet` from spending pubkey
- Replay deduplication in growth-hook (also tracked under Spec 3)
- Stealth keypair memory zeroization (best-effort)
EOF
)"
```

- [ ] **Step 6: Open the Path B + Spec 5 follow-up issues**

After the PR is opened (so they can cite its URL):

```bash
gh issue create --title "feat(sdk): add buildClaimTx + broadcastClaimTx split for SignTxCard claim UX (Spec 4 Path B)" --body "Post-judges follow-up. Extend @sip-protocol/sdk with split build/broadcast primitives so sipher can intercept between the two and present a SignTxCard for claim. Spec: docs/superpowers/specs/2026-05-15-claim-phase-2-design.md (Path B section). Predecessor: PR <Path A>." --label "enhancement" --label "post-hackathon"

# Spec 5 follow-ups (one per PR in the spec)
gh issue create --title "feat(scheduled-ops): durable-nonce family (scheduleSend + drip)" --body "Spec 5 PR-A. Implement pre-signed durable-nonce flow for time-bounded scheduled operations. Spec: docs/superpowers/specs/2026-05-15-scheduled-op-broadcasts-design.md (Family B section)." --label "enhancement" --label "post-hackathon"

gh issue create --title "feat(scheduled-ops): Squads delegation family (sweep + recurring)" --body "Spec 5 PR-B. Wallet-delegation via Squads Smart Account for indefinite scheduled operations. Spec: docs/superpowers/specs/2026-05-15-scheduled-op-broadcasts-design.md (Family C.2 section)." --label "enhancement" --label "post-hackathon"

gh issue create --title "chore(scheduled-ops): COURIER hardening (retries, observability, single-flight)" --body "Spec 5 PR-C. Make the crank production-ready under load. Spec: docs/superpowers/specs/2026-05-15-scheduled-op-broadcasts-design.md (COURIER hardening section)." --label "enhancement" --label "post-hackathon"
```

---

## Self-review checklist

After completing all tasks, before requesting RECTOR review:

- [ ] All 8 tasks committed with conventional prefixes (feat/refactor/test/docs/chore)
- [ ] No commit on the branch contains `Co-Authored-By`, `🤖`, or any AI attribution
- [ ] `pnpm typecheck` clean at repo root
- [ ] `cd packages/agent && pnpm test -- --run` passes (~1617 tests, +15 net)
- [ ] PR description accurately summarizes the Path A scope + trade-offs
- [ ] Follow-up issues filed and linked from PR body
- [ ] Spec 4 amendment recommendation honored: SDK-driven, no SignTxCard, honest claim-tx-sig attribution
- [ ] `.env.example` unchanged (no new env vars introduced by Path A)
