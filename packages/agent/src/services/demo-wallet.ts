/**
 * Demo wallet service — read-only helpers that fetch on-chain + DB state
 * for the public /api/public/demo/* routes.
 *
 * Strategy B (per Wave 2b plan F1.1): re-implement queries directly using
 * the same primitives as the authed routes, instead of refactoring those
 * handlers. Justification:
 *
 *   - `vault-api.ts` (/api/vault) reads `req.wallet` injected by `verifyJwt`.
 *     Factoring its body out would require introducing a wallet-parameter
 *     surface and threading it through 90+ lines of mostly-ceremonial code
 *     (mint label tables, decimals fallback, batch fetch). The demo route
 *     only needs the same primitives (connection.getBalance + token accounts),
 *     and the duplication is small + isolated.
 *   - `/v1/privacy/score` lives in the *Mode 2* package (src/routes/privacy.ts,
 *     compiled to dist/app.js). Reusing it from the agent would mean either
 *     importing across package boundaries or HTTP-calling our own process,
 *     both of which are messier than implementing a focused privacy-score
 *     analyzer here. The 4-factor analyzers (addressReuse / amountPatterns /
 *     timingCorrelation / counterpartyExposure) are the analyzers the FE
 *     <PrivacyScoreCard> expects.
 *   - `getActivity()` is already a pure DB helper exported from `db.ts`; we
 *     call it directly (no duplication needed).
 *
 * The 60s response cache in `routes/public/demo.ts` keeps RPC + DB pressure
 * minimal so the marketing surface stays cheap regardless of traffic.
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createConnection, WSOL_MINT, USDC_MINT, USDT_MINT } from '@sipher/sdk'
import { getActivity } from '../db.js'
import { loadNetworkConfig } from '../config/network.js'

// ─── Vault ───────────────────────────────────────────────────────────────────

const MINT_LABELS: Record<string, string> = {
  [WSOL_MINT.toBase58()]: 'SOL',
  [USDC_MINT.toBase58()]: 'USDC',
  [USDT_MINT.toBase58()]: 'USDT',
}

const KNOWN_DECIMALS: Record<string, number> = {
  [WSOL_MINT.toBase58()]: 9,
  [USDC_MINT.toBase58()]: 6,
  [USDT_MINT.toBase58()]: 6,
}

export interface DemoVaultResponse {
  wallet: string
  network: string
  balances: {
    sol: number
    tokens: Array<{
      mint: string
      symbol: string
      amount: string
      decimals: number
      uiAmount: number
    }>
    status: 'ok' | 'unavailable'
  }
  activity: Array<Record<string, unknown>>
}

/**
 * Returns the demo wallet's on-chain balances + recent activity.
 * Mirrors the shape of `GET /api/vault` so the FE can reuse types.
 */
export async function getDemoVault(wallet: string): Promise<DemoVaultResponse> {
  const network = loadNetworkConfig().clusterName
  const connection = createConnection(network)

  let solBalance = 0
  let balanceStatus: 'ok' | 'unavailable' = 'ok'
  const tokens: DemoVaultResponse['balances']['tokens'] = []

  try {
    const pubkey = new PublicKey(wallet)
    const lamports = await connection.getBalance(pubkey)
    solBalance = lamports / LAMPORTS_PER_SOL

    const tokenAccounts = await connection.getTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    })

    const unknownMints: PublicKey[] = []
    const tokenEntries: { mint: PublicKey; mintStr: string; rawAmount: bigint }[] = []

    for (const { account } of tokenAccounts.value) {
      const data = account.data
      const mint = new PublicKey(data.subarray(0, 32))
      const mintStr = mint.toBase58()
      const rawAmount = data.readBigUInt64LE(64)

      if (rawAmount === 0n || mint.equals(WSOL_MINT)) continue

      tokenEntries.push({ mint, mintStr, rawAmount })
      if (!(mintStr in KNOWN_DECIMALS)) {
        unknownMints.push(mint)
      }
    }

    const fetchedDecimals: Record<string, number> = {}
    if (unknownMints.length > 0) {
      try {
        const mintAccounts = await connection.getMultipleAccountsInfo(unknownMints)
        for (let i = 0; i < unknownMints.length; i++) {
          const info = mintAccounts[i]
          if (info?.data && info.data.length >= 45) {
            fetchedDecimals[unknownMints[i].toBase58()] = info.data[44]
          }
        }
      } catch {
        // Non-fatal — fall back to 9 for unknown mints
      }
    }

    for (const { mintStr, rawAmount } of tokenEntries) {
      const symbol = MINT_LABELS[mintStr] ?? mintStr.slice(0, 8) + '...'
      const decimals = KNOWN_DECIMALS[mintStr] ?? fetchedDecimals[mintStr] ?? 9
      const uiAmount = Number(rawAmount) / 10 ** decimals
      tokens.push({ mint: mintStr, symbol, amount: rawAmount.toString(), decimals, uiAmount })
    }
  } catch (err) {
    balanceStatus = 'unavailable'
    console.warn('[demo-wallet] vault balance fetch failed:', err instanceof Error ? err.message : err)
  }

  const activity = getActivity(wallet, { limit: 20 })

  return {
    wallet,
    network,
    balances: { sol: solBalance, tokens, status: balanceStatus },
    activity,
  }
}

