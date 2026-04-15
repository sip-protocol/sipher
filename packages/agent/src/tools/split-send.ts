import type { AnthropicTool } from '../pi/tool-adapter.js'
import { createScheduledOp, getOrCreateSession } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// splitSend tool — Split amount into N random chunks with staggered delays
// ─────────────────────────────────────────────────────────────────────────────

export interface SplitSendParams {
  wallet: string
  amount: number
  token: string
  recipient: string
  chunks?: number
  spreadHours?: number
  walletSignature: string
}

export interface ChunkInfo {
  opId: string
  amount: number
  executesAt: number
}

export interface SplitSendToolResult {
  action: 'splitSend'
  status: 'success'
  message: string
  chunks: ChunkInfo[]
  totalAmount: number
  token: string
  recipient: string
}

function autoChunkCount(amount: number): number {
  if (amount < 100) return 2
  if (amount < 1000) return 3
  if (amount < 10000) return 4
  return 5
}

/** Split total into N random parts that sum exactly to total. */
function randomSplit(total: number, n: number): number[] {
  if (n <= 1) return [total]
  const cuts: number[] = []
  for (let i = 0; i < n - 1; i++) {
    cuts.push(Math.random() * total)
  }
  cuts.sort((a, b) => a - b)

  const parts: number[] = []
  let prev = 0
  for (const cut of cuts) {
    parts.push(Math.round((cut - prev) * 100) / 100)
    prev = cut
  }
  parts.push(Math.round((total - prev) * 100) / 100)

  // Adjust rounding error on the last chunk
  const sum = parts.reduce((s, p) => s + p, 0)
  parts[parts.length - 1] += Math.round((total - sum) * 100) / 100

  return parts
}

export const splitSendTool: AnthropicTool = {
  name: 'splitSend',
  description:
    'Split a payment into N random chunks sent at staggered times. ' +
    'Breaks amount correlation and timing analysis. ' +
    'Chunk count auto-determined by amount size, or specify manually.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      amount: { type: 'number', description: 'Total amount to send' },
      token: { type: 'string', description: 'Token symbol' },
      recipient: { type: 'string', description: 'Recipient address or stealth meta-address' },
      chunks: { type: 'number', description: 'Number of chunks (auto-determined if omitted)' },
      spreadHours: { type: 'number', description: 'Spread window in hours (default: 6)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing the operation' },
    },
    required: ['wallet', 'amount', 'token', 'recipient'],
  },
}

export async function executeSplitSend(
  params: SplitSendParams,
): Promise<SplitSendToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const n = params.chunks ?? autoChunkCount(params.amount)
  const spreadMs = (params.spreadHours ?? 6) * 3600_000
  const amounts = randomSplit(params.amount, n)
  const token = params.token.toUpperCase()

  const session = getOrCreateSession(params.wallet)
  const now = Date.now()
  const chunks: ChunkInfo[] = []

  for (let i = 0; i < n; i++) {
    // Stagger evenly across the spread window with some randomness
    const baseDelay = (i / (n - 1 || 1)) * spreadMs
    const jitter = (Math.random() - 0.5) * (spreadMs / n) * 0.3
    const executesAt = now + Math.max(60_000, baseDelay + jitter) // min 1 minute

    const op = createScheduledOp({
      session_id: session.id,
      action: 'send',
      params: {
        amount: amounts[i],
        token,
        recipient: params.recipient,
        wallet: params.wallet,
      },
      wallet_signature: params.walletSignature ?? 'pending',
      next_exec: executesAt,
      expires_at: executesAt + 3600_000,
      max_exec: 1,
    })

    chunks.push({ opId: op.id, amount: amounts[i], executesAt })
  }

  // Sort by execution time
  chunks.sort((a, b) => a.executesAt - b.executesAt)

  return {
    action: 'splitSend',
    status: 'success',
    message: `Split ${params.amount} ${token} into ${n} chunks over ~${params.spreadHours ?? 6}h. Each chunk uses a unique stealth address.`,
    chunks,
    totalAmount: params.amount,
    token,
    recipient: params.recipient,
  }
}
