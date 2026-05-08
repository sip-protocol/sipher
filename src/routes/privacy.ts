import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PublicKey } from '@solana/web3.js'
import { toBaseUnits } from '@sipher/sdk'
import { validateRequest } from '../middleware/validation.js'
import { getConnection } from '../services/solana.js'

const router = Router()

// ─── Schemas ────────────────────────────────────────────────────────────────

const scoreSchema = z.object({
  address: z.string().min(32).max(44),
  limit: z.number().int().min(10).max(500).default(100),
  // projectedAmount + projectedToken are validated explicitly in the handler
  // (NOT via zod) so that the error codes (INVALID_PROJECTED_AMOUNT, INVALID_TOKEN)
  // match the spec envelope rather than zod's default schema-error shape.
  projectedAmount: z.number().optional(),
  projectedToken: z.string().optional(),
})

// ─── Types ──────────────────────────────────────────────────────────────────

interface PrivacyFactor {
  score: number
  weight: number
  detail: string
}

function computeGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

// ─── Analysis Functions ─────────────────────────────────────────────────────

function analyzeAddressReuse(
  transactions: Array<{ to: Set<string>; from: string }>,
  address: string
): PrivacyFactor {
  // Count unique counterparties — fewer unique addresses = more reuse patterns
  const allCounterparties = new Set<string>()
  let txCount = 0

  for (const tx of transactions) {
    txCount++
    for (const addr of tx.to) {
      if (addr !== address) allCounterparties.add(addr)
    }
  }

  if (txCount === 0) {
    return { score: 100, weight: 0.25, detail: 'No transaction history to analyze' }
  }

  // Ratio of unique counterparties to transactions
  // High ratio = good privacy (many different addresses)
  // Low ratio = poor privacy (same addresses reused)
  const ratio = allCounterparties.size / txCount
  const score = Math.min(100, Math.round(ratio * 100))

  const detail = allCounterparties.size === 0
    ? 'No counterparty addresses found'
    : `${allCounterparties.size} unique counterparties across ${txCount} transactions`

  return { score, weight: 0.25, detail }
}

function analyzeAmountPatterns(amounts: bigint[]): PrivacyFactor {
  if (amounts.length === 0) {
    return { score: 100, weight: 0.25, detail: 'No transfer amounts to analyze' }
  }

  // Check for round amount patterns (suspicious for privacy)
  let roundCount = 0
  const SOL_DECIMALS = 1000000000n // 1 SOL = 10^9 lamports

  for (const amt of amounts) {
    if (amt === 0n) continue
    // Check if divisible by 0.1 SOL, 0.5 SOL, 1 SOL, 10 SOL
    if (amt % (SOL_DECIMALS / 10n) === 0n) roundCount++
  }

  const roundRatio = roundCount / amounts.length
  // More round amounts = worse privacy (easier to correlate)
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

  // Sort and compute intervals
  const sorted = [...timestamps].sort((a, b) => a - b)
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i] - sorted[i - 1])
  }

  // Check for regular intervals (suggesting automated/scheduled transfers)
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  let regularCount = 0

  for (const interval of intervals) {
    // If interval is within 10% of average, it's "regular"
    if (Math.abs(interval - avgInterval) < avgInterval * 0.1) {
      regularCount++
    }
  }

  const regularRatio = regularCount / intervals.length
  // More regular timing = worse privacy (predictable patterns)
  const score = Math.round((1 - regularRatio * 0.8) * 100)

  const detail = regularRatio > 0.5
    ? `Regular transfer pattern detected (${regularCount} of ${intervals.length} intervals are periodic)`
    : 'No significant timing correlation detected'

  return { score, weight: 0.25, detail }
}

