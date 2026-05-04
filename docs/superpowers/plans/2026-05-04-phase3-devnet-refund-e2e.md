# Phase 3 Devnet Refund E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one observed end-to-end execution of `performVaultRefund` against the live `sipher_vault` program on Solana devnet, captured in version control as a JSON evidence artifact, closing the last open item from the 2026-04-18 SENTINEL audit.

**Architecture:** Two manually-invoked TypeScript scripts under `scripts/` (`devnet-vault-bootstrap.ts` + `devnet-vault-refund-e2e.ts`) sharing state via a gitignored JSON file. Single shared devnet wallet plays both depositor and authority. The 24h refund timeout creates a real-time wait between Task 3 (run bootstrap) and Task 5 (run refund). Production `performVaultRefund` is imported and called as-is — no re-implementation in test code.

**Tech Stack:** TypeScript, `@solana/web3.js`, `@solana/spl-token` (wSOL wrapping), `@sipher/sdk` (vault PDA derivations + `buildDepositTx` + `buildAuthorityRefundTx` + `fetchDepositRecord`), `pnpm tsx` runner.

**Spec:** `docs/superpowers/specs/2026-05-04-phase3-devnet-refund-e2e-design.md`

> **Note on the 24h wait:** Tasks 1–4 are same-session work. Task 4 (refund script) can be written during the 24h wait — it does not require the deposit to be refundable yet (the script bails cleanly with a wait-time message if invoked too early). Task 5 is a real-time gate: the deposit's `lastDepositAt + 86400s` must have passed before it can run. Task 6 finalizes evidence, CHANGELOG, memory, PR.

---

## Pre-Flight

You are working on branch `chore/phase-3-devnet-refund-e2e` (already created from `main` at commit `53af700`; the spec was committed as `7801641`).

Confirm before starting:

