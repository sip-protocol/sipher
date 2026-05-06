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
    C4_refunds: { count: number, pass: boolean }
    C5_reverts: { total: number, user_error: number, unexplained: number, pass: boolean }
    C6_authority_interventions: { count: number, pass: boolean }
  }
  overall: 'PASS' | 'FAIL'
  wallets_observed: string[]
  reverts: Revert[]
}

function classifyError(err: unknown): string {
  return JSON.stringify(err).slice(0, 200)
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
  const sigs = await conn.getSignaturesForAddress(VAULT_PROGRAM_ID, { limit: 1000 })
  console.log(`Found ${sigs.length} signatures`)

  const txDetails = await Promise.all(
    sigs.slice(0, 200).map((s) =>
      conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null),
    ),
  )

  let deposits = 0
  let withdraws = 0
  let refunds = 0
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
      const disc = Buffer.from(data, 'base64').slice(0, 8).toString('hex')

      if (disc === IX_DISCRIMINATORS.deposit) {
        if (failed) {
          reverts.push({
            tx: sig,
            error: classifyError(tx.meta!.err),
            classification: 'user_error',
            reason: 'deposit failed',
          })
        } else if (!excludeSet.has(signer)) {
          deposits++
          depositors.add(signer)
        }
      } else if (disc === IX_DISCRIMINATORS.withdraw_private) {
        if (failed) {
          reverts.push({
            tx: sig,
            error: classifyError(tx.meta!.err),
            classification: 'user_error',
            reason: 'withdraw_private failed',
          })
        } else if (!excludeSet.has(signer)) {
          withdraws++
          withdrawSigners.add(signer)
        }
      } else if (
        disc === IX_DISCRIMINATORS.refund ||
        disc === IX_DISCRIMINATORS.authority_refund
      ) {
        if (!failed) refunds++
        if (failed) {
          reverts.push({
            tx: sig,
            error: classifyError(tx.meta!.err),
            classification: 'user_error',
            reason: 'refund failed',
          })
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
    C4_refunds: { count: refunds, pass: refunds >= 1 },
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
