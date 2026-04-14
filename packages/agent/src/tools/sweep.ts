import type { AnthropicTool } from '../pi/tool-adapter.js'
import { createScheduledOp, getOrCreateSession, getScheduledOpsBySession } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// sweep tool — auto-shield incoming wallet funds via persistent scheduled op
// ─────────────────────────────────────────────────────────────────────────────

export interface SweepParams {
  wallet: string
  token?: string
  walletSignature: string
}

export interface SweepToolResult {
  action: 'sweep'
  status: 'success'
  message: string
  sweep: {
    opId: string
    token: string
    expiresAt: number
  }
}

export const sweepTool: AnthropicTool = {
  name: 'sweep',
  description:
    'Auto-shield incoming wallet funds. ' +
    'Monitors your wallet for new token transfers and automatically deposits them into the vault. ' +
    'Phase 1: poll-based (every 60 seconds via crank).',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Wallet to monitor (base58)' },
      token: { type: 'string', description: 'Token to sweep (default: SOL)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing auto-deposits' },
    },
    required: ['wallet'],
  },
}

export async function executeSweep(params: SweepParams): Promise<SweepToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required for sweep')
  }

  const token = (params.token ?? 'SOL').toUpperCase()
  const session = getOrCreateSession(params.wallet)

  // Prevent duplicate: one active sweep per wallet+token
  const existing = getScheduledOpsBySession(session.id)
  const activeSweep = existing.find(
    op => op.action === 'sweep' && op.status === 'pending' &&
          (op.params.token as string) === token,
  )
  if (activeSweep) {
    throw new Error(`Sweep already active for ${token} on this wallet`)
  }

  const now = Date.now()
  const thirtyDays = 30 * 24 * 3600_000
  const expiresAt = now + thirtyDays

  const op = createScheduledOp({
    session_id: session.id,
    action: 'sweep',
    params: {
      wallet: params.wallet,
      token,
      intervalMs: 60_000, // crank re-schedules every 60s
    },
    wallet_signature: params.walletSignature ?? 'pending',
    next_exec: now + 60_000, // first poll in 1 minute
    expires_at: expiresAt,
    max_exec: 999_999, // effectively unlimited — persistent monitor
  })

  return {
    action: 'sweep',
    status: 'success',
    message: `Auto-sweep enabled for ${token}. Incoming transfers will be auto-deposited into the vault.`,
    sweep: { opId: op.id, token, expiresAt },
  }
}