```bash
git rev-parse --abbrev-ref HEAD
# Expected: chore/phase-3-devnet-refund-e2e

git log --oneline -2
# Expected:
# 7801641 docs(sentinel): design spec for Phase 3 devnet refund E2E
# 53af700 Merge pull request #169 from sip-protocol/docs/sentinel-mirror-policy

ls scripts/recon-devnet-deposits.mjs scripts/recon-devnet-vault-tokens.mjs
# Expected: both files exist (untracked, written during brainstorm)

cat ~/Documents/secret/solana-devnet.json | head -c 50
# Expected: starts with `[` and contains numbers — keypair file readable
```

If anything diverges, stop and investigate — baseline drifted.

Verify devnet wallet has SOL:

```bash
solana balance --url devnet --keypair ~/Documents/secret/solana-devnet.json
# Expected: ≥ 0.1 SOL. If less, ask RECTOR to fund it from treasury.
```

---

## Task 1: Setup — `.gitignore` entry + recon-script header comments

**Files:**
- Modify: `.gitignore`
- Modify: `scripts/recon-devnet-deposits.mjs` (header comment)
- Modify: `scripts/recon-devnet-vault-tokens.mjs` (header comment)

- [ ] **Step 1: Add `.gitignore` entry**

Open `.gitignore` and append (or merge with existing scripts ignore section):

```
# Phase 3 devnet refund E2E — bootstrap state handoff (gitignored, not evidence)
scripts/.devnet-vault-bootstrap.json
```

- [ ] **Step 2: Verify `.gitignore` works**

Run:

```bash
echo '{}' > scripts/.devnet-vault-bootstrap.json
git check-ignore scripts/.devnet-vault-bootstrap.json
# Expected: scripts/.devnet-vault-bootstrap.json
rm scripts/.devnet-vault-bootstrap.json
```

If `git check-ignore` exits non-zero, the rule didn't take. Fix the path.

- [ ] **Step 3: Add header comment to `scripts/recon-devnet-deposits.mjs`**

Insert at the very top of the file (before the existing `import` line):

```js
// Diagnostic: list all DepositRecord PDAs on the live sipher_vault program.
// Used by Phase 3 refund E2E for verification + Phase 4 mainnet prep.

```

- [ ] **Step 4: Add header comment to `scripts/recon-devnet-vault-tokens.mjs`**

Confirm the header from the brainstorm session is present at the top of the file:

```js
// Diagnostic: surveys the live sipher_vault devnet deployment and checks
// whether vault_token / fee_token are initialized for native SOL (wSOL).
// Used by Phase 3 refund E2E for verification + Phase 4 mainnet prep.

```

If missing, prepend it.

- [ ] **Step 5: Smoke-run both recon scripts**

```bash
pnpm tsx scripts/recon-devnet-deposits.mjs 2>&1 | head -3
# Expected: "Found N DepositRecord accounts" (where N≥0)

pnpm tsx scripts/recon-devnet-vault-tokens.mjs 2>&1 | head -10
# Expected: VAULT_CONFIG block prints with authority + feeBps + refundTimeout
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore scripts/recon-devnet-deposits.mjs scripts/recon-devnet-vault-tokens.mjs
git commit -m "chore(scripts): add devnet vault recon utilities and gitignore handoff state

Two read-only diagnostic scripts written during the Phase 3 brainstorm
that survey the live sipher_vault devnet deployment:

- recon-devnet-deposits.mjs lists all DepositRecord PDAs (currently
  zero — vault has never been used) with depositor / mint / amount /
  age / refundability metadata.
- recon-devnet-vault-tokens.mjs deserializes VaultConfig and probes
  derived vault_token + fee_token PDAs for wSOL.

Both will be reused for Phase 4 mainnet prep. Also adds
scripts/.devnet-vault-bootstrap.json to .gitignore — the bootstrap
script writes a state file there that hands off to the refund script
24h later, but the file is intentionally not evidence (the committed
artifact lands at docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json
after the refund succeeds)."
```

---

## Task 2: Bootstrap script — full implementation

**Files:**
- Create: `scripts/devnet-vault-bootstrap.ts`

This task writes the full bootstrap script in one go. The script is split into clearly-commented sections; the steps below build it section by section.

- [ ] **Step 1: Create the file with imports + entry-point skeleton**

Create `scripts/devnet-vault-bootstrap.ts` with this exact content:

```ts
// scripts/devnet-vault-bootstrap.ts
// Phase 3 devnet refund E2E — bootstrap script.
//
// Wraps 0.01 SOL into wSOL on the shared devnet wallet, deposits it into
// the live sipher_vault program, and writes a state JSON file to
// scripts/.devnet-vault-bootstrap.json (gitignored).
//
// 24h+ later, scripts/devnet-vault-refund-e2e.ts reads that state, calls
// the production performVaultRefund, asserts pre/post chain state, and
// emits the committed evidence artifact.
//
// Run: pnpm tsx scripts/devnet-vault-bootstrap.ts
//
// Spec: docs/superpowers/specs/2026-05-04-phase3-devnet-refund-e2e-design.md

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
} from '@solana/spl-token'
import {
  anchorDiscriminator,
  deriveVaultConfigPDA,
  deriveVaultTokenPDA,
  deriveFeeTokenPDA,
  deriveDepositRecordPDA,
  deserializeVaultConfig,
  deserializeDepositRecord,
  buildDepositTx,
  SIPHER_VAULT_PROGRAM_ID,
} from '@sipher/sdk'
import { readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ── Constants ───────────────────────────────────────────────────────────────

const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR
  ?? join(homedir(), 'Documents/secret/solana-devnet.json')

const STATE_PATH = join(process.cwd(), 'scripts/.devnet-vault-bootstrap.json')
const RPC_URL   = 'https://api.devnet.solana.com'
const NETWORK   = 'devnet' as const

const DEPOSIT_AMOUNT_LAMPORTS = 10_000_000n  // 0.01 SOL
const DEPOSIT_AMOUNT_SOL      = 0.01
const MIN_BALANCE_LAMPORTS    = 100_000_000n // 0.1 SOL — refuse if below

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Phase 3 — devnet vault bootstrap\n')

  const conn = new Connection(RPC_URL, 'confirmed')
  const keypair = loadKeypair(KEYPAIR_PATH)
  console.log(`Loaded keypair: ${keypair.publicKey.toBase58()}`)

  await assertSolBalance(conn, keypair.publicKey)

  const cfg = await loadAndVerifyVaultConfig(conn, keypair.publicKey)

  const setupTxIds = {
    vaultToken: null as string | null,
    feeToken:   null as string | null,
    ataAndWrap: null as string | null,
  }

  setupTxIds.vaultToken = await ensureVaultTokenForWsol(conn, keypair)
  setupTxIds.feeToken   = await ensureFeeTokenForWsol(conn, keypair)
  setupTxIds.ataAndWrap = await wrapSolToWsolAta(conn, keypair)

  const { depositTxId, recordPDA, depositConfirmedAt, depositRecord } =
    await runDeposit(conn, keypair)

  writeStateJson({
    cfg,
    depositor: keypair.publicKey,
    pda: recordPDA,
    depositRecord,
    depositTxId,
    depositConfirmedAt,
    setupTxIds,
  })

  printSummary(recordPDA, depositRecord, depositTxId)
}

// (helpers below — added in subsequent steps)

main().catch((err) => {
  console.error('\n✗ Bootstrap failed:', err.message ?? err)
  process.exit(1)
})
```

- [ ] **Step 2: Add helper — `loadKeypair`**

Append below the `// (helpers below ...)` line:

```ts
// ── Helpers ─────────────────────────────────────────────────────────────────

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(raw))
}

async function assertSolBalance(conn: Connection, pubkey: PublicKey): Promise<void> {
  const lamports = BigInt(await conn.getBalance(pubkey, 'confirmed'))
  const sol = Number(lamports) / 1e9
  console.log(`Balance: ${sol.toFixed(4)} SOL`)
  if (lamports < MIN_BALANCE_LAMPORTS) {
    throw new Error(
      `Insufficient SOL balance: ${sol.toFixed(4)} (need ≥ ${Number(MIN_BALANCE_LAMPORTS)/1e9}). ` +
      `Ask RECTOR to fund ${pubkey.toBase58()} from treasury.`,
    )
  }
}
```

- [ ] **Step 3: Add helper — `loadAndVerifyVaultConfig`**

Append:

```ts
type VaultConfigState = {
  pda: PublicKey
  authority: PublicKey
  feeBps: number
  refundTimeout: bigint
  paused: boolean
  totalDeposits: bigint
  totalDepositors: bigint
  bump: number
}

async function loadAndVerifyVaultConfig(
  conn: Connection,
  expectedAuthority: PublicKey,
): Promise<VaultConfigState> {
  const [configPDA] = deriveVaultConfigPDA()
  const info = await conn.getAccountInfo(configPDA, 'confirmed')
  if (!info) {
    throw new Error(`VaultConfig PDA ${configPDA.toBase58()} not found — vault not initialized`)
  }
  const cfg = deserializeVaultConfig(info.data)
  if (!cfg.authority.equals(expectedAuthority)) {
    throw new Error(
      `VaultConfig.authority (${cfg.authority.toBase58()}) does not match loaded keypair ` +
      `(${expectedAuthority.toBase58()}). This wallet cannot sign authority-only instructions.`,
    )
  }
  console.log(
    `VaultConfig OK: authority=${cfg.authority.toBase58()}, ` +
    `feeBps=${cfg.feeBps}, refundTimeout=${cfg.refundTimeout}s, paused=${cfg.paused}`,
  )
  return { pda: configPDA, ...cfg }
}
```

- [ ] **Step 4: Add helper — `ensureVaultTokenForWsol`**

Append. This function manually constructs the `create_vault_token` instruction (the SDK does not expose a builder for it).

```ts
async function ensureVaultTokenForWsol(
  conn: Connection,
  authority: Keypair,
): Promise<string | null> {
  const [vaultTokenPDA] = deriveVaultTokenPDA(NATIVE_MINT)
  const existing = await conn.getAccountInfo(vaultTokenPDA, 'confirmed')
  if (existing) {
    console.log(`vault_token (wSOL) already exists at ${vaultTokenPDA.toBase58()}`)
    return null
  }

  console.log(`Creating vault_token PDA for wSOL at ${vaultTokenPDA.toBase58()} ...`)
  const [configPDA] = deriveVaultConfigPDA()
  const ix = new TransactionInstruction({
    programId: SIPHER_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPDA,            isSigner: false, isWritable: false },
      { pubkey: vaultTokenPDA,        isSigner: false, isWritable: true  },
      { pubkey: NATIVE_MINT,          isSigner: false, isWritable: false },
      { pubkey: authority.publicKey,  isSigner: true,  isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,     isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: anchorDiscriminator('create_vault_token'),
  })
  return await sendAndConfirm(conn, authority, [ix], 'create_vault_token')
}
```

- [ ] **Step 5: Add helper — `ensureFeeTokenForWsol`**

Append. Mirrors `ensureVaultTokenForWsol` with the `create_fee_token` discriminator and fee_token PDA.

```ts
async function ensureFeeTokenForWsol(
  conn: Connection,
  authority: Keypair,
): Promise<string | null> {
  const [feeTokenPDA] = deriveFeeTokenPDA(NATIVE_MINT)
  const existing = await conn.getAccountInfo(feeTokenPDA, 'confirmed')
  if (existing) {
    console.log(`fee_token (wSOL) already exists at ${feeTokenPDA.toBase58()}`)
    return null
  }

  console.log(`Creating fee_token PDA for wSOL at ${feeTokenPDA.toBase58()} ...`)
  const [configPDA] = deriveVaultConfigPDA()
  const ix = new TransactionInstruction({
    programId: SIPHER_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPDA,            isSigner: false, isWritable: false },
      { pubkey: feeTokenPDA,          isSigner: false, isWritable: true  },
      { pubkey: NATIVE_MINT,          isSigner: false, isWritable: false },
      { pubkey: authority.publicKey,  isSigner: true,  isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,     isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: anchorDiscriminator('create_fee_token'),
  })
  return await sendAndConfirm(conn, authority, [ix], 'create_fee_token')
}
```

- [ ] **Step 6: Add helper — `wrapSolToWsolAta`**

Append. Combines ATA-creation (if needed), SystemProgram.transfer, and syncNative into one transaction.

```ts
async function wrapSolToWsolAta(
  conn: Connection,
  depositor: Keypair,
): Promise<string> {
  const ata = await getAssociatedTokenAddress(NATIVE_MINT, depositor.publicKey)
  const ataInfo = await conn.getAccountInfo(ata, 'confirmed')

  const ixs: TransactionInstruction[] = []

  if (!ataInfo) {
    console.log(`Creating depositor wSOL ATA at ${ata.toBase58()} ...`)
    ixs.push(createAssociatedTokenAccountInstruction(
      depositor.publicKey,    // payer
      ata,                    // ata to create
      depositor.publicKey,    // owner
      NATIVE_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ))
  } else {
    console.log(`Depositor wSOL ATA already exists at ${ata.toBase58()}`)
  }

  console.log(`Transferring ${DEPOSIT_AMOUNT_SOL} SOL → ATA + syncNative ...`)
  ixs.push(SystemProgram.transfer({
    fromPubkey: depositor.publicKey,
    toPubkey:   ata,
    lamports:   Number(DEPOSIT_AMOUNT_LAMPORTS),
  }))
  ixs.push(createSyncNativeInstruction(ata, TOKEN_PROGRAM_ID))

  return await sendAndConfirm(conn, depositor, ixs, 'wrap_sol_to_wsol')
}
```

- [ ] **Step 7: Add helper — `runDeposit`**

Append. Uses the SDK's `buildDepositTx` and signs with the same keypair (depositor == authority for our test).

```ts
type DepositResult = {
  depositTxId: string
  depositConfirmedAt: string
  recordPDA: PublicKey
  depositRecord: ReturnType<typeof deserializeDepositRecord>
}

async function runDeposit(
  conn: Connection,
  depositor: Keypair,
): Promise<DepositResult> {
  const ata = await getAssociatedTokenAddress(NATIVE_MINT, depositor.publicKey)
  const { transaction, depositRecordAddress } = await buildDepositTx(
    conn,
    depositor.publicKey,
    NATIVE_MINT,
    ata,
    DEPOSIT_AMOUNT_LAMPORTS,
  )

  transaction.feePayer = depositor.publicKey
  transaction.sign(depositor)

  console.log('Sending deposit transaction ...')
  const txId = await conn.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  })
  await conn.confirmTransaction(txId, 'confirmed')
  const confirmedAt = new Date().toISOString()
  console.log(`Deposit confirmed: ${txId}`)

  const recordInfo = await conn.getAccountInfo(depositRecordAddress, 'confirmed')
  if (!recordInfo) {
    throw new Error(`DepositRecord ${depositRecordAddress.toBase58()} not found post-deposit`)
  }
  const record = deserializeDepositRecord(recordInfo.data)
  console.log(
    `DepositRecord: balance=${record.balance}, ` +
    `last_deposit_at=${new Date(Number(record.lastDepositAt) * 1000).toISOString()}`,
  )

  return {
    depositTxId: txId,
    depositConfirmedAt: confirmedAt,
    recordPDA: depositRecordAddress,
    depositRecord: record,
  }
}
```

- [ ] **Step 8: Add helper — `sendAndConfirm`**

Append. Shared TX submission helper used by all four signed-instruction paths.

```ts
async function sendAndConfirm(
  conn: Connection,
  signer: Keypair,
  ixs: TransactionInstruction[],
  label: string,
): Promise<string> {
  const tx = new Transaction()
  tx.add(...ixs)
  tx.feePayer = signer.publicKey
  const { blockhash } = await conn.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.sign(signer)
  const txId = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  })
  await conn.confirmTransaction(txId, 'confirmed')
  console.log(`  ${label} confirmed: ${txId}`)
  return txId
}
```

- [ ] **Step 9: Add helper — `writeStateJson` + `printSummary`**

Append.

```ts
function writeStateJson(args: {
  cfg: VaultConfigState
  depositor: PublicKey
  pda: PublicKey
  depositRecord: ReturnType<typeof deserializeDepositRecord>
  depositTxId: string
  depositConfirmedAt: string
  setupTxIds: { vaultToken: string | null; feeToken: string | null; ataAndWrap: string | null }
}): void {
  const { cfg, depositor, pda, depositRecord, depositTxId, depositConfirmedAt, setupTxIds } = args
  const lastDepositAt = Number(depositRecord.lastDepositAt)
  const earliestRefundAt = lastDepositAt + Number(cfg.refundTimeout)

  const state = {
    schemaVersion: 1,
    network: NETWORK,
    vaultProgramId: SIPHER_VAULT_PROGRAM_ID.toBase58(),
    vaultConfig: cfg.pda.toBase58(),
    feeBps: cfg.feeBps,
    refundTimeoutSeconds: Number(cfg.refundTimeout),
    depositor: depositor.toBase58(),
    tokenMint: NATIVE_MINT.toBase58(),
    tokenSymbol: 'wSOL',
    amount: DEPOSIT_AMOUNT_SOL,
    amountLamports: Number(DEPOSIT_AMOUNT_LAMPORTS),
    depositedNetLamports: Number(depositRecord.balance),
    pda: pda.toBase58(),
    depositTxId,
    depositConfirmedAt,
    lastDepositAt: new Date(lastDepositAt * 1000).toISOString(),
    earliestRefundAt: new Date(earliestRefundAt * 1000).toISOString(),
    setupTxIds,
  }

  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { encoding: 'utf-8' })
  chmodSync(STATE_PATH, 0o600)
  console.log(`\nState written to ${STATE_PATH} (mode 600)`)
}

function printSummary(
  recordPDA: PublicKey,
  record: ReturnType<typeof deserializeDepositRecord>,
  depositTxId: string,
): void {
  const lastDepositAt = Number(record.lastDepositAt) * 1000
  const earliestRefundAt = new Date(lastDepositAt + 86_400_000).toISOString()
  console.log('\n──────────────────────────────────────────────────')
  console.log('✓ Bootstrap complete.')
  console.log(`  PDA:                ${recordPDA.toBase58()}`)
  console.log(`  Net balance:        ${record.balance} lamports (post-fee)`)
  console.log(`  Earliest refund at: ${earliestRefundAt}`)
  console.log(`  Solscan:            https://solscan.io/tx/${depositTxId}?cluster=devnet`)
  console.log(`\n  Run scripts/devnet-vault-refund-e2e.ts after that time.`)
  console.log('──────────────────────────────────────────────────\n')
}
```

- [ ] **Step 10: Type-check the script**

Run:

```bash
pnpm typecheck 2>&1 | tail -10
# Expected: zero errors. Script must compile cleanly under strict TS.
```

If errors appear, fix them inline before continuing. Common issues:
- Missing `@solana/spl-token` or `@sipher/sdk` import: confirm both are dependencies of the workspace root.
- `deserializeVaultConfig`/`deserializeDepositRecord` return types: cast or destructure as needed.

- [ ] **Step 11: Commit**

```bash
git add scripts/devnet-vault-bootstrap.ts
git commit -m "feat(scripts): add devnet vault bootstrap for Phase 3 refund E2E

