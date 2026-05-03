# Phase 4 — REST Service Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add isolated unit-level test coverage for the 3 builder modules under `src/services/` (transaction-builder, chain-transfer-builder, private-swap-builder), per the approved spec at `docs/superpowers/specs/2026-05-03-rest-service-tests-design.md`.

**Architecture:** 3 new test files in root `tests/` + 1 shared fixture file at `tests/fixtures/builder-mocks.ts`. Real `@sip-protocol/sdk` (no mocks); mock `@solana/web3.js` Connection, `./jupiter-provider.js`, `./cspl.js` at module boundaries via `vi.mock` + `vi.importActual` pattern from existing `tests/private-swap.test.ts`.

**Tech Stack:** Vitest, @solana/web3.js, @solana/spl-token, @sip-protocol/sdk, @noble/hashes.

**Branch:** `feat/phase-4-rest-service-tests` (already created, spec already committed).

**Test count target:** ~37 tests across 3 files. Root suite goes 33 → 36 files. Agent (938) + app (45) baselines unchanged.

---

## Task 1: Commit this plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-03-rest-service-tests.md` (this file)

- [ ] **Step 1: Verify file exists and is staged**

```bash
cd ~/local-dev/sipher
git status
```

Expected: `docs/superpowers/plans/2026-05-03-rest-service-tests.md` listed as untracked or staged.

- [ ] **Step 2: Stage and commit**

```bash
git add docs/superpowers/plans/2026-05-03-rest-service-tests.md
git commit -m "docs(phase-4): add rest service tests plan"
```

Expected: 1 file changed, commit succeeds.

---

## Task 2: Create shared fixture file `tests/fixtures/builder-mocks.ts`

**Files:**
- Create: `tests/fixtures/builder-mocks.ts`

- [ ] **Step 1: Create directory if it does not exist**

```bash
cd ~/local-dev/sipher
mkdir -p tests/fixtures
```

Expected: directory exists (idempotent).

- [ ] **Step 2: Write the fixture file**

Create `tests/fixtures/builder-mocks.ts` with the following content:

```typescript
import { vi } from 'vitest'

/**
 * Generates CONFIG_PDA bytes for buildAnchorShieldedSolTransfer tests.
 * The function reads total_transfers at byte offset 43 as u64 LE.
 * See src/services/transaction-builder.ts:155-159
 */
export function makeConfigPDABytes(counter: bigint): Buffer {
  const buf = Buffer.alloc(51)
  buf.writeBigUInt64LE(counter, 43)
  return buf
}

interface SolanaConnectionMockOverrides {
  getAccountInfo?: ReturnType<typeof vi.fn>
  getLatestBlockhash?: ReturnType<typeof vi.fn>
  getSlot?: ReturnType<typeof vi.fn>
}

/**
 * Returns a vi.mock factory for @solana/web3.js Connection.
 * Spreads vi.importActual to preserve PublicKey/Transaction/SystemProgram constructors.
 * Use: vi.mock('@solana/web3.js', mockSolanaConnection({...}))
 */
export function mockSolanaConnection(overrides: SolanaConnectionMockOverrides = {}) {
  return async () => {
    const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js')
    return {
      ...(actual as object),
      Connection: vi.fn().mockImplementation(() => ({
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
        getSlot: overrides.getSlot ?? vi.fn().mockResolvedValue(300_000_000),
        getLatestBlockhash: overrides.getLatestBlockhash ?? vi.fn().mockResolvedValue({
          blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
          lastValidBlockHeight: 300_000_100,
        }),
        getAccountInfo: overrides.getAccountInfo ?? vi.fn().mockResolvedValue(null),
      })),
    }
  }
}

type CSPLBehavior = 'success' | 'fail' | 'throws'

/**
 * Returns a mock CSPL service object for private-swap-builder tests.
 * Used inside vi.mock('./cspl.js', () => ({ getCSPLService: () => mockCSPLService(...) }))
 */
export function mockCSPLService(behavior: CSPLBehavior) {
  if (behavior === 'success') {
    return {
      wrap: vi.fn().mockResolvedValue({
        success: true,
        signature: 'csplwrapsig000000000000000000000000000000000000000000000000000',
      }),
    }
  }
  if (behavior === 'fail') {
    return {
      wrap: vi.fn().mockResolvedValue({ success: false }),
    }
  }
  return {
    wrap: vi.fn().mockRejectedValue(new Error('CSPL wrap failed')),
  }
}

interface JupiterQuoteOptions {
  inAmount?: string
  outAmount?: string
  slippageBps?: number
  quoteId?: string
  priceImpactPct?: string
}

/**
 * Builds a canned Jupiter quote response shape for tests.
 * Mock jupiter-provider.getQuote to return this.
 */
export function makeJupiterQuote(opts: JupiterQuoteOptions = {}) {
  const inAmount = opts.inAmount ?? '1000000000'
  const outAmount = opts.outAmount ?? '150000000'
  const slippageBps = opts.slippageBps ?? 50
  return {
    quoteId: opts.quoteId ?? 'jup_test_quote_001',
    inAmount,
    outAmount,
    outAmountMin: String(Math.floor(Number(outAmount) * (10000 - slippageBps) / 10000)),
    priceImpactPct: opts.priceImpactPct ?? '0.05',
    slippageBps,
  }
}

/**
 * Builds a canned Jupiter swap-tx response.
 * Mock jupiter-provider.buildSwapTransaction to return this.
 */
export function makeJupiterSwapTx(swapTransaction = 'mockedJupiterSwapTxBase64String===') {
  return { swapTransaction }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ~/local-dev/sipher
pnpm typecheck
```

Expected: no errors related to `tests/fixtures/builder-mocks.ts`.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/builder-mocks.ts
git commit -m "test(fixtures): add shared builder-mocks helper"
```

---

## Task 3: Add `buildShieldedSolTransfer` tests (3 tests)

**Files:**
- Create: `tests/transaction-builder.test.ts`
- Reference (read-only): `src/services/transaction-builder.ts:235-259`

- [ ] **Step 1: Write the test file with the first test group**

Create `tests/transaction-builder.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { Keypair, Transaction, SystemProgram } from '@solana/web3.js'
import { mockSolanaConnection } from './fixtures/builder-mocks.js'

