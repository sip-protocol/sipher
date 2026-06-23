// scripts/devnet-beta-gate-check.ts
// Phase 4a — Devnet Beta gate criteria check.
//
// Reads on-chain TX history for the devnet sipher_vault program, classifies
// each TX as deposit/withdraw/refund/admin/other, counts distinct non-RECTOR
// wallets per category, classifies failed TXs as user-error vs unexplained,
// and emits a structured evidence JSON to docs/sentinel/evidence/.
//
// Run: pnpm tsx scripts/devnet-beta-gate-check.ts
// Output: docs/sentinel/evidence/devnet-beta-gate-{YYYY-MM-DD}.json

import { Connection, PublicKey } from '@solana/web3.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import bs58 from 'bs58'

const VAULT_PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const RPC_URL = process.env.SIPHER_DEVNET_RPC ?? 'https://api.devnet.solana.com'
const PUBLIC_LAUNCH_AT_ENV = process.env.SIPHER_BETA_LAUNCH_AT  // ISO timestamp, set when X thread #1 publishes
const EXCLUDE_PATH = join(process.cwd(), 'scripts/WALLETS_TO_EXCLUDE.json')
const EVIDENCE_DIR = join(process.cwd(), 'docs/sentinel/evidence')

// Anchor instruction discriminators for sipher_vault — sha256("global:<ix_name>")[..8]
// Generated via /tmp/print-discriminators.ts; verify against actual TX data on devnet
const IX_DISCRIMINATORS = {
  deposit: 'f223c68952e1f2b6',
  withdraw_private: 'be93840ab9183fd5',
  refund: '0260b7fb3fd02e2e',
  authority_refund: '5aef4ed17d0f7d1c',
  set_paused: '5b3c7dc0b0e1a6da',
  update_fee: 'e8fdc3f794d449de',
  collect_fee: '3cadf767045d8230',
  initialize: 'afaf6d1f0d989bed',
  create_vault_token: '311005db3dfd3069',
  create_fee_token: '1e8de72a6a9ba5af',
}

type Revert = {
  tx: string
  error: string
  classification: 'user_error' | 'unexplained'
  reason: string
}

type GateResult = {
  checkedAt: string
  checkedAgainstSlot: number
  publicLaunchAt: string | null
  criteria: {
    C1_days_since_launch: { value: number, pass: boolean }
    C2_deposits: { count: number, distinct_wallets: number, pass: boolean }
    C3_withdraws: { count: number, distinct_wallets: number, pass: boolean }
    C4_refunds: { authority_refunds: number, user_refunds: number, pass: boolean }
    C5_reverts: { total: number, user_error: number, unexplained: number, pass: boolean }
    C6_authority_interventions: { count: number, pass: boolean }
  }
  overall: 'PASS' | 'FAIL'
  wallets_observed: string[]
  reverts: Revert[]
}

// Custom error codes from the sipher_vault IDL (aligned to the B6 enum).
// User errors are clearly caller-side mistakes; anything else is unexplained and fails C5.
// NOTE: 6010 is now AnnouncementCpiFailed (a CPI/system failure, not a user error) —
// the removed BalanceLocked variant no longer exists, so it is intentionally absent here.
const USER_ERROR_CODES = new Set([
  6000, // ProgramPaused
  6001, // Unauthorized
  6002, // InsufficientBalance
  6004, // ZeroDeposit
  6005, // RefundNotExpired
  6006, // NothingToRefund
])

function classifyError(err: unknown): { error: string; classification: 'user_error' | 'unexplained' } {
  const errStr = JSON.stringify(err).slice(0, 200)
  // Anchor Custom error variant: { InstructionError: [ixIndex, { Custom: <code> }] }
  const customMatch = JSON.stringify(err).match(/"Custom"\s*:\s*(\d+)/)
  if (customMatch) {
    const code = Number(customMatch[1])
    if (USER_ERROR_CODES.has(code)) {
      return { error: errStr, classification: 'user_error' }
    }
  }
  return { error: errStr, classification: 'unexplained' }
}