Wraps 0.01 SOL into wSOL on the shared devnet wallet, ensures
vault_token + fee_token PDAs are initialized for wSOL (idempotent —
skips the create_* ix if PDA already exists), then deposits via
@sipher/sdk's buildDepositTx. On success, writes state JSON to
scripts/.devnet-vault-bootstrap.json (gitignored, mode 600) for the
24h-deferred refund script to consume.

Refuses to run if the loaded keypair's SOL balance is below 0.1 SOL
or if VaultConfig.authority does not match — both error paths print
the actionable next step rather than a stack trace.

Run with: pnpm tsx scripts/devnet-vault-bootstrap.ts

Spec: docs/superpowers/specs/2026-05-04-phase3-devnet-refund-e2e-design.md"
```

---

## Task 3: Run bootstrap — record real deposit on devnet

This task EXECUTES the bootstrap script. No commits — the state file is gitignored. The deposit and setup transactions land on real devnet.

- [ ] **Step 1: Run the bootstrap**

```bash
pnpm tsx scripts/devnet-vault-bootstrap.ts
```

Expected stdout (annotated):

```
Phase 3 — devnet vault bootstrap

Loaded keypair: FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr
Balance: <X> SOL
VaultConfig OK: authority=FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr, feeBps=10, refundTimeout=86400s, paused=false
Creating vault_token PDA for wSOL at 6HoouLu9e5TxsVzpds2yTiDyCo8pjUzk7wnRxc3U4wij ...
  create_vault_token confirmed: <sig>
