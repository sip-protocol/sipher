import { getDb, getActiveBlacklistEntry } from '../db.js'
import { getSentinelConfig } from './config.js'

const FUND_MOVING_TOOLS = new Set([
  'send', 'deposit', 'swap', 'sweep', 'consolidate',
  'splitSend', 'scheduleSend', 'drip', 'recurring', 'refund',
])

export type PreflightRule =
  | 'not-fund-moving'
  | 'self-transfer'
  | 'blacklist-hit'
  | 'known-repeat'
  | 'dust'

export interface PreflightResult {
  needsLLM: boolean
  recommendation: 'allow' | 'warn' | 'block'
  reasons: string[]
  staticRuleHit?: PreflightRule
}

export function isFundMovingTool(name: string): boolean {
  return FUND_MOVING_TOOLS.has(name)
}

/**
 * β static rules — CPU-only pre-checks before engaging the LLM.
 * First match short-circuits. See spec Section 5.2.
 */
export function runPreflightRules(
  toolName: string,
  input: Record<string, unknown>,
): PreflightResult {
  // Rule 1 — not fund-moving → allow, skip LLM
  if (!isFundMovingTool(toolName)) {
    return {
      needsLLM: false,
      recommendation: 'allow',
      reasons: ['tool is not fund-moving'],
      staticRuleHit: 'not-fund-moving',
    }
  }

  const wallet = input.wallet as string | undefined
  const recipient = input.recipient as string | undefined
  const amount = Number(input.amount ?? 0)

  // Rule 2 — self-transfer → allow
  if (wallet && recipient && wallet === recipient) {
    return {
      needsLLM: false,
      recommendation: 'allow',
      reasons: ['self-transfer (sender === recipient)'],
      staticRuleHit: 'self-transfer',
    }
  }

  // Rule 3 — blacklist hit → block (evaluate BEFORE known-repeat)
  if (recipient) {
    const entry = getActiveBlacklistEntry(recipient)
    if (entry) {
      return {
        needsLLM: false,
        recommendation: 'block',
        reasons: [`recipient is on SENTINEL blacklist (${entry.severity}): ${entry.reason}`],
        staticRuleHit: 'blacklist-hit',
      }
    }
  }

  const config = getSentinelConfig()

  // Rule 4 — known repeat recipient below skip amount → allow
  if (wallet && recipient && amount > 0 && amount < config.preflightSkipAmount) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const row = getDb().prepare(`
      SELECT id FROM activity_stream
      WHERE agent = 'sipher'
        AND type = 'action'
        AND wallet = ?
        AND json_extract(detail, '$.recipient') = ?
        AND created_at > ?
      LIMIT 1
    `).get(wallet, recipient, thirtyDaysAgo) as { id?: string } | undefined
    if (row) {
      return {
        needsLLM: false,
        recommendation: 'allow',
        reasons: ['known repeat recipient under skip amount'],
        staticRuleHit: 'known-repeat',
      }
    }
  }

  // Rule 5 — dust fallback (any recipient)
  const dustCutoff = config.preflightSkipAmount / 10
  if (amount > 0 && amount < dustCutoff) {
    return {
      needsLLM: false,
      recommendation: 'allow',
      reasons: [`amount below dust threshold (${dustCutoff} SOL)`],
      staticRuleHit: 'dust',
    }
  }

  // Rule 6 — fallback, engage LLM
  return {
    needsLLM: true,
    recommendation: 'allow',
    reasons: [],
  }
}
