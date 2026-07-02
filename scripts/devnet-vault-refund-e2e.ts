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
  feeTenthsBps: number
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

  // Set env vars before calling performVaultRefund — it reads them at function-call time
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
  const assertions = await computeAssertions(conn, pre, post, result.txId)

  if (!assertions.txConfirmed || !assertions.balanceIncreased || !assertions.depositRecordClosed) {
    dumpFailure(pre, post, assertions, result.txId)
    process.exit(1)
  }

  writeEvidence(state, result.txId, refundConfirmedAt, pre, post, assertions)
  printSummary(state, result.txId, pre, post)
}

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

type Assertions = {
  txConfirmed: boolean
  balanceIncreased: boolean
  depositRecordClosed: boolean
  wSolDelta: bigint
  expectedDelta: bigint
}

async function computeAssertions(
  conn: Connection,
  pre: PreState,
  post: PostState,
  txId: string,
): Promise<Assertions> {
  const wSolDelta = post.depositorWSolBalance - pre.depositorWSolBalance
  const expectedDelta = pre.depositRecordBalance
  const tx = await conn.getTransaction(txId, {
    commitment: 'finalized',
    maxSupportedTransactionVersion: 0,
  })
  const txConfirmed = tx !== null && tx.meta?.err === null
  const balanceIncreased = wSolDelta === expectedDelta
  const depositRecordClosed = !post.recordExists || (post.recordBalance ?? 1n) === 0n
  return { txConfirmed, balanceIncreased, depositRecordClosed, wSolDelta, expectedDelta }
}

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
    feeTenthsBps: state.feeTenthsBps,
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

main().catch((err) => {
  console.error('\n✗ Refund E2E failed:', err.message ?? err)
  process.exit(1)
})