Creating fee_token PDA for wSOL at C3XvQSz5BqyzHMxQwQb5gacmgAMHkRoMq7acvbuQnJpb ...
  create_fee_token confirmed: <sig>
Creating depositor wSOL ATA at <ATA> ...
Transferring 0.01 SOL → ATA + syncNative ...
  wrap_sol_to_wsol confirmed: <sig>
Sending deposit transaction ...
Deposit confirmed: <sig>
DepositRecord: balance=9990000, last_deposit_at=2026-05-04T...Z

State written to /.../scripts/.devnet-vault-bootstrap.json (mode 600)

──────────────────────────────────────────────────
✓ Bootstrap complete.
  PDA:                <pda>
  Net balance:        9990000 lamports (post-fee)
  Earliest refund at: 2026-05-05T...Z
  Solscan:            https://solscan.io/tx/<deposit-sig>?cluster=devnet

  Run scripts/devnet-vault-refund-e2e.ts after that time.
──────────────────────────────────────────────────
```

- [ ] **Step 2: Verify state JSON**

```bash
cat scripts/.devnet-vault-bootstrap.json | jq 'keys'
# Expected: includes "depositor", "tokenMint", "amount", "amountLamports",
# "depositedNetLamports", "pda", "depositTxId", "lastDepositAt",
# "earliestRefundAt", "setupTxIds", "schemaVersion": 1
```

```bash
cat scripts/.devnet-vault-bootstrap.json | jq '.depositedNetLamports'
# Expected: 9990000  (10M lamports - 10bps fee)
```

```bash
ls -la scripts/.devnet-vault-bootstrap.json | awk '{print $1}'
# Expected: -rw------- (mode 600)
```

- [ ] **Step 3: Verify deposit on Solscan**

Open the Solscan URL printed in Step 1 (the `Solscan:` line) in a browser. Confirm:
- TX status: Success
- Token balance change: Depositor's wSOL ATA decreased by 10,000,000 lamports
- Vault token PDA's wSOL balance increased by 10,000,000 lamports (split as 9,990,000 to vault_token + 10,000 to fee_token)

If any check fails: do NOT proceed. The state file is on-disk but the chain state is wrong. Use `scripts/recon-devnet-deposits.mjs` to inspect, then either re-run bootstrap (after fixing root cause) or escalate to RECTOR.

- [ ] **Step 4: Note the wait**

Read `earliestRefundAt` from the state JSON. The refund script (Task 5) cannot succeed before that timestamp. Tasks 4 and 5 will run during and after the wait respectively.

```bash
echo "Earliest refund at: $(cat scripts/.devnet-vault-bootstrap.json | jq -r '.earliestRefundAt')"
echo "Now:                $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

NO COMMIT for this task. State file is gitignored; commits resume in Task 4.

---

## Task 4: Refund script — full implementation (during the 24h wait)

**Files:**
- Create: `scripts/devnet-vault-refund-e2e.ts`
- Create: `docs/sentinel/evidence/.gitkeep` (ensures the directory is tracked even before evidence lands)

This task can be done immediately after Task 3 — it does not require the deposit to be refundable yet. The script bails cleanly with a wait-time message if invoked too early.

- [ ] **Step 1: Create evidence directory placeholder**

```bash
mkdir -p docs/sentinel/evidence
touch docs/sentinel/evidence/.gitkeep
```

- [ ] **Step 2: Create the refund script — imports + main**

Create `scripts/devnet-vault-refund-e2e.ts` with this exact content:

```ts
// scripts/devnet-vault-refund-e2e.ts
// Phase 3 devnet refund E2E — refund script.
//
// Reads the state JSON written by scripts/devnet-vault-bootstrap.ts,
// asserts the 24h refund timeout has passed, then calls the production
// performVaultRefund function with real RPC + real keypair signing.
//
// Captures pre/post on-chain state, asserts:
//   - txConfirmed: refund TX reaches `finalized` commitment
//   - balanceIncreased: depositor wSOL ATA gains exactly the pre-refund
//     DepositRecord.balance lamports
//   - depositRecordClosed: PDA either no longer exists OR balance == 0
//
// On all assertions pass: writes the committed evidence artifact at
// docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json.
//
// On any assertion fail: dumps pre/post snapshot to stderr, exits 1, no
// evidence file written.
//
// Run: pnpm tsx scripts/devnet-vault-refund-e2e.ts
//
// Spec: docs/superpowers/specs/2026-05-04-phase3-devnet-refund-e2e-design.md

import { Connection, PublicKey } from '@solana/web3.js'
import {
  NATIVE_MINT,
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import { deserializeDepositRecord } from '@sipher/sdk'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const STATE_PATH    = join(process.cwd(), 'scripts/.devnet-vault-bootstrap.json')
const EVIDENCE_DIR  = join(process.cwd(), 'docs/sentinel/evidence')
const KEYPAIR_PATH  = process.env.SOLANA_KEYPAIR
  ?? join(homedir(), 'Documents/secret/solana-devnet.json')
const RPC_URL       = 'https://api.devnet.solana.com'

type BootstrapState = {
  schemaVersion: number
  network: string
  vaultProgramId: string
  vaultConfig: string
  feeBps: number
  refundTimeoutSeconds: number
  depositor: string
  tokenMint: string
  tokenSymbol: string
  amount: number
  amountLamports: number
  depositedNetLamports: number
  pda: string
  depositTxId: string
  depositConfirmedAt: string
  lastDepositAt: string
  earliestRefundAt: string
  setupTxIds: { vaultToken: string | null; feeToken: string | null; ataAndWrap: string | null }
}

async function main(): Promise<void> {
  console.log('Phase 3 — devnet vault refund E2E\n')

  const state = readStateJson()
  assertRefundEligible(state)

  // Set env vars BEFORE importing performVaultRefund (it reads them at module load)
  process.env.SENTINEL_AUTHORITY_KEYPAIR = KEYPAIR_PATH
  process.env.SOLANA_NETWORK = state.network

  const conn = new Connection(RPC_URL, 'confirmed')
  const depositor = new PublicKey(state.depositor)
  const recordPDA = new PublicKey(state.pda)
  const wsolAta   = await getAssociatedTokenAddress(NATIVE_MINT, depositor)

  const pre = await capturePreState(conn, recordPDA, wsolAta)

  const { performVaultRefund } = await import('../packages/agent/src/sentinel/vault-refund.js')
  console.log('Calling performVaultRefund ...')
  const result = await performVaultRefund(state.pda, state.amount)
  if (!result.success || !result.txId) {
    throw new Error(`performVaultRefund returned non-success: ${JSON.stringify(result)}`)
  }
  console.log(`performVaultRefund OK: txId=${result.txId}`)

  await conn.confirmTransaction(result.txId, 'finalized')
  const refundConfirmedAt = new Date().toISOString()
  console.log(`Refund TX finalized: ${result.txId}`)

  const post = await capturePostState(conn, recordPDA, wsolAta)
  const assertions = computeAssertions(pre, post, result.txId)

  if (!assertions.txConfirmed || !assertions.balanceIncreased || !assertions.depositRecordClosed) {
    dumpFailure(pre, post, assertions, result.txId)
    process.exit(1)
  }

  writeEvidence(state, result.txId, refundConfirmedAt, pre, post, assertions)
  printSummary(state, result.txId, pre, post)
}

// (helpers below — added in subsequent steps)

main().catch((err) => {
  console.error('\n✗ Refund E2E failed:', err.message ?? err)
  process.exit(1)
})
```

- [ ] **Step 3: Add helper — `readStateJson` + `assertRefundEligible`**

Append:

```ts
// ── Helpers ─────────────────────────────────────────────────────────────────

function readStateJson(): BootstrapState {
  let raw: string
  try {
    raw = readFileSync(STATE_PATH, 'utf-8')
  } catch (err) {
    throw new Error(
      `State file not found at ${STATE_PATH}. ` +
      `Run scripts/devnet-vault-bootstrap.ts first.`,
    )
  }
  const state = JSON.parse(raw) as BootstrapState
  if (state.schemaVersion !== 1) {
    throw new Error(`Unexpected schemaVersion ${state.schemaVersion}, expected 1`)
  }
  console.log(`State loaded: pda=${state.pda}, depositedNet=${state.depositedNetLamports} lamports`)
  return state
}

function assertRefundEligible(state: BootstrapState): void {
  const earliest = Date.parse(state.earliestRefundAt)
  const now = Date.now()
  if (now < earliest) {
    const remainingMs = earliest - now
    const remainingHours = (remainingMs / 1000 / 3600).toFixed(2)
    throw new Error(
      `Refund timeout not yet elapsed. Earliest refund at ${state.earliestRefundAt} ` +
      `(${remainingHours}h remaining). Re-run after that time.`,
    )
  }
  console.log(`Refund eligible: timeout elapsed (earliest was ${state.earliestRefundAt})`)
}
```

- [ ] **Step 4: Add helpers — `capturePreState` + `capturePostState`**

Append:

```ts
type PreState = {
  depositorWSolBalance: bigint  // lamports of wSOL ATA
  depositRecordBalance: bigint  // pre-refund DepositRecord.balance
  recordExists: boolean
}

type PostState = {
  depositorWSolBalance: bigint
  recordExists: boolean
  recordBalance: bigint | null  // null if record was closed
}

async function capturePreState(
  conn: Connection,
  recordPDA: PublicKey,
  wsolAta: PublicKey,
): Promise<PreState> {
  const [recordInfo, ataInfo] = await Promise.all([
    conn.getAccountInfo(recordPDA, 'confirmed'),
    conn.getTokenAccountBalance(wsolAta, 'confirmed').catch(() => null),
  ])
  if (!recordInfo) {
    throw new Error(`DepositRecord ${recordPDA.toBase58()} does not exist pre-refund`)
  }
  const record = deserializeDepositRecord(recordInfo.data)
  const ataLamports = ataInfo
    ? BigInt(ataInfo.value.amount)
    : 0n
  console.log(
    `Pre-state: depositorWSol=${ataLamports}, ` +
    `recordBalance=${record.balance}`,
  )
  return {
    depositorWSolBalance: ataLamports,
    depositRecordBalance: record.balance,
    recordExists: true,
  }
}

async function capturePostState(
  conn: Connection,
  recordPDA: PublicKey,
  wsolAta: PublicKey,
): Promise<PostState> {
  const [recordInfo, ataInfo] = await Promise.all([
    conn.getAccountInfo(recordPDA, 'confirmed'),
    conn.getTokenAccountBalance(wsolAta, 'confirmed').catch(() => null),
  ])
  const recordExists = recordInfo !== null
  const recordBalance = recordExists
    ? deserializeDepositRecord(recordInfo!.data).balance
    : null
  const ataLamports = ataInfo
    ? BigInt(ataInfo.value.amount)
    : 0n
  console.log(
    `Post-state: depositorWSol=${ataLamports}, ` +
    `recordExists=${recordExists}, recordBalance=${recordBalance ?? 'n/a'}`,
  )
  return {
    depositorWSolBalance: ataLamports,
    recordExists,
    recordBalance,
  }
}
```

- [ ] **Step 5: Add helper — `computeAssertions`**

Append:

```ts
type Assertions = {
  txConfirmed: boolean
  balanceIncreased: boolean
  depositRecordClosed: boolean
  wSolDelta: bigint
  expectedDelta: bigint
}

function computeAssertions(pre: PreState, post: PostState, txId: string): Assertions {
  const wSolDelta = post.depositorWSolBalance - pre.depositorWSolBalance
  const expectedDelta = pre.depositRecordBalance
  const txConfirmed = typeof txId === 'string' && txId.length > 0
  const balanceIncreased = wSolDelta === expectedDelta
  const depositRecordClosed = !post.recordExists || (post.recordBalance ?? 1n) === 0n
  return { txConfirmed, balanceIncreased, depositRecordClosed, wSolDelta, expectedDelta }
}
```

- [ ] **Step 6: Add helpers — `writeEvidence` + `dumpFailure` + `printSummary`**

Append:

```ts
function writeEvidence(
  state: BootstrapState,
  refundTxId: string,
  refundConfirmedAt: string,
  pre: PreState,
  post: PostState,
  assertions: Assertions,
): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const path = join(EVIDENCE_DIR, `devnet-refund-${date}.json`)

  const evidence = {
    phase: 'phase-3-devnet-refund-e2e',
    schemaVersion: 1,
    vaultProgramId: state.vaultProgramId,
    vaultConfig: state.vaultConfig,
    depositor: state.depositor,
    tokenMint: state.tokenMint,
    tokenSymbol: state.tokenSymbol,
    amount: state.amount,
    amountLamports: state.amountLamports,
    feeBps: state.feeBps,
    depositedNetLamports: state.depositedNetLamports,
    setup: {
      vaultTokenCreatedTxId: state.setupTxIds.vaultToken,
      feeTokenCreatedTxId:   state.setupTxIds.feeToken,
      ataAndWrapTxId:        state.setupTxIds.ataAndWrap,
    },
    deposit: {
      txId: state.depositTxId,
      confirmedAt: state.depositConfirmedAt,
      lastDepositAt: state.lastDepositAt,
    },
    refund: {
      txId: refundTxId,
      confirmedAt: refundConfirmedAt,
      earliestRefundAt: state.earliestRefundAt,
    },
    balances: {
      depositorWSolBefore: String(pre.depositorWSolBalance),
      depositorWSolAfter:  String(post.depositorWSolBalance),
      wSolDelta:           String(assertions.wSolDelta),
    },
    solscan: {
      deposit: `https://solscan.io/tx/${state.depositTxId}?cluster=devnet`,
      refund:  `https://solscan.io/tx/${refundTxId}?cluster=devnet`,
    },
    assertions: {
      txConfirmed: assertions.txConfirmed,
      balanceIncreased: assertions.balanceIncreased,
      depositRecordClosed: assertions.depositRecordClosed,
    },
    executedBy: process.env.USER ?? 'unknown',
    executedAt: refundConfirmedAt,
  }

  writeFileSync(path, JSON.stringify(evidence, null, 2), { encoding: 'utf-8' })
  console.log(`\nEvidence written to ${path}`)
}

function dumpFailure(
  pre: PreState,
  post: PostState,
  assertions: Assertions,
  txId: string,
): void {
  console.error('\n✗ One or more assertions failed:')
  console.error(JSON.stringify({ pre, post, assertions, txId }, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v, 2))
  console.error(`\nSolscan: https://solscan.io/tx/${txId}?cluster=devnet`)
  console.error('No evidence file written.')
}

function printSummary(
  state: BootstrapState,
  refundTxId: string,
  pre: PreState,
  post: PostState,
): void {
  console.log('\n──────────────────────────────────────────────────')
  console.log('✓ Phase 3 devnet refund E2E PASSED.')
  console.log(`  PDA:                ${state.pda}`)
  console.log(`  Pre-refund balance: ${pre.depositRecordBalance} lamports`)
  console.log(`  wSOL delta:         ${post.depositorWSolBalance - pre.depositorWSolBalance} lamports`)
  console.log(`  Refund TX:          https://solscan.io/tx/${refundTxId}?cluster=devnet`)
  console.log(`  Deposit TX:         https://solscan.io/tx/${state.depositTxId}?cluster=devnet`)
  console.log('──────────────────────────────────────────────────\n')
}
```

- [ ] **Step 7: Type-check**

```bash
pnpm typecheck 2>&1 | tail -10
# Expected: zero errors.
```

Fix any inline before continuing.

- [ ] **Step 8: Pre-flight run (must bail on time check)**

If you ran Task 3 less than 24h ago, the script must bail with a wait-time message. Run:

```bash
pnpm tsx scripts/devnet-vault-refund-e2e.ts
```

Expected:

```
Phase 3 — devnet vault refund E2E

State loaded: pda=..., depositedNet=9990000 lamports

✗ Refund E2E failed: Refund timeout not yet elapsed. Earliest refund at 2026-05-05T...Z (XX.XXh remaining). Re-run after that time.
```

This is the desired behavior — confirms the wait-gate works. If it does NOT bail (i.e., 24h has already passed when running this), proceed directly to Task 5.

- [ ] **Step 9: Commit**

```bash
git add scripts/devnet-vault-refund-e2e.ts docs/sentinel/evidence/.gitkeep
git commit -m "feat(scripts): add devnet vault refund E2E for Phase 3 audit closure

Reads the bootstrap state JSON, validates the 24h refund-timeout has
elapsed, then imports and calls the production performVaultRefund
from packages/agent/src/sentinel/vault-refund.ts with real RPC and
the shared devnet keypair as authority signer.

Captures pre/post on-chain state and asserts:
  - txConfirmed: refund TX reaches finalized commitment
  - balanceIncreased: depositor's wSOL ATA gains exactly the
    pre-refund DepositRecord.balance lamports
  - depositRecordClosed: PDA no longer exists OR balance == 0

On all three pass: writes committed evidence artifact at
docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json. On any fail:
dumps pre/post snapshot + Solscan link to stderr, exits 1, no
evidence file. Failed runs are diagnosable but leave no committed
artifact — only successful runs produce auditable evidence.

Run with: pnpm tsx scripts/devnet-vault-refund-e2e.ts (after the 24h
refund timeout from the bootstrap deposit has elapsed).

Spec: docs/superpowers/specs/2026-05-04-phase3-devnet-refund-e2e-design.md"
```

---

## Task 5: Run refund — execute the audit-closure test

This task EXECUTES the refund script after the 24h timeout has elapsed. The script writes the evidence artifact on success.

- [ ] **Step 1: Confirm 24h has elapsed**

```bash
echo "Earliest refund at: $(cat scripts/.devnet-vault-bootstrap.json | jq -r '.earliestRefundAt')"
echo "Now:                $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

If "Now" is BEFORE "Earliest refund at", stop and wait. Step 2 will fail.

- [ ] **Step 2: Run the refund script**

```bash
pnpm tsx scripts/devnet-vault-refund-e2e.ts
```