// ─── Activity ────────────────────────────────────────────────────────────────

/**
 * Pure DB read — returns the activity stream for the demo wallet.
 * Matches the shape returned by GET /api/activity.
 */
export function getDemoActivity(wallet: string): Array<Record<string, unknown>> {
  return getActivity(wallet, { limit: 50 })
}

// ─── Privacy score ───────────────────────────────────────────────────────────

interface PrivacyFactor {
  score: number
  weight: number
  detail: string
}

export interface DemoPrivacyScoreResponse {
  address: string
  score: number
  grade: string
  transactionsAnalyzed: number
  factors: {
    addressReuse: { score: number; detail: string }
    amountPatterns: { score: number; detail: string }
    timingCorrelation: { score: number; detail: string }
    counterpartyExposure: { score: number; detail: string }
  }
  recommendations: string[]
}

function computeGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

const KNOWN_PROGRAMS = new Set([
  '11111111111111111111111111111111', // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', // Serum DEX
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
  'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr', // Raydium
  'So1endDq2YkqhipRh3WViPa8hFb7GVETnyRcDMEVXHi', // Solend
  'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68', // Marinade
])

function analyzeAddressReuse(
  transactions: Array<{ to: Set<string>; from: string }>,
  address: string,
): PrivacyFactor {
  const counterparties = new Set<string>()
  let txCount = 0
  for (const tx of transactions) {
    txCount++
    for (const addr of tx.to) {
      if (addr !== address) counterparties.add(addr)
    }
  }
  if (txCount === 0) {
    return { score: 100, weight: 0.25, detail: 'No transaction history to analyze' }
  }
  const ratio = counterparties.size / txCount
  const score = Math.min(100, Math.round(ratio * 100))
  const detail = counterparties.size === 0
    ? 'No counterparty addresses found'
    : `${counterparties.size} unique counterparties across ${txCount} transactions`
  return { score, weight: 0.25, detail }
}

function analyzeAmountPatterns(amounts: bigint[]): PrivacyFactor {
  if (amounts.length === 0) {
    return { score: 100, weight: 0.25, detail: 'No transfer amounts to analyze' }
  }
  const SOL_DECIMALS = 1_000_000_000n
  let roundCount = 0
  for (const amt of amounts) {
    if (amt === 0n) continue
    if (amt % (SOL_DECIMALS / 10n) === 0n) roundCount++
  }
  const roundRatio = roundCount / amounts.length
  const score = Math.round((1 - roundRatio) * 100)
  const detail = roundCount === 0
    ? 'No round amount patterns detected'
    : `${roundCount} of ${amounts.length} transfers use round amounts`
  return { score, weight: 0.25, detail }
}

function analyzeTimingCorrelation(timestamps: number[]): PrivacyFactor {
  if (timestamps.length < 3) {
    return { score: 100, weight: 0.25, detail: 'Insufficient transactions for timing analysis' }
  }
  const sorted = [...timestamps].sort((a, b) => a - b)
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) intervals.push(sorted[i] - sorted[i - 1])
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
  let regular = 0
  for (const interval of intervals) {
    if (Math.abs(interval - avg) < avg * 0.1) regular++
  }
  const regularRatio = regular / intervals.length
  const score = Math.round((1 - regularRatio * 0.8) * 100)
  const detail = regularRatio > 0.5
    ? `Regular transfer pattern detected (${regular} of ${intervals.length} intervals are periodic)`
    : 'No significant timing correlation detected'
  return { score, weight: 0.25, detail }
}