vi.mock('@solana/web3.js', mockSolanaConnection())

const { buildShieldedSolTransfer } = await import('../src/services/transaction-builder.js')

const sender = Keypair.generate()
const stealth = Keypair.generate()
const senderAddress = sender.publicKey.toBase58()
const stealthAddress = stealth.publicKey.toBase58()

describe('buildShieldedSolTransfer', () => {
  it('builds SystemProgram.transfer with correct fromPubkey/toPubkey/lamports', async () => {
    const amount = 1_000_000n
    const txBase64 = await buildShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))

    expect(tx.instructions).toHaveLength(1)
    const ix = tx.instructions[0]
    expect(ix.programId.equals(SystemProgram.programId)).toBe(true)

    const decoded = SystemProgram.decodeTransfer(ix)
    expect(decoded.fromPubkey.toBase58()).toBe(senderAddress)
    expect(decoded.toPubkey.toBase58()).toBe(stealthAddress)
    expect(decoded.lamports).toBe(Number(amount))
  })

  it('sets recentBlockhash, lastValidBlockHeight, and feePayer', async () => {
    const txBase64 = await buildShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 100_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    expect(tx.recentBlockhash).toBe('4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM')
    expect(tx.lastValidBlockHeight).toBe(300_000_100)
    expect(tx.feePayer?.toBase58()).toBe(senderAddress)
  })

  it('returns base64 string that deserializes to a valid Transaction', async () => {
    const txBase64 = await buildShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 50_000n,
    })

    expect(typeof txBase64).toBe('string')
    expect(() => Transaction.from(Buffer.from(txBase64, 'base64'))).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the new tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/transaction-builder -- --run