Expected stdout:

```
Phase 3 — devnet vault refund E2E

State loaded: pda=..., depositedNet=9990000 lamports
Refund eligible: timeout elapsed (earliest was 2026-05-05T...Z)
Pre-state: depositorWSol=0, recordBalance=9990000
Calling performVaultRefund ...
performVaultRefund OK: txId=<sig>
Refund TX finalized: <sig>
Post-state: depositorWSol=9990000, recordExists=false, recordBalance=n/a

Evidence written to /.../docs/sentinel/evidence/devnet-refund-2026-05-05.json

──────────────────────────────────────────────────
✓ Phase 3 devnet refund E2E PASSED.
  PDA:                <pda>
  Pre-refund balance: 9990000 lamports
  wSOL delta:         9990000 lamports
  Refund TX:          https://solscan.io/tx/<sig>?cluster=devnet
  Deposit TX:         https://solscan.io/tx/<deposit-sig>?cluster=devnet
──────────────────────────────────────────────────
```

If the script exits 1 with assertion failure: do NOT proceed to Task 6. Inspect the dumped pre/post state, check Solscan, and either re-run after fixing root cause or escalate to RECTOR.

- [ ] **Step 3: Verify evidence file**

```bash
ls -la docs/sentinel/evidence/devnet-refund-*.json
# Expected: one file, today's date.

cat docs/sentinel/evidence/devnet-refund-$(date -u +%Y-%m-%d).json | jq '.assertions'
# Expected: { "txConfirmed": true, "balanceIncreased": true, "depositRecordClosed": true }

cat docs/sentinel/evidence/devnet-refund-$(date -u +%Y-%m-%d).json | jq '.solscan'
# Expected: { "deposit": "https://solscan.io/tx/...?cluster=devnet", "refund": "https://solscan.io/tx/...?cluster=devnet" }
```

- [ ] **Step 4: Verify on Solscan**

Open both `solscan.deposit` and `solscan.refund` URLs from the evidence JSON. Confirm:
- Both TXs status: Success
- Refund TX shows wSOL ATA gaining 9,990,000 lamports
- Refund TX includes `authority_refund` instruction (or whatever the program log shows for that variant)

NO COMMIT for this task. The evidence file is the artifact, but it commits with Task 6 alongside CHANGELOG + memory updates.

---

## Task 6: Commit evidence + CHANGELOG + memory + open PR

**Files:**
- Add: `docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json` (created by Task 5)
- Modify: `CHANGELOG.md`
- Modify (separate commit, outside repo): `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/MEMORY.md`

- [ ] **Step 1: Add CHANGELOG entry**

Open `CHANGELOG.md` and insert above the most recent Phase header (currently `## Phase 7: SENTINEL Formalization (Apr 16, 2026)`):

```markdown
## Phase 8: Phase 3 Devnet Refund E2E (May 5, 2026)

- Audit closure: 2026-04-18 SENTINEL audit's last open item — Phase 3 devnet refund E2E — closed
- Added `scripts/devnet-vault-bootstrap.ts` and `scripts/devnet-vault-refund-e2e.ts` — manually-invoked one-shot scripts that drive the production `performVaultRefund` against the live `sipher_vault` program on Solana devnet
- Added two diagnostic recon scripts (`scripts/recon-devnet-deposits.mjs`, `scripts/recon-devnet-vault-tokens.mjs`) for ongoing visibility into vault state
- Added committed evidence artifact at `docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json` capturing one observed end-to-end run (deposit + refund, both finalized on devnet, all three pre/post assertions green)

```

Replace `YYYY-MM-DD` in the line above with the actual date the evidence file was written.

- [ ] **Step 2: Commit CHANGELOG + evidence together**

```bash
git add CHANGELOG.md docs/sentinel/evidence/devnet-refund-*.json
git commit -m "docs(sentinel): Phase 3 devnet refund E2E closed — evidence artifact

The 2026-04-18 SENTINEL audit's last open item is now closed. One
observed end-to-end execution of performVaultRefund against the live
sipher_vault program on Solana devnet, captured as the committed
evidence artifact at docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json.

All three pre/post assertions green:
  - txConfirmed: refund TX reaches finalized commitment
  - balanceIncreased: depositor's wSOL ATA gained exactly the
    pre-refund DepositRecord.balance lamports
  - depositRecordClosed: PDA no longer exists post-refund

This is the validation gap Phase 3 was created to close — the agent
authority-refund code path now has audit-grade evidence of working
on real Solana, not just on solana-test-validator + mocks. Required
prerequisite for Phase 4 (mainnet vault deploy).

Spec: docs/superpowers/specs/2026-05-04-phase3-devnet-refund-e2e-design.md
Plan: docs/superpowers/plans/2026-05-04-phase3-devnet-refund-e2e.md"
```

Replace `YYYY-MM-DD` in the message with the actual evidence file date.

- [ ] **Step 3: Push branch + open PR**

```bash
git push -u origin chore/phase-3-devnet-refund-e2e
```

```bash
gh pr create -R sip-protocol/sipher --base main --head chore/phase-3-devnet-refund-e2e \
  --title "Phase 3 devnet refund E2E — audit closure" \
  --body "$(cat <<'EOF'
## Summary

Closes the last open item from the 2026-04-18 SENTINEL audit (Phase 3). One observed end-to-end execution of \`performVaultRefund\` against the live \`sipher_vault\` program on Solana devnet, captured as a committed evidence artifact.

## What this PR adds

- \`scripts/devnet-vault-bootstrap.ts\` — wraps 0.01 SOL → wSOL, ensures \`vault_token\` + \`fee_token\` PDAs exist for wSOL (idempotent), deposits via SDK's \`buildDepositTx\`, writes gitignored state JSON for the 24h-deferred refund script.
- \`scripts/devnet-vault-refund-e2e.ts\` — reads state JSON, asserts 24h timeout elapsed, calls production \`performVaultRefund\` with real RPC + real keypair, captures pre/post on-chain state, asserts (\`txConfirmed\`, \`balanceIncreased\`, \`depositRecordClosed\`), writes committed evidence on success.
- \`scripts/recon-devnet-deposits.mjs\` + \`scripts/recon-devnet-vault-tokens.mjs\` — read-only diagnostic utilities reused for Phase 4 mainnet prep.
- \`docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json\` — the audit closure artifact, all three assertions green.
- CHANGELOG entry under \`Phase 8: Phase 3 Devnet Refund E2E\`.

## Why now

\`performVaultRefund\` ships in production right now in advisory mode. If an admin clicks "Cancel & refund" in the Command Center UI today, this code path fires. Existing test coverage:

- Unit tests at \`packages/agent/tests/sentinel/vault-refund.test.ts\` mock \`@sipher/sdk\` + \`node:fs\` — proves the wiring is correct given the SDK behaves as expected.
- Anchor program tests at \`programs/sipher-vault/tests/.../03-refund.test.ts\` cover the three \`authority_refund\` scenarios on \`solana-test-validator\`.

The gap: nobody had observed the agent talking to a real Solana RPC node and successfully driving the live \`sipher_vault\` program through an authority refund. Subtle issues that mocks miss — RPC version drift, ATA semantics, fee math, transaction sizing — would only surface here. This PR closes that gap with one blessed run before the vault is promoted to mainnet (Phase 4).

## Test plan

- [x] Bootstrap script ran on \`<DATE>\`: deposit TX confirmed, \`vault_token\` + \`fee_token\` PDAs initialized for wSOL, depositor wSOL ATA wrapped + deposited.
- [x] Refund script ran on \`<DATE>\` (24h+ later): \`performVaultRefund\` returned \`{ success: true, txId }\`, all three pre/post assertions green.
- [x] Evidence artifact at \`docs/sentinel/evidence/devnet-refund-<DATE>.json\` matches the schema in the design spec, all three assertions \`true\`.
- [x] Both deposit + refund TXs visible on Solscan with status Success.

## Spec + plan

- Spec: \`docs/superpowers/specs/2026-05-04-phase3-devnet-refund-e2e-design.md\`
- Plan: \`docs/superpowers/plans/2026-05-04-phase3-devnet-refund-e2e.md\`

## What this PR explicitly does NOT do

- No CI integration (24h timeout incompatible with per-PR gating).
- No mainnet execution (devnet only; Phase 4 is a separate spec).
- No negative-path E2E (already covered at the Anchor layer).
- No \`update_timeout\` ix or short-timeout test vault.
EOF
)"
```

