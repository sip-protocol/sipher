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

type VaultConfigState = {
  pda: PublicKey
  authority: PublicKey
  feeTenthsBps: number
  refundTimeout: number
  paused: boolean
  totalDeposits: number
  totalDepositors: number
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
    `feeTenthsBps=${cfg.feeTenthsBps}, refundTimeout=${cfg.refundTimeout}s, paused=${cfg.paused}`,
  )
  return { pda: configPDA, ...cfg }
}

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
  const [recordPDA] = deriveDepositRecordPDA(depositor.publicKey, NATIVE_MINT)
  const existing = await conn.getAccountInfo(recordPDA, 'confirmed')
  if (existing) {
    const record = deserializeDepositRecord(Buffer.from(existing.data))
    throw new Error(
      `DepositRecord already exists at ${recordPDA.toBase58()} ` +
      `(last_deposit_at=${new Date(Number(record.lastDepositAt) * 1000).toISOString()}). ` +
      `Re-running would reset the 24h refund timer. Either delete ` +
      `scripts/.devnet-vault-bootstrap.json and reuse the existing PDA via the refund script, ` +
      `or use a different depositor keypair.`,
    )
  }

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
  const record = deserializeDepositRecord(Buffer.from(recordInfo.data))
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
    feeTenthsBps: cfg.feeTenthsBps,
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
  console.log(`  Net balance:        ${record.balance} lamports (no fee on deposit)`)
  console.log(`  Earliest refund at: ${earliestRefundAt}`)
  console.log(`  Solscan:            https://solscan.io/tx/${depositTxId}?cluster=devnet`)
  console.log(`\n  Run scripts/devnet-vault-refund-e2e.ts after that time.`)
  console.log('──────────────────────────────────────────────────\n')
}

main().catch((err) => {
  console.error('\n✗ Bootstrap failed:', err.message ?? err)
  process.exit(1)
})
