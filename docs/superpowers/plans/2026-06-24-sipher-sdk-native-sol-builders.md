# Native-SOL Transaction Builders for `@sipher/sdk` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native-SOL transaction builders to `@sipher/sdk`, mirroring the existing SPL builders, so consumers can drive the vault's `deposit_sol` / `withdraw_private_sol` / `refund_sol` / `authority_refund_sol` instructions.

**Architecture:** Purely additive. Two new modules — `src/vault-sol.ts` (deposit/refund/authority-refund + SOL PDA derivations) and `src/privacy-sol.ts` (stealth withdraw) — plus three constants in `config.ts` and two result types in `types.ts`, all re-exported from the barrel. No existing export or signature changes. Native-SOL balance reads reuse the existing `getVaultBalance(…, NATIVE_SOL_MINT)`.

**Tech Stack:** TypeScript (ESM), `@solana/web3.js`, Vitest. Spec: `docs/superpowers/specs/2026-06-24-sipher-sdk-native-sol-builders-design.md`.

## Global Constraints

- **Style:** 2-space indent, **no semicolons**, explicit types on public APIs (match existing SDK files exactly).
- **ESM:** every relative import uses the `.js` extension (e.g. `from './config.js'`).
- **Additive only:** do NOT change any existing export, signature, or behavior.
- **Naming gate (repo is PUBLIC):** code, comments, and commit messages stay generic. No partner / integration / product-codename references anywhere.
- **Account orders + instruction-data layouts are byte-exact** from the spec §4 tables (taken from `programs/sipher-vault/programs/sipher-vault/src/lib.rs`). A reordered or mis-flagged account is the most likely defect — assert the full `keys` array.
- **Tests:** Vitest, pure unit. Mock `Connection` via `{ ...stubs } as unknown as Connection`. No live RPC, no bankrun.
- **Commits:** conventional, GPG-signed (`git commit -S`), **no AI attribution** (no `Co-Authored-By`, no tool footer).
- **Working directory:** the isolated worktree at `/Users/rector/local-dev/sipher-worktrees/sdk-native-sol-builders`, package `packages/sdk`. Branch `feat/sdk-native-sol-builders`.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/sdk/src/config.ts` | `NATIVE_SOL_MINT`, `VAULT_SOL_SEED`, `FEE_SOL_SEED` | Modify |
| `packages/sdk/src/types.ts` | `SolDepositResult`, `SolRefundResult` | Modify |
| `packages/sdk/src/vault-sol.ts` | SOL PDA derivations + deposit/refund/authority-refund/create-sol-vault builders | Create |
| `packages/sdk/src/privacy-sol.ts` | `buildPrivateSendSolTx` + `PrivateSendSolParams` | Create |
| `packages/sdk/src/index.ts` | Barrel re-exports of all new symbols | Modify |
| `packages/sdk/tests/vault-sol.test.ts` | Unit tests: constants, PDAs, deposit/refund/authority-refund/create-sol-vault | Create |
| `packages/sdk/tests/privacy-sol.test.ts` | Unit tests: `buildPrivateSendSolTx` incl. rent-exempt guard | Create |

---

## Setup (run once, before Task 1)

- [ ] **Install deps in the worktree** (a fresh worktree has no `node_modules`):

Run (from the worktree root):
```bash
cd /Users/rector/local-dev/sipher-worktrees/sdk-native-sol-builders
pnpm install
```
Expected: install completes (pnpm hardlinks from the global store; fast). All subsequent commands run from `packages/sdk`.

---

## Task 1: Native-SOL constants + SOL PDA derivations

**Files:**
- Modify: `packages/sdk/src/config.ts`
- Create: `packages/sdk/src/vault-sol.ts`
- Modify: `packages/sdk/src/index.ts`
- Test: `packages/sdk/tests/vault-sol.test.ts`

**Interfaces:**
- Consumes: `SIPHER_VAULT_PROGRAM_ID` (config.ts).
- Produces: `NATIVE_SOL_MINT: PublicKey`, `VAULT_SOL_SEED: Buffer`, `FEE_SOL_SEED: Buffer`; `deriveSolVaultPDA(programId?: PublicKey): [PublicKey, number]`, `deriveSolFeePDA(programId?: PublicKey): [PublicKey, number]`.

- [ ] **Step 1: Write the failing test** — create `packages/sdk/tests/vault-sol.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import {
  NATIVE_SOL_MINT,
  VAULT_SOL_SEED,
  FEE_SOL_SEED,
  deriveSolVaultPDA,
  deriveSolFeePDA,
} from '../src/index.js'

describe('native-SOL constants', () => {
  it('NATIVE_SOL_MINT is the all-zeros sentinel (not wSOL)', () => {
    expect(NATIVE_SOL_MINT.toBase58()).toBe('11111111111111111111111111111111')
    expect(NATIVE_SOL_MINT.toBytes().every((b) => b === 0)).toBe(true)
  })

  it('SOL vault seeds match the on-chain constants', () => {
    expect(VAULT_SOL_SEED.toString()).toBe('vault_sol')
    expect(FEE_SOL_SEED.toString()).toBe('fee_sol')
  })
})