```

Expected: 3 tests pass.

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Verify no regression in full root suite**

```bash
pnpm test -- --run 2>&1 | tail -10
```

Expected: all root tests pass (was 33 files / N tests, now +1 file with 3 new tests).

- [ ] **Step 5: Commit**

```bash
git add tests/transaction-builder.test.ts
git commit -m "test(transaction-builder): add buildShieldedSolTransfer tests (3)"
```

---

## Task 4: Add `buildShieldedSplTransfer` tests (4 tests)

**Files:**
- Modify: `tests/transaction-builder.test.ts`
- Reference (read-only): `src/services/transaction-builder.ts:264-308`

- [ ] **Step 1: Add SPL test group below existing describe block**

Append the following to `tests/transaction-builder.test.ts` (after the `buildShieldedSolTransfer` describe, before EOF). Update imports at top to include the new bits:

Update the import line near the top:

```typescript
import { Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
```

Update the `vi.mock` call to support per-test ATA-existence overrides. Replace the mock setup line:

```typescript
const mockGetAccountInfo = vi.fn().mockResolvedValue(null)
vi.mock('@solana/web3.js', mockSolanaConnection({ getAccountInfo: mockGetAccountInfo }))

const { buildShieldedSolTransfer, buildShieldedSplTransfer } = await import('../src/services/transaction-builder.js')
```

Add a fixed mint constant near the other constants:

```typescript
const mintPubkey = Keypair.generate().publicKey
const mintAddress = mintPubkey.toBase58()
```

Append the new describe block at the end of the file:

```typescript
describe('buildShieldedSplTransfer', () => {
  beforeEach(() => {
    mockGetAccountInfo.mockReset()
  })

  it('creates ATA when stealth ATA does not exist', async () => {
    mockGetAccountInfo.mockResolvedValue(null)

    const txBase64 = await buildShieldedSplTransfer({
      sender: senderAddress,
      stealthAddress,
      mint: mintAddress,
      amount: 1_000_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    expect(tx.instructions).toHaveLength(2)
    expect(tx.instructions[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true)
    expect(tx.instructions[1].programId.equals(TOKEN_PROGRAM_ID)).toBe(true)
  })

  it('skips ATA creation when stealth ATA already exists', async () => {
    mockGetAccountInfo.mockResolvedValue({ data: Buffer.alloc(0), executable: false, lamports: 1, owner: TOKEN_PROGRAM_ID })

    const txBase64 = await buildShieldedSplTransfer({
      sender: senderAddress,
      stealthAddress,
      mint: mintAddress,
      amount: 1_000_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    expect(tx.instructions).toHaveLength(1)
    expect(tx.instructions[0].programId.equals(TOKEN_PROGRAM_ID)).toBe(true)
  })

  it('derives sender ATA via getAssociatedTokenAddress(mint, sender)', async () => {
    mockGetAccountInfo.mockResolvedValue(null)

    const expectedSenderATA = await getAssociatedTokenAddress(mintPubkey, sender.publicKey)

    const txBase64 = await buildShieldedSplTransfer({
      sender: senderAddress,
      stealthAddress,
      mint: mintAddress,
      amount: 500_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    const transferIx = tx.instructions.find(ix => ix.programId.equals(TOKEN_PROGRAM_ID))!
    expect(transferIx.keys[0].pubkey.equals(expectedSenderATA)).toBe(true)
  })

  it('uses allowOwnerOffCurve=true for stealth ATA derivation', async () => {
    mockGetAccountInfo.mockResolvedValue(null)

    const expectedStealthATA = await getAssociatedTokenAddress(
      mintPubkey,
      stealth.publicKey,
      true,
    )

    const txBase64 = await buildShieldedSplTransfer({
      sender: senderAddress,
      stealthAddress,
      mint: mintAddress,
      amount: 750_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    const transferIx = tx.instructions.find(ix => ix.programId.equals(TOKEN_PROGRAM_ID))!
    expect(transferIx.keys[1].pubkey.equals(expectedStealthATA)).toBe(true)
  })
})
```

Add `beforeEach` to the import line at the top:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

- [ ] **Step 2: Run the new tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/transaction-builder -- --run
```

Expected: 7 tests pass (3 SOL + 4 SPL).

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add tests/transaction-builder.test.ts
git commit -m "test(transaction-builder): add buildShieldedSplTransfer tests (4)"
```

---

## Task 5: Add `buildAnchorShieldedSolTransfer` tests (7 tests)

**Files:**
- Modify: `tests/transaction-builder.test.ts`
- Reference (read-only): `src/services/transaction-builder.ts:143-230`

- [ ] **Step 1: Append the Anchor test group**

Add the following describe block at the end of `tests/transaction-builder.test.ts`. Also update the import to include `makeConfigPDABytes`:

Update the imports near the top:

```typescript
import { mockSolanaConnection, makeConfigPDABytes } from './fixtures/builder-mocks.js'
```

Update the named imports from transaction-builder:

```typescript
const { buildShieldedSolTransfer, buildShieldedSplTransfer, buildAnchorShieldedSolTransfer } = await import('../src/services/transaction-builder.js')
```

Add a constant near other constants for the program/config IDs (these are public, hard-coded into source):

```typescript
const SIP_PRIVACY_PROGRAM_ID = new PublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
const CONFIG_PDA = new PublicKey('BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ')
const FEE_COLLECTOR = new PublicKey('S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd')
const SHIELDED_TRANSFER_DISCRIMINATOR = Buffer.from([0x9d, 0x2a, 0x42, 0x93, 0xee, 0x75, 0x61, 0x5c])

// Realistic hex inputs (sized to source's expected lengths)
const COMMITMENT_HEX_NO_PREFIX = '02' + 'a'.repeat(64) // 33 bytes = 66 hex chars
const BLINDING_HEX_NO_PREFIX = 'b'.repeat(64) // 32 bytes = 64 hex chars
const EPHEMERAL_HEX_NO_PREFIX = 'c'.repeat(64) // 32 bytes
const VKHASH_HEX_NO_PREFIX = 'd'.repeat(64) // 32 bytes
```

Append the test group:

```typescript
describe('buildAnchorShieldedSolTransfer', () => {
  beforeEach(() => {
    mockGetAccountInfo.mockReset()
  })

  it('throws when CONFIG_PDA account is not found', async () => {
    mockGetAccountInfo.mockResolvedValue(null)

    await expect(
      buildAnchorShieldedSolTransfer({
        sender: senderAddress,
        stealthAddress,
        amount: 1_000_000n,
        commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
        blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
        ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
        viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
      })
    ).rejects.toThrow(/CONFIG_PDA account not found/)
  })

  it('parses total_transfers correctly when counter = 0', async () => {
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(0n) })

    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    expect(result.instructionType).toBe('anchor')
    expect(typeof result.noteId).toBe('string')
    expect(result.noteId.length).toBeGreaterThan(0) // base58 PDA
  })

  it('parses total_transfers correctly when counter = 42', async () => {
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(42n) })

    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    expect(result.instructionType).toBe('anchor')
    expect(result.noteId.length).toBeGreaterThan(0)
  })

  it('parses total_transfers correctly when counter near MAX_SAFE_INTEGER', async () => {
    const maxCounter = (2n ** 53n) - 1n
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(maxCounter) })

    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    expect(result.instructionType).toBe('anchor')
  })

  it('derives transferRecordPDA from [TRANSFER_RECORD_SEED, sender, counter_le_bytes]', async () => {
    const counter = 7n
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(counter) })

    const TRANSFER_RECORD_SEED = Buffer.from('transfer_record')
    const counterLeBytes = Buffer.alloc(8)
    counterLeBytes.writeBigUInt64LE(counter, 0)

    const [expectedPDA] = PublicKey.findProgramAddressSync(
      [TRANSFER_RECORD_SEED, sender.publicKey.toBuffer(), counterLeBytes],
      SIP_PRIVACY_PROGRAM_ID,
    )

    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    expect(result.noteId).toBe(expectedPDA.toBase58())
  })

  it('packs instruction data with correct byte layout at exact offsets', async () => {
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(0n) })

    const amount = 12345n
    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    const tx = Transaction.from(Buffer.from(result.transaction, 'base64'))
    expect(tx.instructions).toHaveLength(1)
    const ix = tx.instructions[0]
    expect(ix.programId.equals(SIP_PRIVACY_PROGRAM_ID)).toBe(true)

    const data = ix.data
    expect(data.length).toBe(8 + 33 + 32 + 32 + 32 + 8 + 128 + 8)

    // Byte-precise offset checks
    expect(data.subarray(0, 8).equals(SHIELDED_TRANSFER_DISCRIMINATOR)).toBe(true)
    expect(data.subarray(8, 41).toString('hex')).toBe(COMMITMENT_HEX_NO_PREFIX)
    expect(data.subarray(41, 73).equals(stealth.publicKey.toBytes())).toBe(true)
    expect(data.subarray(73, 105).toString('hex')).toBe(EPHEMERAL_HEX_NO_PREFIX)
    expect(data.subarray(105, 137).toString('hex')).toBe(VKHASH_HEX_NO_PREFIX)
    // amount at end (8 bytes LE)
    const amountBytes = data.subarray(273, 281)
    const amountReadback = amountBytes.readBigUInt64LE(0)
    expect(amountReadback).toBe(amount)

    // Verify accounts
    expect(ix.keys[0].pubkey.equals(CONFIG_PDA)).toBe(true)
    expect(ix.keys[2].pubkey.equals(sender.publicKey)).toBe(true)
    expect(ix.keys[3].pubkey.equals(stealth.publicKey)).toBe(true)
    expect(ix.keys[4].pubkey.equals(FEE_COLLECTOR)).toBe(true)
    expect(ix.keys[5].pubkey.equals(SystemProgram.programId)).toBe(true)
  })

  it.each([
    ['with 0x prefix', true],
    ['without 0x prefix', false],
  ])('handles hex inputs %s consistently', async (_label, withPrefix) => {
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(0n) })

    const prefix = withPrefix ? '0x' : ''
    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: prefix + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: prefix + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: prefix + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: prefix + VKHASH_HEX_NO_PREFIX,
    })

    const tx = Transaction.from(Buffer.from(result.transaction, 'base64'))
    const data = tx.instructions[0].data

    // Byte content should be identical regardless of prefix presence
    expect(data.subarray(8, 41).toString('hex')).toBe(COMMITMENT_HEX_NO_PREFIX)
    expect(data.subarray(73, 105).toString('hex')).toBe(EPHEMERAL_HEX_NO_PREFIX)
    expect(data.subarray(105, 137).toString('hex')).toBe(VKHASH_HEX_NO_PREFIX)
  })
})
```

- [ ] **Step 2: Run the new tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/transaction-builder -- --run
```

