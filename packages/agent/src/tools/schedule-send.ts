import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'

export interface ScheduleSendParams {
  wallet: string
  amount: number
  token: string
  recipient: string
  delayMinutes?: number
  delayMinutesMin?: number
  delayMinutesMax?: number
  walletSignature: string
}

export interface ScheduleSendToolResult {
  action: 'scheduleSend'
  status: 'success'
  message: string
  scheduled: {
    opId: string
    executesAt: number
    amount: number
    token: string
    recipient: string
  }
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export const scheduleSendTool: Anthropic.Tool = {
  name: 'scheduleSend',
  description:
    'Schedule a private send for later execution. ' +
    'Specify an exact delay or a random range (e.g. "in 4-8 hours"). ' +
    'The crank worker executes it automatically.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      amount: { type: 'number', description: 'Amount to send' },
      token: { type: 'string', description: 'Token symbol (SOL, USDC, etc.)' },
      recipient: { type: 'string', description: 'Recipient address or stealth meta-address' },
      delayMinutes: { type: 'number', description: 'Exact delay in minutes' },
      delayMinutesMin: { type: 'number', description: 'Random delay range min (minutes)' },
      delayMinutesMax: { type: 'number', description: 'Random delay range max (minutes)' },
      walletSignature: {
        type: 'string',
        description: 'Wallet signature authorizing this scheduled operation',
      },
    },
    required: ['wallet', 'amount', 'token', 'recipient'],
  },
}

export async function executeScheduleSend(
  params: ScheduleSendParams,
): Promise<ScheduleSendToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  let delayMs: number
  if (params.delayMinutes !== undefined) {
    delayMs = params.delayMinutes * 60_000
  } else if (params.delayMinutesMin !== undefined && params.delayMinutesMax !== undefined) {
    delayMs = randomInRange(params.delayMinutesMin, params.delayMinutesMax) * 60_000
  } else {
    delayMs = randomInRange(30, 60) * 60_000
  }

  const now = Date.now()
  const executesAt = now + delayMs
  const expiresAt = executesAt + 60 * 60_000

  const session = getOrCreateSession(params.wallet)
  const op = createScheduledOp({
    session_id: session.id,
    action: 'send',
    params: {
      amount: params.amount,
      token: params.token,
      recipient: params.recipient,
      wallet: params.wallet,
    },
    wallet_signature: params.walletSignature ?? 'pending',
    next_exec: executesAt,
    expires_at: expiresAt,
    max_exec: 1,
  })

  const delayMinutes = Math.round(delayMs / 60_000)

  return {
    action: 'scheduleSend',
    status: 'success',
    message: `Send of ${params.amount} ${params.token} scheduled in ~${delayMinutes} minutes. The crank worker will execute it automatically.`,
    scheduled: {
      opId: op.id,
      executesAt,
      amount: params.amount,
      token: params.token,
      recipient: params.recipient,
    },
  }
}