function analyzeCounterpartyExposure(
  transactions: Array<{ to: Set<string> }>,
): PrivacyFactor {
  if (transactions.length === 0) {
    return { score: 100, weight: 0.25, detail: 'No counterparty exposure to analyze' }
  }
  let interactions = 0
  const programs = new Set<string>()
  for (const tx of transactions) {
    for (const addr of tx.to) {
      if (KNOWN_PROGRAMS.has(addr)) {
        interactions++
        programs.add(addr)
      }
    }
  }
  const ratio = Math.min(1, interactions / transactions.length)
  const score = Math.round((1 - ratio * 0.7) * 100)
  const detail = programs.size === 0
    ? 'No interactions with known entities detected'
    : `Connected to ${programs.size} known entities across ${interactions} interactions`
  return { score, weight: 0.25, detail }
}

/**
 * Returns the 4-factor privacy score for the demo wallet. Mirrors the shape
 * returned by Mode 2's POST /v1/privacy/score so the FE PrivacyScoreCard
 * can render the response without modification.
 */
export async function getDemoPrivacyScore(
  wallet: string,
  limit = 100,
): Promise<DemoPrivacyScoreResponse> {
  const network = loadNetworkConfig().clusterName
  const connection = createConnection(network)

  let pubkey: PublicKey
  try {
    pubkey = new PublicKey(wallet)
  } catch {
    throw new Error(`Invalid demo wallet address: ${wallet}`)
  }

  const signatures = await connection.getSignaturesForAddress(pubkey, { limit })

  const txData: Array<{ to: Set<string>; from: string }> = []
  const amounts: bigint[] = []
  const timestamps: number[] = []

  for (const sigInfo of signatures) {
    if (sigInfo.blockTime) timestamps.push(sigInfo.blockTime)
    try {
      const tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      })
      if (!tx?.meta) continue
      const accountKeys = tx.transaction.message.getAccountKeys
        ? tx.transaction.message.getAccountKeys().staticAccountKeys.map((k: PublicKey) => k.toBase58())
        : ((tx.transaction.message as unknown as { accountKeys?: PublicKey[] }).accountKeys ?? []).map((k) =>
            k.toBase58(),
          )
      const toAddresses = new Set<string>(accountKeys)
      txData.push({ to: toAddresses, from: wallet })
      if (tx.meta.preBalances && tx.meta.postBalances) {
        for (let i = 0; i < tx.meta.preBalances.length; i++) {
          const diff = Math.abs(tx.meta.postBalances[i] - tx.meta.preBalances[i])
          if (diff > 0) amounts.push(BigInt(diff))
        }
      }
    } catch {
      // Skip failed tx parsing — demo is best-effort.
    }
  }

  const addressReuse = analyzeAddressReuse(txData, wallet)
  const amountPatterns = analyzeAmountPatterns(amounts)
  const timingCorrelation = analyzeTimingCorrelation(timestamps)
  const counterpartyExposure = analyzeCounterpartyExposure(txData)

  const factors = { addressReuse, amountPatterns, timingCorrelation, counterpartyExposure }
  const totalWeight = Object.values(factors).reduce((sum, f) => sum + f.weight, 0)
  const weighted = Object.values(factors).reduce((sum, f) => sum + f.score * f.weight, 0)
  const score = Math.round(weighted / totalWeight)
  const grade = computeGrade(score)

  const recommendations: string[] = []
  if (addressReuse.score < 70) recommendations.push('Use stealth addresses for receiving payments to break linkability.')
  if (amountPatterns.score < 70) recommendations.push('Use shielded transfers with non-round amounts to defeat heuristics.')
  if (timingCorrelation.score < 70) recommendations.push('Randomize transaction timing to avoid pattern detection.')
  if (counterpartyExposure.score < 70) recommendations.push('Use viewing keys for selective disclosure on regulated interactions.')
  if (recommendations.length === 0) recommendations.push('Maintain good privacy hygiene by using stealth addresses regularly.')

  return {
    address: wallet,
    score,
    grade,
    transactionsAnalyzed: signatures.length,
    factors: {
      addressReuse: { score: addressReuse.score, detail: addressReuse.detail },
      amountPatterns: { score: amountPatterns.score, detail: amountPatterns.detail },
      timingCorrelation: { score: timingCorrelation.score, detail: timingCorrelation.detail },
      counterpartyExposure: { score: counterpartyExposure.score, detail: counterpartyExposure.detail },
    },
    recommendations,
  }
}
