import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { getDb } from '../../db.js'

// Reference: docs/sentinel/tools.md

export interface GetRecentActivityParams { address: string; limit?: number; since?: string }

export interface ActivityEventRow {
  id: string
  agent: string
  level: string
  type: string
  title: string
  detail: Record<string, unknown>
  createdAt: string
}

export interface GetRecentActivityResult {
  events: ActivityEventRow[]
  count: number
}

/**
 * Fetch recent activity_stream events for a given wallet or address.
 * @type read | @usedBy SentinelCore
 * @whenFired When SENTINEL gauges baseline behavior and activity volume for an account before making a risk call.
 * @see docs/sentinel/tools.md#getrecentactivity
 */
export const getRecentActivityTool: AnthropicTool = {
  name: 'getRecentActivity',
  description: 'Fetch recent activity_stream events for a given wallet/address. Use to gauge account baseline behavior.',
  input_schema: {
    type: 'object' as const,
    properties: {
      address: { type: 'string', description: 'Wallet or address' },
      limit: { type: 'number', description: 'Max rows (default 20)' },
      since: { type: 'string', description: 'ISO timestamp — only events after this time' },
    },
    required: ['address'],
  },
}

export async function executeGetRecentActivity(
  params: GetRecentActivityParams,
): Promise<GetRecentActivityResult> {
  const limit = params.limit ?? 20
  let sql = `SELECT id, agent, level, type, title, detail, created_at FROM activity_stream WHERE wallet = ?`
  const bind: unknown[] = [params.address]
  if (params.since) {
    sql += ` AND created_at > ?`
    bind.push(params.since)
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`
  bind.push(limit)
  const rows = getDb().prepare(sql).all(...bind) as Record<string, unknown>[]
  const events: ActivityEventRow[] = rows.map((r) => ({
    id: r.id as string,
    agent: r.agent as string,
    level: r.level as string,
    type: r.type as string,
    title: r.title as string,
    detail: r.detail ? (JSON.parse(r.detail as string) as Record<string, unknown>) : {},
    createdAt: r.created_at as string,
  }))
  return { events, count: events.length }
}