describe('native-SOL PDA derivation', () => {
  it('deriveSolVaultPDA matches the live devnet SolVault', () => {
    const [pda] = deriveSolVaultPDA()
    expect(pda.toBase58()).toBe('8ZG46epBDrRbZ2oDneuemmSuQNNG3R58LhFo8Do2p6sq')
  })

  it('deriveSolFeePDA matches the live devnet SolFee', () => {
    const [pda] = deriveSolFeePDA()
    expect(pda.toBase58()).toBe('519L2NQN16H1fnN9iPu2r2ipmjPj156yWMPQumw8PkZ4')
  })

  it('derivations honor a programId override', () => {
    const custom = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    const [vault] = deriveSolVaultPDA(custom)
    const [expected] = PublicKey.findProgramAddressSync([VAULT_SOL_SEED], custom)
    expect(vault.equals(expected)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/vault-sol.test.ts`
Expected: FAIL — `NATIVE_SOL_MINT`/`deriveSolVaultPDA` are not exported (import error).

- [ ] **Step 3: Add the constants to `config.ts`** — insert after the existing `FEE_TOKEN_SEED` line (the token-seed block, ~line 25):

```ts
// Native-SOL sentinel mint. The vault seeds the native-SOL DepositRecord with the
// all-zeros pubkey (on-chain: Pubkey::new_from_array([0u8; 32])). This is NOT wrapped
// SOL — WSOL_MINT (So111…112) is a real SPL mint used by the token path; the native
// path never wraps. Keep the two distinct.
export const NATIVE_SOL_MINT = new PublicKey(new Uint8Array(32))

// Native-SOL vault PDA seeds (must match on-chain constants.rs exactly)
export const VAULT_SOL_SEED = Buffer.from('vault_sol')
export const FEE_SOL_SEED = Buffer.from('fee_sol')
```

- [ ] **Step 4: Create `vault-sol.ts`** with the PDA derivations:

```ts
import { PublicKey } from '@solana/web3.js'
import {
  SIPHER_VAULT_PROGRAM_ID,
  VAULT_SOL_SEED,
  FEE_SOL_SEED,
} from './config.js'

// ─────────────────────────────────────────────────────────────────────────────
// Native-SOL PDA derivation
//
// The native-SOL DepositRecord uses the EXISTING deriveDepositRecordPDA helper
// with NATIVE_SOL_MINT as the mint seed — no dedicated helper is needed here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the singleton SolVault PDA (holds native lamports).
 * Seeds: [b"vault_sol"]
 */
export function deriveSolVaultPDA(
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SOL_SEED], programId)
}

/**
 * Derive the singleton SolFee PDA (native-SOL fee sink).
 * Seeds: [b"fee_sol"]
 */
export function deriveSolFeePDA(
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FEE_SOL_SEED], programId)
}
```

- [ ] **Step 5: Export from the barrel** — in `src/index.ts`, add `NATIVE_SOL_MINT`, `VAULT_SOL_SEED`, `FEE_SOL_SEED` to the existing `export { … } from './config.js'` block, and add a new block after the `from './vault.js'` block:

```ts
// Native-SOL vault operations
export {
  deriveSolVaultPDA,
  deriveSolFeePDA,
} from './vault-sol.js'
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/vault-sol.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/src/config.ts packages/sdk/src/vault-sol.ts packages/sdk/src/index.ts packages/sdk/tests/vault-sol.test.ts
git commit -S -m "feat(sdk): native-SOL sentinel mint + SolVault/SolFee PDA derivation"
```

---

## Task 2: `buildDepositSolTx`

**Files:**
- Modify: `packages/sdk/src/types.ts`
- Modify: `packages/sdk/src/vault-sol.ts`
- Modify: `packages/sdk/src/index.ts`
- Test: `packages/sdk/tests/vault-sol.test.ts`

**Interfaces:**
- Consumes: `deriveSolVaultPDA` (Task 1); `deriveVaultConfigPDA`, `deriveDepositRecordPDA`, `anchorDiscriminator` (vault.ts); `NATIVE_SOL_MINT` (config.ts).
- Produces: `SolDepositResult { transaction, depositRecordAddress, solVaultAddress, amount }`; `buildDepositSolTx(connection, depositor, amount, programId?): Promise<SolDepositResult>`.

- [ ] **Step 1: Write the failing test** — append to `tests/vault-sol.test.ts`:

```ts
// Add these as NEW import statements at the top of the file, alongside Task 1's
// imports. Do NOT re-import names already imported in Task 1 (`PublicKey`,
// `NATIVE_SOL_MINT`, `deriveSolVaultPDA`) — multiple disjoint imports from the same
// module are legal; a duplicated binding is a compile error.
import { Connection, SystemProgram } from '@solana/web3.js'
import {
  buildDepositSolTx,
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
  anchorDiscriminator,
  SIPHER_VAULT_PROGRAM_ID,
} from '../src/index.js'

const BLOCKHASH = 'GfVcyD4kkTrj4bKc7WA9sZCin9JDbdT458zqL4zjxx2v'
const DEPOSITOR = new PublicKey('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr')

// Minimal Connection stub: only getLatestBlockhash is exercised by the deposit builder.
function mockConnDeposit(): Connection {
  return {
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
  } as unknown as Connection
}

describe('buildDepositSolTx', () => {
  it('builds deposit_sol with the exact DepositSol account order + flags', async () => {
    const res = await buildDepositSolTx(mockConnDeposit(), DEPOSITOR, 5_000_000n)
    const ix = res.transaction.instructions[0]

    const [config] = deriveVaultConfigPDA()
    const [record] = deriveDepositRecordPDA(DEPOSITOR, NATIVE_SOL_MINT)
    const [solVault] = deriveSolVaultPDA()

    expect(ix.programId.equals(SIPHER_VAULT_PROGRAM_ID)).toBe(true)
    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      record.toBase58(),
      solVault.toBase58(),
      DEPOSITOR.toBase58(),
      SystemProgram.programId.toBase58(),
    ])
    expect(ix.keys.map((k) => k.isSigner)).toEqual([false, false, false, true, false])
    expect(ix.keys.map((k) => k.isWritable)).toEqual([true, true, true, true, false])
  })

  it('encodes discriminator + amount and sets feePayer/blockhash', async () => {
    const res = await buildDepositSolTx(mockConnDeposit(), DEPOSITOR, 5_000_000n)
    const data = res.transaction.instructions[0].data
    expect(data.length).toBe(16)
    expect(data.subarray(0, 8).equals(anchorDiscriminator('deposit_sol'))).toBe(true)
    expect(data.readBigUInt64LE(8)).toBe(5_000_000n)
    expect(res.transaction.feePayer?.toBase58()).toBe(DEPOSITOR.toBase58())
    expect(res.transaction.recentBlockhash).toBe(BLOCKHASH)
    expect(res.amount).toBe(5_000_000n)
    expect(res.solVaultAddress.equals(deriveSolVaultPDA()[0])).toBe(true)
  })

  it('rejects a non-positive amount', async () => {
    await expect(buildDepositSolTx(mockConnDeposit(), DEPOSITOR, 0n)).rejects.toThrow(
      'amount must be greater than zero',
    )
  })
})
```

> `NATIVE_SOL_MINT` and `deriveSolVaultPDA` are already imported (Task 1); the test body uses them directly — do not re-import them.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/vault-sol.test.ts -t buildDepositSolTx`
Expected: FAIL — `buildDepositSolTx` not exported.