function analyzeCounterpartyExposure(
  transactions: Array<{ to: Set<string> }>,
  knownPrograms: Set<string>
): PrivacyFactor {
  if (transactions.length === 0) {
    return { score: 100, weight: 0.25, detail: 'No counterparty exposure to analyze' }
  }

  // Check interactions with known programs/exchanges
  let knownInteractions = 0
  const interactedPrograms = new Set<string>()

  for (const tx of transactions) {
    for (const addr of tx.to) {
      if (knownPrograms.has(addr)) {
        knownInteractions++
        interactedPrograms.add(addr)
      }
    }
  }

  // More known entity interactions = more exposure
  const exposureRatio = Math.min(1, knownInteractions / transactions.length)
  const score = Math.round((1 - exposureRatio * 0.7) * 100)

  const detail = interactedPrograms.size === 0
    ? 'No interactions with known entities detected'
    : `Connected to ${interactedPrograms.size} known entities across ${knownInteractions} interactions`

  return { score, weight: 0.25, detail }
}

// Known Solana programs and exchanges that represent exposure
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

// Decimals lookup for the 3 tokens the projection accepts. We keep this local
// (rather than calling SDK's `getTokenDecimals(mint)`) so that the spec's
// `INVALID_TOKEN` rejection covers anything that isn't SOL / USDC / USDT —
// `resolveTokenMint` would happily accept arbitrary base58 mints.
const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
}

// ─── Route ──────────────────────────────────────────────────────────────────