Expected: 14 tests pass total (3 SOL + 4 SPL + 7 Anchor).

- [ ] **Step 3: Verify typecheck and full root suite**

```bash
pnpm typecheck
pnpm test -- --run 2>&1 | tail -10
```

Expected: typecheck clean; root suite green.

- [ ] **Step 4: Commit**

```bash
git add tests/transaction-builder.test.ts
git commit -m "test(transaction-builder): add buildAnchorShieldedSolTransfer tests (7)"
```

---

## Task 6: Add `chain-transfer-builder` helper tests (3 tests)

**Files:**
- Create: `tests/chain-transfer-builder.test.ts`
- Reference (read-only): `src/services/chain-transfer-builder.ts:92-98`

- [ ] **Step 1: Create the test file with helper tests**

Create `tests/chain-transfer-builder.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

// Mock transaction-builder.js BEFORE importing chain-transfer-builder
vi.mock('../src/services/transaction-builder.js', () => ({
  buildShieldedSolTransfer: vi.fn().mockResolvedValue('mockedSolTxBase64'),
  buildShieldedSplTransfer: vi.fn().mockResolvedValue('mockedSplTxBase64'),
  buildAnchorShieldedSolTransfer: vi.fn().mockResolvedValue({
    transaction: 'mockedAnchorTxBase64',
    noteId: 'mockedNoteIdPDA',
    encryptedAmount: '0xdeadbeefcafebabe',
    instructionType: 'anchor' as const,
  }),
}))

const {
  isTransferSupported,
  getSupportedTransferChains,
} = await import('../src/services/chain-transfer-builder.js')

describe('isTransferSupported', () => {
  it.each([
    'solana',
    'ethereum',
    'polygon',
    'arbitrum',
    'optimism',
    'base',
    'near',
  ])('returns true for supported chain: %s', (chain) => {
    expect(isTransferSupported(chain)).toBe(true)
  })

  it('returns false for unsupported chain', () => {
    expect(isTransferSupported('bitcoin')).toBe(false)
  })
})

describe('getSupportedTransferChains', () => {
  it('returns array containing all 7 supported chains', () => {
    const chains = getSupportedTransferChains()
    expect(chains).toHaveLength(7)
    expect(chains).toEqual(
      expect.arrayContaining([
        'solana',
        'ethereum',
        'polygon',
        'arbitrum',
        'optimism',
        'base',
        'near',
      ])
    )
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/chain-transfer-builder -- --run
```

Expected: 3 tests pass (1 parameterized for 7 chains + 1 negative + 1 array check). Note: `it.each` with 7 entries counts as 7 individual `it` runs.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add tests/chain-transfer-builder.test.ts
git commit -m "test(chain-transfer-builder): add isTransferSupported + getSupportedTransferChains tests (3)"
```

---

## Task 7: Add `chain-transfer-builder` Solana branch tests (3 tests)

**Files:**
- Modify: `tests/chain-transfer-builder.test.ts`
- Reference (read-only): `src/services/chain-transfer-builder.ts:131-141, 176-223`

- [ ] **Step 1: Append the Solana branch test group**

First, update the imports at the top of `tests/chain-transfer-builder.test.ts` to include the additional symbols and a vi-mocked reference:

Replace the import block at top with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock transaction-builder.js BEFORE importing chain-transfer-builder
vi.mock('../src/services/transaction-builder.js', () => ({
  buildShieldedSolTransfer: vi.fn().mockResolvedValue('mockedSolTxBase64'),
  buildShieldedSplTransfer: vi.fn().mockResolvedValue('mockedSplTxBase64'),
  buildAnchorShieldedSolTransfer: vi.fn().mockResolvedValue({
    transaction: 'mockedAnchorTxBase64',
    noteId: 'mockedNoteIdPDA',
    encryptedAmount: '0xdeadbeefcafebabe',
    instructionType: 'anchor' as const,
  }),
}))

const txBuilder = await import('../src/services/transaction-builder.js')

const {
  isTransferSupported,
  getSupportedTransferChains,
  buildPrivateTransfer,
} = await import('../src/services/chain-transfer-builder.js')

// Realistic test recipient meta-address (use real ed25519/secp256k1 hex)
// 32-byte ed25519 pubkey for solana/near
const SOLANA_SPENDING_KEY = '0x' + 'a'.repeat(64)
const SOLANA_VIEWING_KEY = '0x' + 'b'.repeat(64)

// 33-byte secp256k1 compressed pubkey for evm
const EVM_SPENDING_KEY = '0x02' + 'c'.repeat(64)
const EVM_VIEWING_KEY = '0x02' + 'd'.repeat(64)

const sender = 'SenderAddrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
```

Append the new describe block at the end of the file:

