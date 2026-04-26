import type { PreflightContext } from './prompts.js'
import type { RiskReport } from './risk-report.js'
import { getSentinelConfig } from './config.js'
import { runPreflightRules, isFundMovingTool } from './preflight-rules.js'

export type SentinelAssessor = (ctx: PreflightContext) => Promise<RiskReport>

let assessor: SentinelAssessor | null = null

/** Called at startup from src/index.ts with a bound SentinelCore.assessRisk. */
export function setSentinelAssessor(fn: SentinelAssessor | null): void {
  assessor = fn
}

export function getSentinelAssessor(): SentinelAssessor | null {
  return assessor
}

/**
 * Advisory metadata surfaced when SENTINEL flagged an action but did not block.
 * Populated only when the LLM analyst returned `recommendation: 'warn'` — static
 * rules currently only allow or block, so they never produce an advisory.
 */
export interface AdvisoryInfo {
  /** Risk level — low | medium | high (mirrors RiskReport.risk) */
  severity: string
  /** Human-readable summary built from RiskReport.reasons */
  description: string
  /** Original recommendation — 'warn' for advisories */
  recommendation: string
}

export interface PreflightOutcome {
  allowed: true
  /** Present when SENTINEL flagged but allowed the action (advisory mode) */
  advisory?: AdvisoryInfo
}

export interface PreflightBlocked {
  allowed: false
  reasons: string[]
}

export type PreflightCheckResult = PreflightOutcome | PreflightBlocked

/**
 * Runs the preflight gate for a fund-moving tool. Does nothing for non-fund-moving tools.
 * - SENTINEL_MODE=off → allow
 * - β static rule hit → short-circuit
 * - Otherwise → delegate to SentinelCore.assessRisk via the registered assessor
 * - Assessor error + SENTINEL_BLOCK_ON_ERROR=true → block; otherwise allow (fail-open)
 */
export async function runPreflightGate(
  toolName: string,
  input: Record<string, unknown>,
): Promise<PreflightCheckResult> {
  if (!isFundMovingTool(toolName)) return { allowed: true }

  const config = getSentinelConfig()
  if (config.mode === 'off' || config.preflightScope === 'never') return { allowed: true }

  const staticResult = runPreflightRules(toolName, input)
  if (!staticResult.needsLLM) {
    if (staticResult.recommendation === 'block') {
      return { allowed: false, reasons: staticResult.reasons }
    }
    return { allowed: true }
  }

  if (!assessor) {
    // No assessor wired — treat like an error per config
    return config.blockOnError
      ? { allowed: false, reasons: ['SENTINEL assessor not configured'] }
      : { allowed: true }
  }

  try {
    const report = await assessor({
      action: toolName,
      wallet: String(input.wallet ?? ''),
      recipient: typeof input.recipient === 'string' ? input.recipient : undefined,
      amount: typeof input.amount === 'number' ? input.amount : undefined,
      token: typeof input.token === 'string' ? input.token : undefined,
      metadata: (input as { metadata?: Record<string, unknown> }).metadata,
    })
    if (report.recommendation === 'block') {
      return { allowed: false, reasons: report.blockers ?? report.reasons }
    }
    // Surface advisory metadata when the LLM warned but didn't block. The caller
    // decides whether to forward it to the client (e.g. SSE) based on mode.
    if (report.recommendation === 'warn' && report.reasons.length > 0) {
      return {
        allowed: true,
        advisory: {
          severity: report.risk,
          description: report.reasons.join('; '),
          recommendation: report.recommendation,
        },
      }
    }
    return { allowed: true }
  } catch (err) {
    if (config.blockOnError) {
      const msg = err instanceof Error ? err.message : String(err)
      return { allowed: false, reasons: [`SENTINEL error: ${msg}`] }
    }
    return { allowed: true }
  }
}
