import type { Tool } from '@mariozechner/pi-ai'
import { getWriteClient } from '../x-client.js'
import { trackXApiCost, canMakeCall } from '../budget.js'

// ─────────────────────────────────────────────────────────────────────────────
// readDMs — Fetch DM events (requires user context OAuth 1.0a)
// ─────────────────────────────────────────────────────────────────────────────

/** Extended DM event fields returned by the API but missing from DMEventV2 typings */
interface DMEventFields {
  id: string
  text?: string
  event_type?: string
  created_at?: string
  sender_id?: string
}

export interface ReadDMsParams {
  max_results?: number
}

export interface ReadDMsResult {
  dms: Array<{
    id: string
    text?: string
    event_type?: string
    created_at?: string
    sender_id?: string
  }>
  cost: number
}

export const readDMsTool: Tool = {
  name: 'readDMs',
  description: 'Read recent Direct Message events for @SipProtocol. Requires user-context OAuth credentials. Returns DM conversations sorted newest first.',
  parameters: {
    type: 'object',
    properties: {
      max_results: {
        type: 'number',
        description: 'Max DM events to fetch (1–100, default 10)',
      },
    },
    required: [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON Schema ↔ TypeBox TSchema bridge
  } as any,
}

export async function executeReadDMs(params: ReadDMsParams = {}): Promise<ReadDMsResult> {
  if (!canMakeCall('dm_read')) {
    return { dms: [], cost: 0 }
  }

  const maxResults = params.max_results ?? 10
  const clampedMax = Math.max(1, Math.min(100, maxResults))

  let dms: ReadDMsResult['dms'] = []

  try {
    const client = getWriteClient()
    const response = await client.v2.listDmEvents({
      max_results: clampedMax,
      'dm_event.fields': ['id', 'text', 'event_type', 'created_at', 'sender_id'],
    })

    const events = (response.data?.data ?? []) as DMEventFields[]

    dms = events.map((event) => ({
      id: event.id,
      text: event.text,
      event_type: event.event_type,
      created_at: event.created_at,
      sender_id: event.sender_id,
    }))
  } catch (err) {
    // DM access may be restricted based on subscription tier —
    // surface as empty result rather than crashing the agent loop
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('403') || message.includes('401') || message.includes('not authorized')) {
      return { dms: [], cost: 0 }
    }
    throw err
  }

  const resourceCount = dms.length || 1
  trackXApiCost('dm_read', resourceCount)

  return {
    dms,
    cost: resourceCount * 0.01,
  }
}
