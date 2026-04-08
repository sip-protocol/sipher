import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// drip tool — DCA-style distribution over N days with amount jitter + timing jitter
// ─────────────────────────────────────────────────────────────────────────────

export interface DripParams {
  wallet: string
  amount: number
  token: string
  recipient: string
  days?: number
  walletSignature: string
}

export interface DripInfo {
  opId: string
  amount: number
  executesAt: number
}

export interface DripToolResult {
  action: 'drip'
  status: 'success'
  message: string
  drips: DripInfo[]
  totalAmount: number
  token: string
  days: number
}

export const dripTool: Anthropic.Tool = {
  name: 'drip',
  description:
    'DCA-style private distribution — send an amount over N days with randomized amounts and timing jitter. ' +
    'Each drip is a separate stealth send.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      amount: { type: 'number', description: 'Total amount to distribute' },
      token: { type: 'string', description: 'Token symbol' },
      recipient: { type: 'string', description: 'Recipient address or stealth meta-address' },
      days: { type: 'number', description: 'Number of days to distribute over (default: 5)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing the operation' },
    },
    required: ['wallet', 'amount', 'token', 'recipient'],
  },
}

export async function executeDrip(params: DripParams): Promise<DripToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const days = params.days ?? 5
  if (days < 1) throw new Error('Days must be at least 1')

  const token = params.token.toUpperCase()
  const n = days
  const equalSplit = params.amount / n
  const session = getOrCreateSession(params.wallet)
  const now = Date.now()
  const dayMs = 24 * 3600_000
  const jitterMs = 4 * 3600_000 // +-4h jitter

  // Generate randomized amounts (+-10% of equal split)
  const rawAmounts: number[] = []
  for (let i = 0; i < n; i++) {
    const factor = 0.9 + Math.random() * 0.2 // 0.9 to 1.1
    rawAmounts.push(equalSplit * factor)
  }

  // Normalize so they sum to exactly params.amount
  const rawTotal = rawAmounts.reduce((s, a) => s + a, 0)
  const amounts = rawAmounts.map(a => Math.round((a / rawTotal) * params.amount * 100) / 100)

  // Fix rounding error on last element
  const sum = amounts.reduce((s, a) => s + a, 0)
  amounts[amounts.length - 1] += Math.round((params.amount - sum) * 100) / 100

  const drips: DripInfo[] = []
  for (let i = 0; i < n; i++) {
    // Evenly space across `days` with +-4h jitter; min 1 minute from now
    const intervalMs = (days * dayMs) / n
    const scheduleTime = now + intervalMs * i + (Math.random() - 0.5) * jitterMs
    const executesAt = Math.max(now + 60_000, scheduleTime)

    const op = createScheduledOp({
      session_id: session.id,
      action: 'send',
      params: { amount: amounts[i], token, recipient: params.recipient, wallet: params.wallet },
      wallet_signature: params.walletSignature ?? 'pending',
      next_exec: executesAt,
      expires_at: executesAt + dayMs, // expires 1 day after its scheduled time
      max_exec: 1,
    })

    drips.push({ opId: op.id, amount: amounts[i], executesAt })
  }

  drips.sort((a, b) => a.executesAt - b.executesAt)

  return {
    action: 'drip',
    status: 'success',
    message: `Distributing ${params.amount} ${token} over ${days} days in ${n} drips to ${params.recipient}.`,
    drips,
    totalAmount: params.amount,
    token,
    days,
  }
}
