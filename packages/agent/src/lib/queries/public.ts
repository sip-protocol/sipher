/**
 * Shared types for public, unauthenticated /api/public/* responses.
 * Feature subagents extend this file with their feature-specific helpers.
 */

export interface DemoVault {
  wallet: string
  balances: { sol: number; tokens: unknown[]; status: string }
}

export interface DemoActivityRow {
  id: string
  agent: string
  type: string
  level: string
  title: string
  detail?: string | null
  created_at: string
}

export interface DemoPrivacyScore {
  score: number
  grade: string
  factors: {
    addressReuse: { score: number; detail: string }
    amountPatterns: { score: number; detail: string }
    timingCorrelation: { score: number; detail: string }
    counterpartyExposure: { score: number; detail: string }
  }
  recommendations: string[]
  transactionsAnalyzed: number
}

export type AmountBand = '<1' | '1-10' | '10-100' | '100-1000' | '>1000'

export interface AnonActivityRow {
  type: string
  chain: string
  amountBand: AmountBand
  relativeTime: string
}

export interface ActivitySummaryResponse {
  counter: number
  recent: AnonActivityRow[]
}
