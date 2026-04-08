import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// recurring tool — repeating private payments on interval with amount jitter
// ─────────────────────────────────────────────────────────────────────────────

export interface RecurringParams {
  wallet: string
  amount: number
  token: string
  recipient: string
  intervalDays: number
  maxExecutions: number
  walletSignature: string
}

export interface RecurringToolResult {
  action: 'recurring'
  status: 'success'
  message: string
  scheduled: {
    opId: string
    firstExecution: number
    intervalDays: number
    maxExecutions: number
    expiresAt: number
  }
}

export const recurringTool: Anthropic.Tool = {
  name: 'recurring',
  description:
    'Set up recurring private payments on an interval. ' +
    'Amount randomized +-5% each execution. Timing jittered +-24h. ' +
    'Max execution count is REQUIRED (no infinite recurring).',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      amount: { type: 'number', description: 'Base amount per payment' },
      token: { type: 'string', description: 'Token symbol' },
      recipient: { type: 'string', description: 'Recipient address' },
      intervalDays: { type: 'number', description: 'Days between payments' },
      maxExecutions: { type: 'number', description: 'Maximum number of payments (required, no infinite)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing the operation' },
    },
    required: ['wallet', 'amount', 'token', 'recipient', 'intervalDays', 'maxExecutions'],
  },
}

export async function executeRecurring(params: RecurringParams): Promise<RecurringToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }
  if (!params.intervalDays || params.intervalDays <= 0) {
    throw new Error('Interval must be at least 1 day')
  }
  if (!params.maxExecutions || params.maxExecutions <= 0) {
    throw new Error('maxExecutions is required and must be positive')
  }

  const token = params.token.toUpperCase()
  const intervalMs = params.intervalDays * 24 * 3600_000
  const jitterMs = 24 * 3600_000 // +-24h jitter
  const now = Date.now()

  // First execution: interval from now with jitter
  const firstExec = now + intervalMs + (Math.random() - 0.5) * jitterMs

  // Expires: enough time for all executions + 1 extra interval buffer
  const expiresAt = now + (params.maxExecutions + 1) * intervalMs

  const session = getOrCreateSession(params.wallet)
  const op = createScheduledOp({
    session_id: session.id,
    action: 'send',
    params: {
      amount: params.amount,
      token,
      recipient: params.recipient,
      wallet: params.wallet,
      intervalMs,
      amountJitterPct: 0.05,
    },
    wallet_signature: params.walletSignature ?? 'pending',
    next_exec: firstExec,
    expires_at: expiresAt,
    max_exec: params.maxExecutions,
  })

  return {
    action: 'recurring',
    status: 'success',
    message: `Recurring payment: ~${params.amount} ${token} every ${params.intervalDays} days to ${params.recipient}. Max ${params.maxExecutions} payments.`,
    scheduled: {
      opId: op.id,
      firstExecution: firstExec,
      intervalDays: params.intervalDays,
      maxExecutions: params.maxExecutions,
      expiresAt,
    },
  }
}