- [ ] **Step 3: Add the result type to `types.ts`** — after the existing `DepositResult` interface:

```ts
export interface SolDepositResult {
  /** Unsigned transaction — caller signs with their wallet */
  transaction: Transaction
  /** The deposit record PDA (seeded by NATIVE_SOL_MINT) */
  depositRecordAddress: PublicKey
  /** The SolVault PDA that receives the lamports */
  solVaultAddress: PublicKey
  /** Amount in lamports */
  amount: bigint
}
```

- [ ] **Step 4: Implement `buildDepositSolTx`** — add to `vault-sol.ts` (extend the imports as shown, then append the function):

```ts
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  SIPHER_VAULT_PROGRAM_ID,
  VAULT_SOL_SEED,
  FEE_SOL_SEED,
  NATIVE_SOL_MINT,
} from './config.js'
import {
  anchorDiscriminator,
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
} from './vault.js'
import type { SolDepositResult } from './types.js'
```

```ts
/**
 * Build an unsigned native-SOL deposit transaction (deposit_sol).
 *
 * Accounts (order matches the DepositSol context in lib.rs):
 *   0. config         (mut)         — VaultConfig PDA
 *   1. deposit_record (mut)         — DepositRecord PDA [.., depositor, NATIVE_SOL_MINT]
 *   2. sol_vault      (mut)         — SolVault PDA
 *   3. depositor      (mut, signer)
 *   4. system_program (ro)
 */
export async function buildDepositSolTx(
  connection: Connection,
  depositor: PublicKey,
  amount: bigint,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<SolDepositResult> {
  if (amount <= 0n) {
    throw new Error('Deposit amount must be greater than zero')
  }

  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)

  // disc(8) + amount(u64 LE, 8) = 16 bytes
  const data = Buffer.alloc(16)
  anchorDiscriminator('deposit_sol').copy(data, 0)
  data.writeBigUInt64LE(amount, 8)

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = depositor

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return {
    transaction: tx,
    depositRecordAddress: depositRecordPDA,
    solVaultAddress: solVaultPDA,
    amount,
  }
}
```

- [ ] **Step 5: Export from the barrel** — add `buildDepositSolTx` to the `./vault-sol.js` export block in `index.ts`, and add `SolDepositResult` to the `export type { … } from './types.js'` block.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/vault-sol.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/src/types.ts packages/sdk/src/vault-sol.ts packages/sdk/src/index.ts packages/sdk/tests/vault-sol.test.ts
git commit -S -m "feat(sdk): buildDepositSolTx for native-SOL deposits"
```

---

## Task 3: `buildRefundSolTx` + `buildAuthorityRefundSolTx`

**Files:**
- Modify: `packages/sdk/src/types.ts`
- Modify: `packages/sdk/src/vault-sol.ts`
- Modify: `packages/sdk/src/index.ts`
- Test: `packages/sdk/tests/vault-sol.test.ts`

**Interfaces:**
- Consumes: `deriveSolVaultPDA` (Task 1); `deserializeDepositRecord`, `deriveVaultConfigPDA`, `deriveDepositRecordPDA`, `anchorDiscriminator` (vault.ts).
- Produces: `SolRefundResult { transaction, refundAmount, depositorAddress }`; `buildRefundSolTx(connection, depositor, programId?): Promise<SolRefundResult>`; `buildAuthorityRefundSolTx(connection, authority, depositor, programId?): Promise<SolRefundResult>`.

- [ ] **Step 1: Write the failing test** — append to `tests/vault-sol.test.ts`:

```ts
import {
  buildRefundSolTx,
  buildAuthorityRefundSolTx,
} from '../src/index.js'

const AUTHORITY = new PublicKey('S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd')

// DepositRecord buffer: 8 disc + depositor(32) + mint(32) + balance(8)
// + cumulative(8) + last_deposit(8) + bump(1) = 97 bytes. balance at offset 72.
function depositRecordBuf(balance: bigint): Buffer {
  const buf = Buffer.alloc(8 + 89)
  buf.writeBigUInt64LE(balance, 72)
  return buf
}

function mockConnRefund(recordBuf: Buffer | null): Connection {
  return {
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
    getAccountInfo: async () => (recordBuf ? ({ data: recordBuf } as never) : null),
  } as unknown as Connection
}