router.post(
  '/privacy/score',
  validateRequest({ body: scoreSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address, limit } = req.body
      const connection = getConnection()

      // Validate address
      let pubkey: PublicKey
      try {
        pubkey = new PublicKey(address)
      } catch {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ADDRESS', message: 'Invalid Solana address' },
        })
        return
      }

      // Fetch transaction history
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
            : (tx.transaction.message as any).accountKeys?.map((k: PublicKey) => k.toBase58()) || []

          const toAddresses = new Set<string>(accountKeys)

          txData.push({ to: toAddresses, from: address })

          // Extract SOL transfer amounts from balance changes
          if (tx.meta.preBalances && tx.meta.postBalances) {
            for (let i = 0; i < tx.meta.preBalances.length; i++) {
              const diff = Math.abs(tx.meta.postBalances[i] - tx.meta.preBalances[i])
              if (diff > 0) amounts.push(BigInt(diff))
            }
          }
        } catch {
          // Skip failed tx parsing
        }
      }

      // Run analysis
      const addressReuse = analyzeAddressReuse(txData, address)
      const amountPatterns = analyzeAmountPatterns(amounts)
      const timingCorrelation = analyzeTimingCorrelation(timestamps)
      const counterpartyExposure = analyzeCounterpartyExposure(txData, KNOWN_PROGRAMS)

      // Compute weighted score
      const factors = { addressReuse, amountPatterns, timingCorrelation, counterpartyExposure }
      const totalWeight = Object.values(factors).reduce((sum, f) => sum + f.weight, 0)
      const weightedScore = Object.values(factors).reduce(
        (sum, f) => sum + f.score * f.weight,
        0
      )
      const score = Math.round(weightedScore / totalWeight)
      const grade = computeGrade(score)

      // Generate recommendations based on weak factors
      const recommendations: string[] = []

      if (addressReuse.score < 70) {
        recommendations.push('Use stealth addresses for receiving (POST /v1/stealth/generate)')
      }
      if (amountPatterns.score < 70) {
        recommendations.push('Use shielded transfers to hide amounts (POST /v1/transfer/shield)')
      }
      if (timingCorrelation.score < 70) {
        recommendations.push('Randomize transaction timing to avoid pattern detection')
      }
      if (counterpartyExposure.score < 70) {
        recommendations.push('Use viewing keys for selective disclosure (POST /v1/viewing-key/generate)')
      }
      if (score < 50) {
        recommendations.push('Enable full privacy pipeline: generate → derive → shield → claim')
      }
      if (recommendations.length === 0) {
        recommendations.push('Maintain good privacy hygiene by using stealth addresses regularly')
      }

      // ─── Projected score (optional) ─────────────────────────────────────
      // When the client passes `projectedAmount` (and optionally `projectedToken`),
      // re-run the four analyzers over the existing on-chain history augmented
      // with one synthetic shielded deposit. The response then includes a
      // `projected` block plus `delta` so the UI can show "your score WILL
      // become X if you deposit Y."
      let projectedBlock:
        | {
            score: number
            grade: string
            factors: Record<string, { score: number; detail: string }>
            delta: {
              score: number
              addressReuse: number
              amountPatterns: number
              timingCorrelation: number
              counterpartyExposure: number
            }
          }
        | undefined

      if (req.body.projectedAmount !== undefined) {
        if (
          typeof req.body.projectedAmount !== 'number' ||
          !Number.isFinite(req.body.projectedAmount) ||
          req.body.projectedAmount <= 0 ||
          req.body.projectedAmount > Number.MAX_SAFE_INTEGER
        ) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PROJECTED_AMOUNT',
              message: 'projectedAmount must be a finite number in (0, Number.MAX_SAFE_INTEGER]',
            },
          })
          return
        }

        // Match `vault-deposit-tx` parity: accept `'sol'`, `'SOL'`, etc.
        const projectedToken = (req.body.projectedToken ?? 'SOL').toUpperCase()
        if (!(projectedToken in TOKEN_DECIMALS)) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'projectedToken must be SOL, USDC, or USDT' },
          })
          return
        }

        const projectedBaseUnits = toBaseUnits(
          req.body.projectedAmount,
          TOKEN_DECIMALS[projectedToken]
        )

        // Append a synthetic shielded deposit record to the analysis input.
        // Fresh stealth destination: 44-char base58 placeholder that will
        // never collide with a real address (all '1' = leading zero bytes).
        const SYNTHETIC_STEALTH_ADDR = '1' + '1'.repeat(43)
        const synthTxData = [
          ...txData,
          { to: new Set<string>([SYNTHETIC_STEALTH_ADDR]), from: address },
        ]
        const synthAmounts = [...amounts, projectedBaseUnits]
        const synthTimestamps = [...timestamps, Math.floor(Date.now() / 1000)]

        const pAddressReuse = analyzeAddressReuse(synthTxData, address)
        const pAmountPatterns = analyzeAmountPatterns(synthAmounts)
        const pTimingCorrelation = analyzeTimingCorrelation(synthTimestamps)
        const pCounterpartyExposure = analyzeCounterpartyExposure(synthTxData, KNOWN_PROGRAMS)

        const pFactors = {
          addressReuse: pAddressReuse,
          amountPatterns: pAmountPatterns,
          timingCorrelation: pTimingCorrelation,
          counterpartyExposure: pCounterpartyExposure,
        }
        const pTotalWeight = Object.values(pFactors).reduce((sum, f) => sum + f.weight, 0)
        const pWeighted = Object.values(pFactors).reduce((sum, f) => sum + f.score * f.weight, 0)
        const pScore = Math.round(pWeighted / pTotalWeight)
        const pGrade = computeGrade(pScore)

        projectedBlock = {
          score: pScore,
          grade: pGrade,
          factors: {
            addressReuse: { score: pAddressReuse.score, detail: pAddressReuse.detail },
            amountPatterns: { score: pAmountPatterns.score, detail: pAmountPatterns.detail },
            timingCorrelation: { score: pTimingCorrelation.score, detail: pTimingCorrelation.detail },
            counterpartyExposure: {
              score: pCounterpartyExposure.score,
              detail: pCounterpartyExposure.detail,
            },
          },
          delta: {
            score: pScore - score,
            addressReuse: pAddressReuse.score - addressReuse.score,
            amountPatterns: pAmountPatterns.score - amountPatterns.score,
            timingCorrelation: pTimingCorrelation.score - timingCorrelation.score,
            counterpartyExposure: pCounterpartyExposure.score - counterpartyExposure.score,
          },
        }
      }

      res.json({
        success: true,
        data: {
          address,
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
          ...(projectedBlock ? { projected: projectedBlock } : {}),
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