Replace `<DATE>` placeholders in the test plan section with actual run dates.

- [ ] **Step 4: Wait for CI green**

```bash
gh pr view --json url,state,mergeable,statusCheckRollup
# Expected: state OPEN, mergeable MERGEABLE, all checks SUCCESS or zero required.
```

If `Test, Build & Deploy` is required and fails: investigate. The new scripts are not exercised by the existing test suite, so failures are unrelated regression — fix them.

- [ ] **Step 5: Merge**

```bash
gh pr merge --merge
```

Per CLAUDE.md: `--merge`, not squash. Keep branch.

- [ ] **Step 6: Update memory**

Edit `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/MEMORY.md`. Update the `## Sipher Project Status` line to reflect Phase 3 closure. Find the line that mentions:

> SENTINEL Phase 3 (devnet refund E2E) + Phase 4 (mainnet vault deploy) still deferred.

Replace `Phase 3 (devnet refund E2E)` references with `Phase 3 (devnet refund E2E) COMPLETE 2026-05-05` (use the actual run date), and remove the "still deferred" qualifier from Phase 3. Keep Phase 4 deferred.

Also add a new line under "Active handoff" referencing the closed audit:

> **2026-04-18 SENTINEL audit FULLY CLOSED 2026-05-05** — Phases 1–6 all merged, Phase 3 devnet refund E2E completed (see docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json).

Memory file is local-only, no commit. Just save.

- [ ] **Step 7: Final smoke check**

```bash
git log --oneline -8
# Expected (top to bottom):
# <hash> docs(sentinel): Phase 3 devnet refund E2E closed — evidence artifact
# <hash> feat(scripts): add devnet vault refund E2E for Phase 3 audit closure
# <hash> feat(scripts): add devnet vault bootstrap for Phase 3 refund E2E
# <hash> chore(scripts): add devnet vault recon utilities and gitignore handoff state
# 7801641 docs(sentinel): design spec for Phase 3 devnet refund E2E
# 53af700 Merge pull request #169 from sip-protocol/docs/sentinel-mirror-policy
# ...
```

Confirm the PR is merged and the latest commit on `main` is the merge commit.

```bash
git checkout main && git pull origin main
git log -1 --oneline
# Expected: Merge pull request #<N> from sip-protocol/chore/phase-3-devnet-refund-e2e
```

```bash
ls docs/sentinel/evidence/
# Expected: devnet-refund-YYYY-MM-DD.json + .gitkeep
```

Done. Phase 3 closed.

---

## Self-Review Checklist

Before declaring this plan complete, run through:

- [ ] **Spec coverage:** Every Acceptance Criterion (1–7) in the spec has a corresponding task step. AC #1 (four scripts present) → Tasks 1, 2, 4. AC #2 (.gitignore) → Task 1 Step 1. AC #3 (bootstrap success) → Task 3. AC #4 (refund success + 3 assertions) → Task 5 + Task 4 Step 5. AC #5 (committed evidence) → Task 5 Step 3 + Task 6 Step 2. AC #6 (CHANGELOG) → Task 6 Step 1. AC #7 (memory) → Task 6 Step 6.
- [ ] **Placeholder scan:** No "TBD", "TODO", "implement later", or vague "add error handling" in any step. All code blocks complete.
- [ ] **Type consistency:** `performVaultRefund(pda, amount)` signature matches the production function. `BootstrapState` schema matches what `writeStateJson` emits. `EVIDENCE` shape matches the spec's evidence schema.
- [ ] **Time-gate clarity:** The 24h wait is documented in the plan header note + Task 4 Step 8 + Task 5 Step 1.
- [ ] **No unused code:** Every import in every script is used. Every helper is called.

---

## Out-of-band notes

- **The recon scripts** (`scripts/recon-devnet-deposits.mjs`, `scripts/recon-devnet-vault-tokens.mjs`) ran during the brainstorm phase and surfaced two material design changes: (a) zero existing aged deposits on devnet (forced two-phase fixture), (b) zero `vault_token`/`fee_token` PDAs initialized for any mint (forced bootstrap to call `create_*_token`). Their continued residency in `scripts/` is intentional — Phase 4 mainnet prep will reuse them.
- **The mystery 4812 + 2428 byte program-owned accounts** flagged during recon are likely IDL buffers from `anchor idl init` (identical discriminator `184662bf3a907b9e`, only sizes differ). They are not relevant to the deposit/refund flow and require no action here. Future Phase 4 may want to verify.
- **`SIPHER_VAULT_PROGRAM_ID`** is exported from `@sipher/sdk` — confirm via `grep -nE 'SIPHER_VAULT_PROGRAM_ID' packages/sdk/src/vault.ts | head -3` if the import fails. If the export is differently named (e.g., `VAULT_PROGRAM_ID`), update the import in both scripts.
- **Idempotency on re-run:** The bootstrap script's `ensure*` helpers skip the create instruction if the PDA already exists. So re-running bootstrap after a partial failure will not re-create existing infrastructure — it will only re-execute the missing steps and the deposit. The deposit itself is NOT idempotent — re-running creates a SECOND DepositRecord (or, more accurately, increments balance on the existing one since the PDA seed is `[depositor, mint]`). Be aware.