describe('buildRefundSolTx', () => {
  it('builds refund_sol with the exact RefundSol account order + flags', async () => {
    const res = await buildRefundSolTx(mockConnRefund(depositRecordBuf(3_000_000n)), DEPOSITOR)
    const ix = res.transaction.instructions[0]
    const [config] = deriveVaultConfigPDA()
    const [record] = deriveDepositRecordPDA(DEPOSITOR, NATIVE_SOL_MINT)
    const [solVault] = deriveSolVaultPDA()

    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      record.toBase58(),
      solVault.toBase58(),
      DEPOSITOR.toBase58(),
    ])
    expect(ix.keys.map((k) => k.isSigner)).toEqual([false, false, false, true])
    expect(ix.keys.map((k) => k.isWritable)).toEqual([false, true, true, true])
    expect(ix.data.equals(anchorDiscriminator('refund_sol'))).toBe(true)
    expect(res.refundAmount).toBe(3_000_000n)
    expect(res.depositorAddress.toBase58()).toBe(DEPOSITOR.toBase58())
  })

  it('throws when there is no deposit record', async () => {
    await expect(buildRefundSolTx(mockConnRefund(null), DEPOSITOR)).rejects.toThrow(
      'nothing to refund',
    )
  })

  it('throws when the balance is zero', async () => {
    await expect(
      buildRefundSolTx(mockConnRefund(depositRecordBuf(0n)), DEPOSITOR),
    ).rejects.toThrow('No balance to refund')
  })
})

describe('buildAuthorityRefundSolTx', () => {
  it('makes authority the signer and depositor a non-signer destination', async () => {
    const res = await buildAuthorityRefundSolTx(
      mockConnRefund(depositRecordBuf(4_000_000n)),
      AUTHORITY,
      DEPOSITOR,
    )
    const ix = res.transaction.instructions[0]
    const [config] = deriveVaultConfigPDA()
    const [record] = deriveDepositRecordPDA(DEPOSITOR, NATIVE_SOL_MINT)
    const [solVault] = deriveSolVaultPDA()

    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      record.toBase58(),
      solVault.toBase58(),
      DEPOSITOR.toBase58(),
      AUTHORITY.toBase58(),
    ])
    expect(ix.keys.map((k) => k.isSigner)).toEqual([false, false, false, false, true])
    expect(ix.keys.map((k) => k.isWritable)).toEqual([false, true, true, true, true])
    expect(ix.data.equals(anchorDiscriminator('authority_refund_sol'))).toBe(true)
    expect(res.transaction.feePayer?.toBase58()).toBe(AUTHORITY.toBase58())
    expect(res.refundAmount).toBe(4_000_000n)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/vault-sol.test.ts -t Sol`
Expected: FAIL — `buildRefundSolTx` / `buildAuthorityRefundSolTx` not exported.

- [ ] **Step 3: Add the result type to `types.ts`** — after `RefundResult`:

```ts
export interface SolRefundResult {
  transaction: Transaction
  /** Amount being refunded (the depositor's available balance, in lamports) */
  refundAmount: bigint
  /** The depositor's main (system) account receiving the lamports */
  depositorAddress: PublicKey
}
```

- [ ] **Step 4: Implement both builders** — in `vault-sol.ts`, add `deserializeDepositRecord` to the `from './vault.js'` import, add `SolRefundResult` to the `from './types.js'` import, then append:

```ts
/**
 * Build an unsigned native-SOL refund transaction (refund_sol). Depositor signs.
 *
 * Accounts (order matches the RefundSol context in lib.rs):
 *   0. config         (ro)          — VaultConfig PDA
 *   1. deposit_record (mut)         — DepositRecord PDA [.., depositor, NATIVE_SOL_MINT]
 *   2. sol_vault      (mut)         — SolVault PDA
 *   3. depositor      (mut, signer)
 */
export async function buildRefundSolTx(
  connection: Connection,
  depositor: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<SolRefundResult> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)

  const recordInfo = await connection.getAccountInfo(depositRecordPDA)
  if (!recordInfo) {
    throw new Error('No deposit record found — nothing to refund')
  }
  const record = deserializeDepositRecord(Buffer.from(recordInfo.data))
  const refundAmount = record.balance
  if (refundAmount <= 0n) {
    throw new Error('No balance to refund')
  }

  const data = anchorDiscriminator('refund_sol')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = depositor

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return { transaction: tx, refundAmount, depositorAddress: depositor }
}

/**
 * Build an unsigned authority-signed native-SOL refund (authority_refund_sol).
 * The authority signs on the depositor's behalf; the depositor is a non-signer
 * lamport destination. The on-chain `has_one = depositor` guarantees principal
 * returns to the original depositor, and the timeout is still enforced on-chain.
 *
 * Accounts (order matches the AuthorityRefundSol context in lib.rs):
 *   0. config         (ro)          — VaultConfig PDA (has_one = authority)
 *   1. deposit_record (mut)         — DepositRecord PDA [.., depositor, NATIVE_SOL_MINT]
 *   2. sol_vault      (mut)         — SolVault PDA
 *   3. depositor      (mut)         — NOT signer; validated by has_one
 *   4. authority      (mut, signer)
 */
export async function buildAuthorityRefundSolTx(
  connection: Connection,
  authority: PublicKey,
  depositor: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<SolRefundResult> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)

  const recordInfo = await connection.getAccountInfo(depositRecordPDA)
  if (!recordInfo) {
    throw new Error('No deposit record found — nothing to refund')
  }
  const record = deserializeDepositRecord(Buffer.from(recordInfo.data))
  const refundAmount = record.balance
  if (refundAmount <= 0n) {
    throw new Error('No balance to refund')
  }

  const data = anchorDiscriminator('authority_refund_sol')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = authority

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return { transaction: tx, refundAmount, depositorAddress: depositor }
}
```

- [ ] **Step 5: Export from the barrel** — add `buildRefundSolTx`, `buildAuthorityRefundSolTx` to the `./vault-sol.js` block, and `SolRefundResult` to the `export type { … } from './types.js'` block.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/vault-sol.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/src/types.ts packages/sdk/src/vault-sol.ts packages/sdk/src/index.ts packages/sdk/tests/vault-sol.test.ts
git commit -S -m "feat(sdk): buildRefundSolTx + buildAuthorityRefundSolTx"
```

