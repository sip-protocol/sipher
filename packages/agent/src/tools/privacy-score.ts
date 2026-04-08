import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import { createConnection } from '@sipher/sdk'
import { classifyAddress } from '../data/known-addresses.js'

export interface PrivacyScoreParams {
  wallet: string
  limit?: number
}

export interface PrivacyScoreToolResult {
  action: 'privacyScore'
  status: 'success'
  score: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  message: string
  exposurePoints: string[]
  recommendations: string[]
  analysis: {
    txCount: number
    exchangeInteractions: number
    uniqueCounterparties: number
    exchangeLabels: string[]
  }
}

export const privacyScoreTool: Anthropic.Tool = {
  name: 'privacyScore',
  description:
    'Analyze a wallet\'s on-chain privacy exposure (0-100 score). ' +
    'Checks transaction history for exchange interactions, counterparty clustering, ' +
    'and known labeled addresses. Higher score = better privacy.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: {
        type: 'string',
        description: 'Wallet address (base58) to analyze',
      },
      limit: {
        type: 'number',
        description: 'Number of recent transactions to analyze (default: 50, max: 200)',
      },
    },
    required: ['wallet'],
  },
}

export async function executePrivacyScore(
  params: PrivacyScoreParams,
): Promise<PrivacyScoreToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required for privacy scoring')
  }

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const network = (process.env.SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  let walletPubkey: PublicKey
  try {
    walletPubkey = new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  const signatures = await connection.getSignaturesForAddress(walletPubkey, { limit })

  if (signatures.length === 0) {
    return {
      action: 'privacyScore',
      status: 'success',
      score: 100,
      riskLevel: 'low',
      message: 'No transactions found — wallet has no on-chain exposure.',
      exposurePoints: [],
      recommendations: ['Continue using stealth addresses for all transactions.'],
      analysis: {
        txCount: 0,
        exchangeInteractions: 0,
        uniqueCounterparties: 0,
        exchangeLabels: [],
      },
    }
  }

  const sigStrings = signatures.map((s) => s.signature)
  const parsedTxs = await connection.getParsedTransactions(sigStrings, {
    maxSupportedTransactionVersion: 0,
  })

  const counterparties = new Set<string>()
  const exchangeHits: Record<string, number> = {}
  let exchangeInteractions = 0

  for (const tx of parsedTxs) {
    if (!tx || tx.meta?.err) continue
    const accounts = tx.transaction.message.accountKeys
    for (const account of accounts) {
      const addr = account.pubkey.toBase58()
      if (addr === params.wallet) continue
      counterparties.add(addr)
      const classification = classifyAddress(addr)
      if (classification.type === 'exchange' && classification.label) {
        exchangeInteractions++
        exchangeHits[classification.label] = (exchangeHits[classification.label] ?? 0) + 1
      }
    }
  }

  let score = 100
  const uniqueExchanges = Object.keys(exchangeHits)
  // Each unique exchange is a major de-anonymization vector (-20 each)
  score -= uniqueExchanges.length * 20
  // Additional repeated interactions compound exposure (-5 each beyond first per exchange)
  score -= Math.max(0, exchangeInteractions - uniqueExchanges.length) * 5
  if (signatures.length >= 10 && counterparties.size < 5) {
    score -= 10
  }
  if (signatures.length > 100) {
    score -= 5
  }
  score = Math.max(0, Math.min(100, score))

  let riskLevel: 'low' | 'medium' | 'high' | 'critical'
  if (score >= 70) riskLevel = 'low'
  else if (score >= 40) riskLevel = 'medium'
  else if (score >= 20) riskLevel = 'high'
  else riskLevel = 'critical'

  const exposurePoints: string[] = []
  for (const [label, count] of Object.entries(exchangeHits)) {
    exposurePoints.push(`${count} interaction(s) with ${label}`)
  }
  if (signatures.length >= 10 && counterparties.size < 5) {
    exposurePoints.push(`Low counterparty diversity: ${counterparties.size} unique peers in ${signatures.length} transactions`)
  }

  const recommendations: string[] = []
  if (uniqueExchanges.length > 0) {
    recommendations.push('Use stealth addresses when withdrawing from exchanges to break the link.')
  }
  if (counterparties.size < 5 && signatures.length >= 10) {
    recommendations.push('Diversify transaction patterns — repeated interactions with few peers enable clustering analysis.')
  }
  if (score < 70) {
    recommendations.push('Consider using Sipher\'s splitSend or scheduleSend tools to break timing correlations.')
  }
  if (recommendations.length === 0) {
    recommendations.push('Good privacy hygiene — continue using stealth addresses and varied timing.')
  }

  const message = score >= 70
    ? `Privacy score: ${score}/100 (${riskLevel}). Your wallet has good on-chain privacy.`
    : `Privacy score: ${score}/100 (${riskLevel}). ${exposurePoints.length} exposure point(s) detected.`

  return {
    action: 'privacyScore',
    status: 'success',
    score,
    riskLevel,
    message,
    exposurePoints,
    recommendations,
    analysis: {
      txCount: signatures.length,
      exchangeInteractions,
      uniqueCounterparties: counterparties.size,
      exchangeLabels: uniqueExchanges,
    },
  }
}
