import type { Tool } from '@mariozechner/pi-ai'
import { getWriteClient } from '../x-client.js'
import { trackXApiCost, canMakeCall } from '../budget.js'
import { guardianBus } from '../../coordination/event-bus.js'

// ─────────────────────────────────────────────────────────────────────────────
// sendDM — AUTO. Sends a Direct Message from @SipProtocol to a user.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendDMParams {
  user_id: string
  text: string
}

export interface SendDMResult {
  sent: boolean
  dm_id: string
}

export const sendDMTool: Tool = {
  name: 'sendDM',
  description: 'Send a Direct Message from @SipProtocol to a specific user by their X user ID. Posts immediately — use to follow up on support requests, partnership inquiries, or flagged community members.',
  parameters: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'X user ID of the recipient (numeric string, not @username)',
      },
      text: {
        type: 'string',
        description: 'DM text content',
      },
    },
    required: ['user_id', 'text'],
  } as Tool['parameters'],
}

export async function executeSendDM(params: SendDMParams): Promise<SendDMResult> {
  if (!canMakeCall('dm_create')) {
    throw new Error('budget gate: dm_create blocked')
  }

  if (!params.user_id || params.user_id.trim().length === 0) {
    throw new Error('user_id is required')
  }
  if (!params.text || params.text.trim().length === 0) {
    throw new Error('text is required')
  }

  const client = getWriteClient()
  const response = await client.v2.sendDmToParticipant(params.user_id, { text: params.text })
  const dmId = response.dm_event_id

  trackXApiCost('dm_create', 1)

  const now = new Date().toISOString()
  guardianBus.emit({
    source: 'herald',
    type: 'herald:dm',
    level: 'routine',
    data: { user_id: params.user_id, dm_id: dmId },
    timestamp: now,
  })

  return { sent: true, dm_id: dmId }
}