```typescript
describe('buildPrivateTransfer — Solana branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('native SOL → calls buildAnchorShieldedSolTransfer with anchor instructionType', async () => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: SOLANA_SPENDING_KEY,
        viewingKey: SOLANA_VIEWING_KEY,
        chain: 'solana',
      },
      amount: '1000000',
    })

    expect(txBuilder.buildAnchorShieldedSolTransfer).toHaveBeenCalledOnce()
    expect(result.instructionType).toBe('anchor')
    expect(result.chain).toBe('solana')
    expect(result.curve).toBe('ed25519')
  })

  it('native SOL → falls back to system transfer when Anchor throws', async () => {
    vi.mocked(txBuilder.buildAnchorShieldedSolTransfer).mockRejectedValueOnce(
      new Error('CONFIG_PDA account not found')
    )

    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: SOLANA_SPENDING_KEY,
        viewingKey: SOLANA_VIEWING_KEY,
        chain: 'solana',
      },
      amount: '1000000',
    })

    expect(txBuilder.buildShieldedSolTransfer).toHaveBeenCalledOnce()
    expect(result.instructionType).toBe('system')
  })

  it('SPL token (mint provided) → calls buildShieldedSplTransfer', async () => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: SOLANA_SPENDING_KEY,
        viewingKey: SOLANA_VIEWING_KEY,
        chain: 'solana',
      },
      amount: '500000',
      token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
    })

    expect(txBuilder.buildShieldedSplTransfer).toHaveBeenCalledOnce()
    expect(result.chain).toBe('solana')
    if (result.chainData.type === 'solana') {
      expect(result.chainData.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    }
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/chain-transfer-builder -- --run
```

Expected: 6 tests total now (3 helper + 3 Solana branch).

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add tests/chain-transfer-builder.test.ts
git commit -m "test(chain-transfer-builder): add Solana branch tests (3)"
```

---

## Task 8: Add `chain-transfer-builder` EVM branch tests (3 tests)

**Files:**
- Modify: `tests/chain-transfer-builder.test.ts`
- Reference (read-only): `src/services/chain-transfer-builder.ts:225-256`

- [ ] **Step 1: Append the EVM branch test group**

Append the following describe block at the end of `tests/chain-transfer-builder.test.ts`:

```typescript
describe('buildPrivateTransfer — EVM branch', () => {
  const evmChainsWithIds: Array<[string, number]> = [
    ['ethereum', 1],
    ['polygon', 137],
    ['arbitrum', 42161],
    ['optimism', 10],
    ['base', 8453],
  ]

  it.each(evmChainsWithIds)('native ETH on %s returns {to, value, data:0x}', async (chain, _chainId) => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: EVM_SPENDING_KEY,
        viewingKey: EVM_VIEWING_KEY,
        chain,
      },
      amount: '1000000000000000000', // 1 ETH in wei
    })

    expect(result.chainData.type).toBe('evm')
    if (result.chainData.type === 'evm') {
      expect(result.chainData.to.toLowerCase()).toMatch(/^0x[0-9a-f]{40}$/)
      expect(result.chainData.value).toBe('1000000000000000000')
      expect(result.chainData.data).toBe('0x')
    }
  })

  it('ERC20 → data starts with 0xa9059cbb + padded address + padded amount', async () => {
    const tokenContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC on ETH
    const amount = '1000000' // 1 USDC

    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: EVM_SPENDING_KEY,
        viewingKey: EVM_VIEWING_KEY,
        chain: 'ethereum',
      },
      amount,
      token: tokenContract,
    })

    expect(result.chainData.type).toBe('evm')
    if (result.chainData.type === 'evm') {
      expect(result.chainData.to).toBe(tokenContract)
      expect(result.chainData.tokenContract).toBe(tokenContract)
      expect(result.chainData.value).toBe('0')
      // data: 0xa9059cbb + 64-char-padded-stealth + 64-char-padded-amount
      expect(result.chainData.data.startsWith('0xa9059cbb')).toBe(true)
      expect(result.chainData.data.length).toBe(2 + 8 + 64 + 64)

      const amountHex = result.chainData.data.slice(2 + 8 + 64)
      const amountReadback = BigInt('0x' + amountHex)
      expect(amountReadback).toBe(BigInt(amount))
    }
  })

  it.each(evmChainsWithIds)('sets correct chainId for %s → %i', async (chain, chainId) => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: EVM_SPENDING_KEY,
        viewingKey: EVM_VIEWING_KEY,
        chain,
      },
      amount: '1000',
    })

    if (result.chainData.type === 'evm') {
      expect(result.chainData.chainId).toBe(chainId)
    }
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/chain-transfer-builder -- --run
```

Expected: more tests now (5 EVM native + 1 ERC20 + 5 chainId via parameterization).

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add tests/chain-transfer-builder.test.ts
git commit -m "test(chain-transfer-builder): add EVM branch tests (3, parameterized)"
```

---

## Task 9: Add `chain-transfer-builder` NEAR branch tests (2 tests)

**Files:**
- Modify: `tests/chain-transfer-builder.test.ts`
- Reference (read-only): `src/services/chain-transfer-builder.ts:258-290`

- [ ] **Step 1: Append the NEAR branch test group**

Append at the end of `tests/chain-transfer-builder.test.ts`:

```typescript
describe('buildPrivateTransfer — NEAR branch', () => {
  it('native NEAR → returns Transfer action with amount', async () => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: SOLANA_SPENDING_KEY, // ed25519 reused for NEAR
        viewingKey: SOLANA_VIEWING_KEY,
        chain: 'near',
      },
      amount: '1000000000000000000000000', // 1 NEAR (24 decimals)
    })

    expect(result.chainData.type).toBe('near')
    if (result.chainData.type === 'near') {
      expect(result.chainData.actions).toHaveLength(1)
      expect(result.chainData.actions[0]).toEqual({
        type: 'Transfer',
        amount: '1000000000000000000000000',
      })
      expect(result.chainData.tokenContract).toBeUndefined()
    }
  })

  it('NEP-141 FT → FunctionCall with ft_transfer + base64 args', async () => {
    const tokenContract = 'usdc.fakes.testnet'
    const amount = '1000000' // 1 USDC

    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: SOLANA_SPENDING_KEY,
        viewingKey: SOLANA_VIEWING_KEY,
        chain: 'near',
      },
      amount,
      token: tokenContract,
    })

    expect(result.chainData.type).toBe('near')
    if (result.chainData.type === 'near') {
      expect(result.chainData.receiverId).toBe(tokenContract)
      expect(result.chainData.tokenContract).toBe(tokenContract)
      expect(result.chainData.actions).toHaveLength(1)

      const action = result.chainData.actions[0]
      if (action.type === 'FunctionCall') {
        expect(action.methodName).toBe('ft_transfer')
        expect(action.gas).toBe('30000000000000')
        expect(action.deposit).toBe('1')

        const decoded = JSON.parse(Buffer.from(action.args, 'base64').toString())
        expect(decoded.amount).toBe(amount)
        expect(decoded.memo).toBe('SIP private transfer')
        expect(typeof decoded.receiver_id).toBe('string')
      }
    }
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/chain-transfer-builder -- --run
```