---

## Task 4: `buildPrivateSendSolTx` (native-SOL stealth withdraw)

**Files:**
- Create: `packages/sdk/src/privacy-sol.ts`
- Modify: `packages/sdk/src/index.ts`
- Test: `packages/sdk/tests/privacy-sol.test.ts`

**Interfaces:**
- Consumes: `deriveSolVaultPDA`, `deriveSolFeePDA` (Task 1); `anchorDiscriminator`, `deriveVaultConfigPDA`, `deriveDepositRecordPDA` (vault.ts); `NATIVE_SOL_MINT`, `SIP_PRIVACY_PROGRAM_ID`, `SIP_CONFIG_SEED`, `SIP_TRANSFER_RECORD_SEED`, `ANCHOR_DISCRIMINATOR_SIZE` (config.ts); `WithdrawResult` (types.ts).
- Produces: `PrivateSendSolParams`; `buildPrivateSendSolTx(params: PrivateSendSolParams): Promise<WithdrawResult>`.

- [ ] **Step 1: Write the failing test** — create `packages/sdk/tests/privacy-sol.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import {
  buildPrivateSendSolTx,
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
  deriveSolVaultPDA,
  deriveSolFeePDA,
  anchorDiscriminator,
  NATIVE_SOL_MINT,
  SIP_PRIVACY_PROGRAM_ID,
} from '../src/index.js'
import { SIP_CONFIG_SEED } from '../src/config.js'

const BLOCKHASH = 'GfVcyD4kkTrj4bKc7WA9sZCin9JDbdT458zqL4zjxx2v'
const DEPOSITOR = new PublicKey('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr')
const STEALTH = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

const commitment = new Uint8Array(33).fill(2)
const ephemeral = new Uint8Array(33).fill(3)
const vkHash = new Uint8Array(32).fill(4)
const encrypted = new Uint8Array([9, 9, 9])
const proof = new Uint8Array([])

// Dispatching Connection stub. fee_bps lives at config offset 40 (u16 LE);
// sip total_transfers at offset 8+32+2+1 = 43 (u64 LE).
function mockConn(opts: {
  feeBps?: number
  stealthLamports?: number | null
  rentExemptMin?: number
} = {}): Connection {
  const { feeBps = 10, stealthLamports = null, rentExemptMin = 890_880 } = opts
  const configBuf = Buffer.alloc(60)
  configBuf.writeUInt16LE(feeBps, 40)
  const sipBuf = Buffer.alloc(8 + 32 + 2 + 1 + 8) // total_transfers = 0
  const [cfg] = deriveVaultConfigPDA()
  const [sip] = PublicKey.findProgramAddressSync([SIP_CONFIG_SEED], SIP_PRIVACY_PROGRAM_ID)
  return {
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
    getMinimumBalanceForRentExemption: async () => rentExemptMin,
    getAccountInfo: async (pk: PublicKey) => {
      if (pk.equals(cfg)) return { data: configBuf } as never
      if (pk.equals(sip)) return { data: sipBuf } as never
      if (stealthLamports === null) return null
      return { lamports: stealthLamports, data: Buffer.alloc(0) } as never
    },
  } as unknown as Connection
}

const baseParams = {
  depositor: DEPOSITOR,
  amount: 2_000_000n,
  stealthPubkey: STEALTH,
  amountCommitment: commitment,
  ephemeralPubkey: ephemeral,
  viewingKeyHash: vkHash,
  encryptedAmount: encrypted,
  proof,
}

describe('buildPrivateSendSolTx', () => {
  it('builds withdraw_private_sol with the exact 10-account order + flags', async () => {
    // stealth pre-funded above the rent floor so the guard passes
    const res = await buildPrivateSendSolTx({
      ...baseParams,
      connection: mockConn({ stealthLamports: 1_000_000_000 }),
    })
    const ix = res.transaction.instructions[0]
    const [config] = deriveVaultConfigPDA()
    const [record] = deriveDepositRecordPDA(DEPOSITOR, NATIVE_SOL_MINT)
    const [solVault] = deriveSolVaultPDA()
    const [solFee] = deriveSolFeePDA()
    const [sipConfig] = PublicKey.findProgramAddressSync([SIP_CONFIG_SEED], SIP_PRIVACY_PROGRAM_ID)

    expect(ix.keys.length).toBe(10)
    expect(ix.keys.slice(0, 6).map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      record.toBase58(),
      solVault.toBase58(),
      solFee.toBase58(),
      STEALTH.toBase58(),
      DEPOSITOR.toBase58(),
    ])
    expect(ix.keys[8].pubkey.toBase58()).toBe(SIP_PRIVACY_PROGRAM_ID.toBase58())
    expect(ix.keys[9].pubkey.toBase58()).toBe(SystemProgram.programId.toBase58())
    // only depositor (index 5) signs
    expect(ix.keys.map((k) => k.isSigner)).toEqual([
      false, false, false, false, false, true, false, false, false, false,
    ])
    // config(ro), sip_program(ro), system(ro) are non-writable; the rest writable
    expect(ix.keys.map((k) => k.isWritable)).toEqual([
      false, true, true, true, true, true, true, true, false, false,
    ])
    expect(ix.keys[6].pubkey.equals(sipConfig)).toBe(true)
  })

  it('encodes the discriminator + amount and computes fee/net from config', async () => {
    const res = await buildPrivateSendSolTx({
      ...baseParams,
      connection: mockConn({ feeBps: 10, stealthLamports: 1_000_000_000 }),
    })
    const data = res.transaction.instructions[0].data
    expect(data.subarray(0, 8).equals(anchorDiscriminator('withdraw_private_sol'))).toBe(true)
    expect(data.readBigUInt64LE(8)).toBe(2_000_000n)
    // 10 bps of 2_000_000 = 2_000
    expect(res.feeAmount).toBe(2_000n)
    expect(res.netAmount).toBe(1_998_000n)
    expect(res.stealthAddress.toBase58()).toBe(STEALTH.toBase58())
  })

  it('throws when a fresh stealth recipient would be left below rent-exempt', async () => {
    // stealth does not exist (0 lamports); net 1_998_000 < 890_880? No — so make the
    // payout tiny: amount 1000 => net 999 < rent floor => must throw.
    await expect(
      buildPrivateSendSolTx({
        ...baseParams,
        amount: 1_000n,
        connection: mockConn({ stealthLamports: null }),
      }),
    ).rejects.toThrow('rent-exempt minimum')
  })

  it('passes when the stealth recipient is already rent-exempt', async () => {
    const res = await buildPrivateSendSolTx({
      ...baseParams,
      amount: 1_000n,
      connection: mockConn({ stealthLamports: 890_880 }),
    })
    expect(res.transaction.instructions).toHaveLength(1)
  })

  it('rejects malformed crypto field lengths', async () => {
    await expect(
      buildPrivateSendSolTx({
        ...baseParams,
        amountCommitment: new Uint8Array(32), // wrong length
        connection: mockConn({ stealthLamports: 1_000_000_000 }),
      }),
    ).rejects.toThrow('amountCommitment must be 33 bytes')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/privacy-sol.test.ts`
