import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { getDb } from '../../db.js'

export interface GetPendingClaimsParams { wallet?: string }
export interface PendingClaim {
  ephemeralPubkey: string
  amount: number
  detectedAt: string
}
export interface GetPendingClaimsResult {
  claims: PendingClaim[]
}

export const getPendingClaimsTool: AnthropicTool = {
  name: 'getPendingClaims',
  description: 'List stealth transfers detected by SentinelWorker that have not yet been claimed.',
  input_schema: {
    type: 'object' as const,
    properties: { wallet: { type: 'string', description: 'Optional filter by wallet' } },
  },
}

export async function executeGetPendingClaims(
  params: GetPendingClaimsParams,
): Promise<GetPendingClaimsResult> {
  let sql = `SELECT detail, created_at FROM activity_stream WHERE agent = 'sentinel' AND type = 'unclaimed'`
  const bind: unknown[] = []
  if (params.wallet) {
    sql += ` AND wallet = ?`
    bind.push(params.wallet)
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`
  const rows = getDb().prepare(sql).all(...bind) as { detail: string; created_at: string }[]
  const claims: PendingClaim[] = rows.map((r) => {
    const d = JSON.parse(r.detail) as { ephemeralPubkey?: string; amount?: number }
    return {
      ephemeralPubkey: d.ephemeralPubkey ?? 'unknown',
      amount: d.amount ?? 0,
      detectedAt: r.created_at,
    }
  })
  return { claims }
}