Expected: 2 NEAR tests pass on top of previous tests.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add tests/chain-transfer-builder.test.ts
git commit -m "test(chain-transfer-builder): add NEAR branch tests (2)"
```

---

## Task 10: Add `chain-transfer-builder` error + curve detection tests (2 tests)

**Files:**
- Modify: `tests/chain-transfer-builder.test.ts`
- Reference (read-only): `src/services/chain-transfer-builder.ts:122, 147-149`

- [ ] **Step 1: Append the error / curve test group**

Append at the end of `tests/chain-transfer-builder.test.ts`:

```typescript
describe('buildPrivateTransfer — error + curve detection', () => {
  it('throws on unsupported chain', async () => {
    await expect(
      buildPrivateTransfer({
        sender,
        recipientMetaAddress: {
          spendingKey: SOLANA_SPENDING_KEY,
          viewingKey: SOLANA_VIEWING_KEY,
          chain: 'bitcoin',
        },
        amount: '1000',
      })
    ).rejects.toThrow(/Unsupported transfer chain/)
  })

  it.each([
    ['solana', 'ed25519' as const, SOLANA_SPENDING_KEY, SOLANA_VIEWING_KEY],
    ['near', 'ed25519' as const, SOLANA_SPENDING_KEY, SOLANA_VIEWING_KEY],
    ['ethereum', 'secp256k1' as const, EVM_SPENDING_KEY, EVM_VIEWING_KEY],
    ['polygon', 'secp256k1' as const, EVM_SPENDING_KEY, EVM_VIEWING_KEY],
    ['arbitrum', 'secp256k1' as const, EVM_SPENDING_KEY, EVM_VIEWING_KEY],
    ['optimism', 'secp256k1' as const, EVM_SPENDING_KEY, EVM_VIEWING_KEY],
    ['base', 'secp256k1' as const, EVM_SPENDING_KEY, EVM_VIEWING_KEY],
  ])('returns curve=%s for chain=%s', async (chain, expectedCurve, spendingKey, viewingKey) => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey,
        viewingKey,
        chain,
      },
      amount: '1000',
    })

    expect(result.curve).toBe(expectedCurve)
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/chain-transfer-builder -- --run
```

Expected: 1 error test + 7 parameterized curve tests pass on top of previous tests.

- [ ] **Step 3: Verify typecheck and full root suite**

```bash
pnpm typecheck
pnpm test -- --run 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add tests/chain-transfer-builder.test.ts
git commit -m "test(chain-transfer-builder): add error + curve detection tests (2)"
```

---

## Task 11: Add `private-swap-builder` happy path tests (3 tests)

**Files:**
- Create: `tests/private-swap-builder.test.ts`
- Reference (read-only): `src/services/private-swap-builder.ts:66-172`

- [ ] **Step 1: Create the test file with happy path tests**

Create `tests/private-swap-builder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeJupiterQuote, makeJupiterSwapTx, mockCSPLService } from './fixtures/builder-mocks.js'

// Mock jupiter-provider — must be hoisted before importing the builder
vi.mock('../src/services/jupiter-provider.js', () => ({
  getQuote: vi.fn(),
  buildSwapTransaction: vi.fn(),
}))

// Mock cspl — default to success
vi.mock('../src/services/cspl.js', () => ({
  getCSPLService: vi.fn().mockResolvedValue({
    wrap: vi.fn().mockResolvedValue({ success: false }),
  }),
}))

const jupiterProvider = await import('../src/services/jupiter-provider.js')
const csplModule = await import('../src/services/cspl.js')

const { buildPrivateSwap } = await import('../src/services/private-swap-builder.js')

const sender = 'SenderAddrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// Realistic 32-byte ed25519 hex pubkey for Solana
const PROVIDED_SPENDING_KEY = '0x' + 'a'.repeat(64)
const PROVIDED_VIEWING_KEY = '0x' + 'b'.repeat(64)