Expected: FAIL — `buildPrivateSendSolTx` not exported.

- [ ] **Step 3: Create `privacy-sol.ts`**:

```ts
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  SIPHER_VAULT_PROGRAM_ID,
  SIP_PRIVACY_PROGRAM_ID,
  SIP_CONFIG_SEED,
  SIP_TRANSFER_RECORD_SEED,
  NATIVE_SOL_MINT,
  ANCHOR_DISCRIMINATOR_SIZE,
} from './config.js'
import {
  anchorDiscriminator,
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
} from './vault.js'
import { deriveSolVaultPDA, deriveSolFeePDA } from './vault-sol.js'
import type { WithdrawResult } from './types.js'

export interface PrivateSendSolParams {
  connection: Connection
  /** The depositor who owns the native-SOL vault balance */
  depositor: PublicKey
  /** Amount of lamports to withdraw (gross, before fees) */
  amount: bigint
  /** The stealth recipient pubkey — also the plain SystemAccount that receives lamports */
  stealthPubkey: PublicKey
  /** Pedersen commitment: C = amount*G + blinding*H (33 bytes compressed) */
  amountCommitment: Uint8Array
  /** Ephemeral pubkey for ECDH (33 bytes compressed) */
  ephemeralPubkey: Uint8Array
  /** SHA-256 hash of the viewing key (32 bytes) */
  viewingKeyHash: Uint8Array
  /** Encrypted amount blob (for recipient to decrypt with viewing key) */
  encryptedAmount: Uint8Array
  /** ZK proof bytes (verified off-chain; may be empty) */
  proof: Uint8Array
  /** Program ID override */
  programId?: PublicKey
}

/**
 * Build an unsigned native-SOL withdraw_private_sol transaction: withdraw lamports
 * from the shared SolVault to a stealth recipient, with a Pedersen commitment hiding
 * the amount and a sip_privacy announcement CPI. Mirrors buildPrivateSendTx with the
 * token accounts replaced by sol_vault / sol_fee and a plain SystemAccount recipient.
 *
 * Accounts (order matches the WithdrawPrivateSol context in lib.rs):
 *   0. config              (ro)   — VaultConfig PDA
 *   1. deposit_record      (mut)  — DepositRecord PDA [.., depositor, NATIVE_SOL_MINT]
 *   2. sol_vault           (mut)  — SolVault PDA
 *   3. sol_fee             (mut)  — SolFee PDA
 *   4. stealth             (mut)  — stealth recipient (SystemAccount)
 *   5. depositor           (mut, signer)
 *   6. sip_config          (mut)  — SIP Privacy Config PDA (CPI)
 *   7. sip_transfer_record (mut)  — TransferRecord PDA (init by CPI)
 *   8. sip_privacy_program (ro)
 *   9. system_program      (ro)
 */
export async function buildPrivateSendSolTx(
  params: PrivateSendSolParams
): Promise<WithdrawResult> {
  const {
    connection,
    depositor,
    amount,
    stealthPubkey,
    amountCommitment,
    ephemeralPubkey,
    viewingKeyHash,
    encryptedAmount,
    proof,
    programId = SIPHER_VAULT_PROGRAM_ID,
  } = params

  if (amount <= 0n) {
    throw new Error('Withdrawal amount must be greater than zero')
  }
  if (amountCommitment.length !== 33) {
    throw new Error(`amountCommitment must be 33 bytes, got ${amountCommitment.length}`)
  }
  if (ephemeralPubkey.length !== 33) {
    throw new Error(`ephemeralPubkey must be 33 bytes, got ${ephemeralPubkey.length}`)
  }
  if (viewingKeyHash.length !== 32) {
    throw new Error(`viewingKeyHash must be 32 bytes, got ${viewingKeyHash.length}`)
  }

  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)
  const [solFeePDA] = deriveSolFeePDA(programId)
  const [sipConfigPDA] = PublicKey.findProgramAddressSync(
    [SIP_CONFIG_SEED],
    SIP_PRIVACY_PROGRAM_ID
  )

  // Parallel reads: vault config (fee), sip config (total_transfers), rent floor,
  // and the stealth recipient's current balance (for the rent-exempt guard).
  const [configInfo, sipConfigInfo, rentExemptMin, stealthInfo] = await Promise.all([
    connection.getAccountInfo(configPDA),
    connection.getAccountInfo(sipConfigPDA),
    connection.getMinimumBalanceForRentExemption(0),
    connection.getAccountInfo(stealthPubkey),
  ])

  let feeBps = 10 // fallback to default
  if (configInfo) {
    // fee_bps at offset 8 (disc) + 32 (authority) = 40, u16 LE
    feeBps = configInfo.data.readUInt16LE(40)
  }

  let sipTotalTransfers = 0n
  if (sipConfigInfo) {
    // after 8-byte disc: authority(32) + fee_bps(2) + paused(1) + total_transfers(u64)
    sipTotalTransfers = sipConfigInfo.data.readBigUInt64LE(
      ANCHOR_DISCRIMINATOR_SIZE + 32 + 2 + 1
    )
  }

  const totalTransfersBuffer = Buffer.alloc(8)
  totalTransfersBuffer.writeBigUInt64LE(sipTotalTransfers)
  const [sipTransferRecordPDA] = PublicKey.findProgramAddressSync(
    [SIP_TRANSFER_RECORD_SEED, depositor.toBuffer(), totalTransfersBuffer],
    SIP_PRIVACY_PROGRAM_ID
  )

  const feeAmount = (amount * BigInt(feeBps)) / 10_000n
  const netAmount = amount - feeAmount

  // Rent-exempt guard: the stealth recipient is a plain system account. The runtime
  // rejects a tx that leaves a touched account with a non-zero balance below the
  // rent-exempt minimum, so a small payout to a never-funded stealth would fail.
  // Surface it with an actionable error instead of an opaque runtime reject.
  const currentLamports = BigInt(stealthInfo?.lamports ?? 0)
  if (currentLamports + netAmount < BigInt(rentExemptMin)) {
    throw new Error(
      `Stealth recipient ${stealthPubkey.toBase58()} would be left below the ` +
        `rent-exempt minimum (needs >= ${rentExemptMin} lamports after the payout; ` +
        `would have ${currentLamports + netAmount}). Pre-fund the stealth account to ` +
        `at least ${rentExemptMin} lamports before withdrawing.`
    )
  }

  // Serialize: disc(8) + amount(8) + commitment(33) + stealth_pubkey(32)
  //          + ephemeral(33) + vk_hash(32) + encrypted(4+len) + proof(4+len)
  const fixedSize = 8 + 8 + 33 + 32 + 33 + 32
  const vecOverhead = 4 + encryptedAmount.length + 4 + proof.length
  const data = Buffer.alloc(fixedSize + vecOverhead)
  let offset = 0

  anchorDiscriminator('withdraw_private_sol').copy(data, offset)
  offset += 8
  data.writeBigUInt64LE(amount, offset)
  offset += 8
  Buffer.from(amountCommitment).copy(data, offset)
  offset += 33
  stealthPubkey.toBuffer().copy(data, offset)
  offset += 32
  Buffer.from(ephemeralPubkey).copy(data, offset)
  offset += 33
  Buffer.from(viewingKeyHash).copy(data, offset)
  offset += 32
  data.writeUInt32LE(encryptedAmount.length, offset)
  offset += 4
  Buffer.from(encryptedAmount).copy(data, offset)
  offset += encryptedAmount.length
  data.writeUInt32LE(proof.length, offset)
  offset += 4
  Buffer.from(proof).copy(data, offset)

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: solFeePDA, isSigner: false, isWritable: true },
      { pubkey: stealthPubkey, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: sipConfigPDA, isSigner: false, isWritable: true },
      { pubkey: sipTransferRecordPDA, isSigner: false, isWritable: true },
      { pubkey: SIP_PRIVACY_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = depositor

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return {
    transaction: tx,
    netAmount,
    feeAmount,
    stealthAddress: stealthPubkey,
  }
}
```