async function main(): Promise<void> {
  console.log('Phase 4a — devnet beta gate check\n')
  const launchAt = PUBLIC_LAUNCH_AT_ENV ? new Date(PUBLIC_LAUNCH_AT_ENV) : null
  if (!launchAt) {
    console.warn('⚠️  SIPHER_BETA_LAUNCH_AT not set — C1 will report 0 days since launch')
  }

  const conn = new Connection(RPC_URL, 'confirmed')
  const excludeRaw = JSON.parse(readFileSync(EXCLUDE_PATH, 'utf-8')) as { wallets: string[] }
  const excludeSet = new Set(excludeRaw.wallets)

  console.log(`Querying TX history for program ${VAULT_PROGRAM_ID.toBase58()} ...`)
  const sigs = await conn.getSignaturesForAddress(VAULT_PROGRAM_ID, { limit: 200 })
  console.log(`Found ${sigs.length} signatures`)

  const txDetails = await Promise.all(
    sigs.map((s) =>
      conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null),
    ),
  )

  let deposits = 0
  let withdraws = 0
  let userRefunds = 0
  let authorityRefunds = 0
  let authorityInterventions = 0
  const depositors = new Set<string>()
  const withdrawSigners = new Set<string>()
  const reverts: Revert[] = []
  const allWallets = new Set<string>()

  for (let i = 0; i < txDetails.length; i++) {
    const tx = txDetails[i]
    if (!tx) continue
    const sig = sigs[i].signature
    const failed = tx.meta?.err !== null && tx.meta?.err !== undefined

    const ixs = tx.transaction.message.instructions.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ix: any) => ix.programId?.equals?.(VAULT_PROGRAM_ID),
    )
    if (ixs.length === 0) continue

    const signer = tx.transaction.message.accountKeys[0].pubkey.toBase58()
    allWallets.add(signer)

    for (const ix of ixs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (ix as any).data ?? ''
      // getParsedTransaction returns bs58-encoded data for unknown (Anchor) programs —
      // NOT base64. Using base64 silently produces wrong bytes and breaks all discriminator matches.
      const disc = Buffer.from(bs58.decode(data)).slice(0, 8).toString('hex')

      if (disc === IX_DISCRIMINATORS.deposit) {
        if (failed) {
          const { error, classification } = classifyError(tx.meta!.err)
          reverts.push({ tx: sig, error, classification, reason: 'deposit failed' })
        } else if (!excludeSet.has(signer)) {
          deposits++
          depositors.add(signer)
        }
      } else if (disc === IX_DISCRIMINATORS.withdraw_private) {
        if (failed) {
          const { error, classification } = classifyError(tx.meta!.err)
          reverts.push({ tx: sig, error, classification, reason: 'withdraw_private failed' })
        } else if (!excludeSet.has(signer)) {
          withdraws++
          withdrawSigners.add(signer)
        }
      } else if (disc === IX_DISCRIMINATORS.authority_refund) {
        if (failed) {
          const { error, classification } = classifyError(tx.meta!.err)
          reverts.push({ tx: sig, error, classification, reason: 'authority_refund failed' })
        } else {
          authorityRefunds++
        }
      } else if (disc === IX_DISCRIMINATORS.refund) {
        if (failed) {
          const { error, classification } = classifyError(tx.meta!.err)
          reverts.push({ tx: sig, error, classification, reason: 'refund failed' })
        } else {
          userRefunds++
        }
      } else if (
        disc === IX_DISCRIMINATORS.set_paused ||
        disc === IX_DISCRIMINATORS.update_fee ||
        disc === IX_DISCRIMINATORS.collect_fee
      ) {
        if (!failed) authorityInterventions++
      }
    }
  }

  const userErrorReverts = reverts.filter((r) => r.classification === 'user_error').length
  const unexplainedReverts = reverts.length - userErrorReverts

  const now = new Date()
  const daysSinceLaunch = launchAt ? (now.getTime() - launchAt.getTime()) / 86400_000 : 0

  const criteria: GateResult['criteria'] = {
    C1_days_since_launch: {
      value: Math.round(daysSinceLaunch * 10) / 10,
      pass: daysSinceLaunch >= 3,
    },
    C2_deposits: {
      count: deposits,
      distinct_wallets: depositors.size,
      pass: deposits >= 5 && depositors.size >= 3,
    },
    C3_withdraws: {
      count: withdraws,
      distinct_wallets: withdrawSigners.size,
      pass: withdraws >= 3 && withdrawSigners.size >= 2,
    },
    C4_refunds: { authority_refunds: authorityRefunds, user_refunds: userRefunds, pass: authorityRefunds >= 1 },
    C5_reverts: {
      total: reverts.length,
      user_error: userErrorReverts,
      unexplained: unexplainedReverts,
      pass: unexplainedReverts === 0,
    },
    C6_authority_interventions: { count: authorityInterventions, pass: authorityInterventions === 0 },
  }

  const overall: 'PASS' | 'FAIL' = Object.values(criteria).every((c) => c.pass) ? 'PASS' : 'FAIL'

  const result: GateResult = {
    checkedAt: now.toISOString(),
    checkedAgainstSlot: await conn.getSlot('confirmed'),
    publicLaunchAt: launchAt?.toISOString() ?? null,
    criteria,
    overall,
    wallets_observed: Array.from(allWallets).filter((w) => !excludeSet.has(w)),
    reverts,
  }

  mkdirSync(EVIDENCE_DIR, { recursive: true })
  const outPath = join(EVIDENCE_DIR, `devnet-beta-gate-${now.toISOString().slice(0, 10)}.json`)
  writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`\nEvidence written: ${outPath}`)
  console.log(`Overall: ${overall}`)
  for (const [k, v] of Object.entries(criteria)) {
    console.log(`  ${k}: ${JSON.stringify(v)}`)
  }
}

main().catch((err) => {
  console.error('\n✗ Gate check failed:', err.message ?? err)
  process.exit(1)
})