describe('buildPrivateSwap — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jupiterProvider.getQuote).mockResolvedValue(makeJupiterQuote())
    vi.mocked(jupiterProvider.buildSwapTransaction).mockResolvedValue(makeJupiterSwapTx())
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('fail') as never)
  })

  it('with provided meta-address → uses it (not ephemeral)', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
      recipientMetaAddress: {
        spendingKey: PROVIDED_SPENDING_KEY,
        viewingKey: PROVIDED_VIEWING_KEY,
        chain: 'solana',
      },
    })

    // viewingKeyHash should derive from PROVIDED_VIEWING_KEY (not ephemeral)
    expect(result.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
    // ephemeral viewing key hash uses input "ephemeral-" + address
    // we verify by recomputing what provided-key hash should be in Task 14
    expect(result.outputStealthAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/) // base58
  })

  it('without meta-address → generates ephemeral meta-address', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    expect(result.outputStealthAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    expect(result.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('returns expected PrivateSwapResult shape', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    // Privacy artifacts
    expect(result).toHaveProperty('outputStealthAddress')
    expect(result).toHaveProperty('ephemeralPublicKey')
    expect(result).toHaveProperty('viewTag')
    expect(result).toHaveProperty('commitment')
    expect(result).toHaveProperty('blindingFactor')
    expect(result).toHaveProperty('viewingKeyHash')
    expect(result).toHaveProperty('sharedSecret')

    // Swap details
    expect(result.inputMint).toBe(SOL_MINT)
    expect(result.outputMint).toBe(USDC_MINT)
    expect(result.inputAmount).toBe('1000000000')
    expect(result.outputAmount).toBe('150000000')
    expect(result.quoteId).toBe('jup_test_quote_001')
    expect(result.slippageBps).toBe(50)

    // Transaction bundle
    expect(Array.isArray(result.transactions)).toBe(true)
    expect(Array.isArray(result.executionOrder)).toBe(true)
    expect(typeof result.estimatedComputeUnits).toBe('number')

    // C-SPL status
    expect(typeof result.csplWrapped).toBe('boolean')
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/private-swap-builder -- --run
```

Expected: 3 tests pass.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add tests/private-swap-builder.test.ts
git commit -m "test(private-swap-builder): add happy path tests (3)"
```

---

## Task 12: Add `private-swap-builder` C-SPL branch tests (3 tests)

**Files:**
- Modify: `tests/private-swap-builder.test.ts`
- Reference (read-only): `src/services/private-swap-builder.ts:108-131, 147`

- [ ] **Step 1: Append the C-SPL branch test group**

Append at the end of `tests/private-swap-builder.test.ts`:

```typescript
describe('buildPrivateSwap — C-SPL branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jupiterProvider.getQuote).mockResolvedValue(makeJupiterQuote())
    vi.mocked(jupiterProvider.buildSwapTransaction).mockResolvedValue(makeJupiterSwapTx())
  })

  it('CSPL wrap succeeds → wrap tx in bundle, csplWrapped=true, computeUnits=400_000', async () => {
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('success') as never)

    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    expect(result.csplWrapped).toBe(true)
    expect(result.estimatedComputeUnits).toBe(400_000)
    expect(result.transactions[0].type).toBe('wrap')
    expect(result.executionOrder).toContain('wrap')
    expect(result.executionOrder).toContain('swap')
  })

  it('CSPL returns {success: false} → no wrap tx, csplWrapped=false, computeUnits=200_000', async () => {
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('fail') as never)

    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    expect(result.csplWrapped).toBe(false)
    expect(result.estimatedComputeUnits).toBe(200_000)
    expect(result.executionOrder).not.toContain('wrap')
    expect(result.transactions.every(tx => tx.type !== 'wrap')).toBe(true)
  })

  it('CSPL throws → silently caught, no wrap tx, csplWrapped=false, computeUnits=200_000', async () => {
    vi.mocked(csplModule.getCSPLService).mockRejectedValue(new Error('CSPL service down'))

    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    expect(result.csplWrapped).toBe(false)
    expect(result.estimatedComputeUnits).toBe(200_000)
    expect(result.executionOrder).not.toContain('wrap')
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/private-swap-builder -- --run
```

Expected: 6 tests pass total (3 happy + 3 CSPL).

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add tests/private-swap-builder.test.ts
git commit -m "test(private-swap-builder): add C-SPL branch tests (3)"
```

---

## Task 13: Add `private-swap-builder` stealth + commitment invariant tests (2 tests)

**Files:**
- Modify: `tests/private-swap-builder.test.ts`
- Reference (read-only): `src/services/private-swap-builder.ts:84-97`

- [ ] **Step 1: Append the stealth + commitment test group**

Append at the end of `tests/private-swap-builder.test.ts`:

```typescript
describe('buildPrivateSwap — stealth + commitment invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jupiterProvider.getQuote).mockResolvedValue(makeJupiterQuote())
    vi.mocked(jupiterProvider.buildSwapTransaction).mockResolvedValue(makeJupiterSwapTx())
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('fail') as never)
  })

  it('outputStealthAddress is a valid base58 Solana address (32 bytes)', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    // base58 Solana addresses are 32-44 chars
    expect(result.outputStealthAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)

    // Validate by reconstructing PublicKey (will throw if invalid)
    const { PublicKey } = await import('@solana/web3.js')
    expect(() => new PublicKey(result.outputStealthAddress)).not.toThrow()
    expect(new PublicKey(result.outputStealthAddress).toBytes()).toHaveLength(32)
  })

  it('commitment is 33-byte compressed point hex; blindingFactor is 32-byte hex', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    // commitment: 0x + 66 hex chars (33 bytes)
    expect(result.commitment).toMatch(/^0x[0-9a-f]{66}$/)

    // First byte after 0x must be 02 or 03 (compressed point prefix)
    const prefix = result.commitment.slice(2, 4)
    expect(['02', '03']).toContain(prefix)

    // blindingFactor: 0x + 64 hex chars (32 bytes)
    expect(result.blindingFactor).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/private-swap-builder -- --run
```

Expected: 8 tests pass total (3 happy + 3 CSPL + 2 stealth/commitment).

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add tests/private-swap-builder.test.ts
git commit -m "test(private-swap-builder): add stealth + commitment invariant tests (2)"
```

---

## Task 14: Add `private-swap-builder` viewing key hash tests (2 tests)

**Files:**
- Modify: `tests/private-swap-builder.test.ts`
- Reference (read-only): `src/services/private-swap-builder.ts:99-106`

- [ ] **Step 1: Append the viewing key hash test group**

Append at the end of `tests/private-swap-builder.test.ts`:

```typescript
describe('buildPrivateSwap — viewing key hash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jupiterProvider.getQuote).mockResolvedValue(makeJupiterQuote())
    vi.mocked(jupiterProvider.buildSwapTransaction).mockResolvedValue(makeJupiterSwapTx())
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('fail') as never)
  })

  it('with provided meta-address → vkHash = 0x + sha256(viewingKey bytes)', async () => {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { hexToBytes, bytesToHex } = await import('@noble/hashes/utils')

    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
      recipientMetaAddress: {
        spendingKey: PROVIDED_SPENDING_KEY,
        viewingKey: PROVIDED_VIEWING_KEY,
        chain: 'solana',
      },
    })

    const viewingKeyBytes = hexToBytes(PROVIDED_VIEWING_KEY.slice(2))
    const expectedHash = `0x${bytesToHex(sha256(viewingKeyBytes))}`

    expect(result.viewingKeyHash).toBe(expectedHash)
  })

  it('without meta-address → vkHash = 0x + sha256("ephemeral-" + outputStealthAddress)', async () => {
    const { sha256 } = await import('@noble/hashes/sha256')
    const { bytesToHex } = await import('@noble/hashes/utils')

    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    const expectedHash = `0x${bytesToHex(sha256(new TextEncoder().encode('ephemeral-' + result.outputStealthAddress)))}`

    expect(result.viewingKeyHash).toBe(expectedHash)
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd ~/local-dev/sipher
pnpm test tests/private-swap-builder -- --run
```

Expected: 10 tests pass total.

- [ ] **Step 3: Verify typecheck and full root suite**

```bash
pnpm typecheck
pnpm test -- --run 2>&1 | tail -10
```

Expected: typecheck clean; root suite green (33 + 3 = 36 files).

- [ ] **Step 4: Commit**

```bash
git add tests/private-swap-builder.test.ts
git commit -m "test(private-swap-builder): add viewing key hash tests (2)"
```

---

## Task 15: Bump test count baseline in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (find the "Test Suite" section, update the per-package counts)

- [ ] **Step 1: Locate the test count line**

```bash
cd ~/local-dev/sipher
grep -n "REST" CLAUDE.md | head -10
```

Expected: shows the line(s) referencing REST test counts.

- [ ] **Step 2: Get the current and new test counts**

```bash
pnpm test -- --run 2>&1 | grep -E "Tests|Test Files"
```

Expected: shows actual file count (should be 36) and total test count.

Record these numbers — they go into the diff in the next step.

- [ ] **Step 3: Update CLAUDE.md**

Edit `CLAUDE.md` to bump the REST test count. Find the line that currently says something like:

```
**Stats:** 58 REST + 22 agent tools + 9 HERALD tools + 14 SENTINEL tools + Command Center UI | 497 REST + 912 agent tests | 17 chains
```

Update the REST test count to the new number from Step 2 (e.g., 497 → 497+37 ≈ 534, exact number depends on actual `pnpm test` output).

- [ ] **Step 4: Run typecheck (no impact, but sanity check)**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: bump test count baseline in CLAUDE.md"
```

---

## Task 16: Final verification + open PR

**Files:** None modified — pre-PR checklist + PR open

- [ ] **Step 1: Full pre-PR verification**

```bash
cd ~/local-dev/sipher
pnpm test -- --run                          # full root suite
pnpm --filter @sipher/agent test -- --run   # agent baseline 938 unchanged
pnpm --filter @sipher/app test -- --run     # app baseline 45 unchanged
pnpm typecheck                              # workspace
```

Expected:
- Root suite: 36 files pass, ~37 new tests
- Agent: 938 tests pass (unchanged)
- App: 45 tests pass (unchanged)
- Typecheck: no errors

- [ ] **Step 2: Run Playwright E2E (if cipher-admin keypair available)**

```bash
pnpm exec playwright test
```

Expected: 8/8 + 2 skipped (cipher-admin gate).

- [ ] **Step 3: Sanity-check scope**

```bash
git diff main --stat
```

Expected: only test files + spec + plan + CLAUDE.md baseline. No source changes to `src/services/*.ts`.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/phase-4-rest-service-tests
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "test(phase-4): add unit tests for 3 REST service builders" --body "$(cat <<'EOF'
## Summary

Phase 4 of the audit-driven plan — adds isolated unit-level test coverage for the 3 builder modules under `src/services/`:

- `transaction-builder.ts` (14 tests covering buildShieldedSolTransfer, buildShieldedSplTransfer, buildAnchorShieldedSolTransfer)
- `chain-transfer-builder.ts` (13 tests across helpers + 4 chain branches + error/curve detection)
- `private-swap-builder.ts` (10 tests across happy path, C-SPL fallback, stealth/commitment invariants, viewing key hash)

## Architecture

- 3 new test files in root `tests/`
- 1 shared fixture file at `tests/fixtures/builder-mocks.ts`
- Real `@sip-protocol/sdk` (no mocks)
- Mocks at module boundaries: `@solana/web3.js` Connection, `./jupiter-provider.js`, `./cspl.js`
- Dealer strategy by layer: fixed-byte inputs for `transaction-builder` (no randomness inside), invariants for the two orchestrators

## Spec / plan

- Spec: `docs/superpowers/specs/2026-05-03-rest-service-tests-design.md`
- Plan: `docs/superpowers/plans/2026-05-03-rest-service-tests.md`

## Test plan

- [x] Root suite: 33 → 36 files, ~37 new tests, all green via `pnpm test -- --run`
- [x] Agent baseline (938) unchanged
- [x] App baseline (45) unchanged
- [x] `pnpm typecheck` clean
- [x] No source changes to `src/services/*.ts` (test-only PR)

## Out of scope (per spec)

- Tests for other `src/services/*.ts` files (jupiter-provider, cspl, redis, etc.)
- Modifying existing route tests (`tests/private-swap.test.ts`, `tests/transfer-shield.test.ts`)
- Source-code refactors

## Follow-up issues (if any discovered during execution)

To be filled in after the implementing subagent runs.
EOF
)"
```

Expected: PR opened against `main`.

- [ ] **Step 6: Mark plan complete**

Update `docs/superpowers/specs/2026-05-03-rest-service-tests-design.md` "Phase 4 Lessons to Carry Forward" section with any lessons learned during execution.

---

## Summary

**Tasks:** 16 (1 plan commit + 1 fixture + 12 test groups + 1 baseline bump + 1 PR)
**Estimated test count:** 37 tests (3 + 4 + 7 + 3 + 3 + 3 + 2 + 2 + 3 + 3 + 2 + 2 = 37)
**Files created:** 4 (1 spec, 1 plan, 1 fixture, 3 test files — total 6 files; spec + plan committed in Tasks 1 + already done)
**Files modified:** 1 (CLAUDE.md)
**Commits:** ~16 (matches spec's commit cadence)
**PR:** 1 vs `main`

**Verification commands (final):**
```bash
pnpm test -- --run                          # 36 files green
pnpm --filter @sipher/agent test -- --run   # 938 unchanged
pnpm --filter @sipher/app test -- --run     # 45 unchanged
pnpm typecheck                              # clean
```

---

**Plan status:** Ready for execution via `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`.