- [ ] **Step 4: Export from the barrel** — add a new block in `index.ts` after the `./privacy.js` block:

```ts
// Native-SOL privacy operations
export { buildPrivateSendSolTx } from './privacy-sol.js'
export type { PrivateSendSolParams } from './privacy-sol.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/privacy-sol.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/privacy-sol.ts packages/sdk/src/index.ts packages/sdk/tests/privacy-sol.test.ts
git commit -S -m "feat(sdk): buildPrivateSendSolTx with rent-exempt recipient guard"
```

---

## Task 5: `buildCreateSolVaultTx` (optional) + barrel smoke test + full-green gate

> `buildCreateSolVaultTx` is the lowest-priority surface item — the SOL PDAs already exist on the current devnet deployment, so it has no immediate consumer. Implement it for completeness; it is safe to skip without blocking the other builders.

**Files:**
- Modify: `packages/sdk/src/vault-sol.ts`
- Modify: `packages/sdk/src/index.ts`
- Test: `packages/sdk/tests/vault-sol.test.ts`

**Interfaces:**
- Consumes: `deriveSolVaultPDA`, `deriveSolFeePDA`, `deriveVaultConfigPDA`, `anchorDiscriminator`.
- Produces: `buildCreateSolVaultTx(connection, payer, programId?): Promise<Transaction>`.

- [ ] **Step 1: Write the failing test** — append to `tests/vault-sol.test.ts`:

```ts
import { buildCreateSolVaultTx } from '../src/index.js'

describe('buildCreateSolVaultTx', () => {
  it('builds create_sol_vault with the exact CreateSolVault account order + flags', async () => {
    const payer = DEPOSITOR
    const tx = await buildCreateSolVaultTx(mockConnDeposit(), payer)
    const ix = tx.instructions[0]
    const [config] = deriveVaultConfigPDA()
    const [solVault] = deriveSolVaultPDA()
    const [solFee] = deriveSolFeePDA()

    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      solVault.toBase58(),
      solFee.toBase58(),
      payer.toBase58(),
      SystemProgram.programId.toBase58(),
    ])
    expect(ix.keys.map((k) => k.isSigner)).toEqual([false, false, false, true, false])
    expect(ix.keys.map((k) => k.isWritable)).toEqual([false, true, true, true, false])
    expect(ix.data.equals(anchorDiscriminator('create_sol_vault'))).toBe(true)
    expect(tx.feePayer?.toBase58()).toBe(payer.toBase58())
  })
})
```

> Note: `deriveSolFeePDA` must be in the test file's `../src/index.js` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/vault-sol.test.ts -t buildCreateSolVaultTx`
Expected: FAIL — `buildCreateSolVaultTx` not exported.

- [ ] **Step 3: Implement `buildCreateSolVaultTx`** — append to `vault-sol.ts`:

```ts
/**
 * Build an unsigned create_sol_vault transaction — one-time init of the singleton
 * SolVault + SolFee PDAs. Payer funds the rent-exempt reserve for both. No args.
 *
 * Accounts (order matches the CreateSolVault context in lib.rs):
 *   0. config         (ro)          — VaultConfig PDA
 *   1. sol_vault      (init, mut)   — SolVault PDA
 *   2. sol_fee        (init, mut)   — SolFee PDA
 *   3. payer          (mut, signer)
 *   4. system_program (ro)
 */
export async function buildCreateSolVaultTx(
  connection: Connection,
  payer: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<Transaction> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)
  const [solFeePDA] = deriveSolFeePDA(programId)

  const data = anchorDiscriminator('create_sol_vault')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: solFeePDA, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = payer

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return tx
}
```

- [ ] **Step 4: Export from the barrel** — add `buildCreateSolVaultTx` to the `./vault-sol.js` block in `index.ts`.

- [ ] **Step 5: Run the new test to verify it passes**

Run: `pnpm vitest run tests/vault-sol.test.ts -t buildCreateSolVaultTx`
Expected: PASS.

- [ ] **Step 6: Add a barrel-export smoke test** — append to `tests/vault-sol.test.ts`:

```ts
import * as sdk from '../src/index.js'

describe('barrel exports (native-SOL surface)', () => {
  it('re-exports every native-SOL symbol', () => {
    for (const name of [
      'NATIVE_SOL_MINT',
      'VAULT_SOL_SEED',
      'FEE_SOL_SEED',
      'deriveSolVaultPDA',
      'deriveSolFeePDA',
      'buildDepositSolTx',
      'buildRefundSolTx',
      'buildAuthorityRefundSolTx',
      'buildCreateSolVaultTx',
      'buildPrivateSendSolTx',
    ]) {
      expect(sdk).toHaveProperty(name)
    }
  })
})
```

- [ ] **Step 7: Full green gate** — run the whole suite + typecheck:

Run: `pnpm test`
Expected: PASS — the entire SDK suite (existing tests + all new native-SOL tests) green.

Run: `pnpm exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/sdk/src/vault-sol.ts packages/sdk/src/index.ts packages/sdk/tests/vault-sol.test.ts
git commit -S -m "feat(sdk): buildCreateSolVaultTx + native-SOL barrel export smoke test"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §4.1 config consts (`NATIVE_SOL_MINT`, seeds) | Task 1 |
| §4.2 PDA derivation (`deriveSolVaultPDA`/`deriveSolFeePDA`) | Task 1 |
| §4.3 `buildDepositSolTx` | Task 2 |
| §4.3 `buildRefundSolTx` / `buildAuthorityRefundSolTx` | Task 3 |
| §4.3 `buildCreateSolVaultTx` (optional) | Task 5 |
| §4.4 `buildPrivateSendSolTx` | Task 4 |
| §4.5 reads (reuse `getVaultBalance`) | No code — documented; no task needed |
| §4.6 result types (`SolDepositResult`/`SolRefundResult`) | Tasks 2, 3 |
| §5 `NATIVE_SOL_MINT` sentinel test | Task 1 |
| §6 rent-exempt guard | Task 4 |
| §7 error handling | Tasks 2–4 (validation + guard) |
| §8 testing (account order, fixtures, fee, guard) | All tasks |

No gaps. (§4.5 is intentionally code-free — it documents reuse of the existing read.)

**2. Placeholder scan:** none — every step has complete code/commands/expected output.

**3. Type consistency:** `SolDepositResult`/`SolRefundResult`/`PrivateSendSolParams` and the function signatures are used identically across the producing task and the barrel exports. `WithdrawResult` is reused unchanged. `deriveSolVaultPDA`/`deriveSolFeePDA` names are consistent between Task 1 (definition) and Tasks 2–5 (consumption).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-sipher-sdk-native-sol-builders.md`.
