import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import {
  createConnection,
  getVaultBalance,
  resolveTokenMint,
  getTokenDecimals,
  fromBaseUnits,
} from '@sipher/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Balance tool — Check vault balance for a depositor
// ─────────────────────────────────────────────────────────────────────────────

export interface BalanceParams {
  token: string
  wallet: string
}

export interface BalanceToolResult {
  action: 'balance'
  token: string
  wallet: string
  status: 'success'
  balance: {
    total: string
    available: string
    locked: string
    cumulativeVolume: string
    lastDepositAt: string | null
    exists: boolean
  }
  message: string
}

export const balanceTool: Anthropic.Tool = {
  name: 'balance',
  description:
    'Check the vault balance for a wallet address and token. ' +
    'Returns total balance, available (unlocked) balance, and locked amount. ' +
    'No wallet signature required — this is a read-only operation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, USDT, or SPL mint address',
      },
      wallet: {
        type: 'string',
        description: 'Wallet address (base58) to check balance for',
      },
    },
    required: ['token', 'wallet'],
  },
}

export async function executeBalance(params: BalanceParams): Promise<BalanceToolResult> {
  if (!params.token || params.token.trim().length === 0) {
    throw new Error('Token symbol is required')
  }

  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }

  const token = params.token.toUpperCase()
  const tokenMint = resolveTokenMint(params.token)
  const decimals = getTokenDecimals(tokenMint)

  let depositor: PublicKey
  try {
    depositor = new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  // Read-only — call SDK directly against devnet
  const connection = createConnection('devnet')
  const vaultBalance = await getVaultBalance(connection, depositor, tokenMint)

  const total = fromBaseUnits(vaultBalance.balance, decimals)
  const available = fromBaseUnits(vaultBalance.available, decimals)
  const locked = fromBaseUnits(vaultBalance.lockedAmount, decimals)
  const volume = fromBaseUnits(vaultBalance.cumulativeVolume, decimals)

  const lastDeposit = vaultBalance.lastDepositAt > 0
    ? new Date(vaultBalance.lastDepositAt * 1000).toISOString()
    : null

  const message = vaultBalance.exists
    ? `Vault balance for ${params.wallet}: ${total} ${token} (${available} available, ${locked} locked).`
    : `Vault balance for ${params.wallet}: 0 ${token} (no deposit record found). ` +
      `Deposit first to start using privacy features.`

  return {
    action: 'balance',
    token,
    wallet: params.wallet,
    status: 'success',
    balance: {
      total,
      available,
      locked,
      cumulativeVolume: volume,
      lastDepositAt: lastDeposit,
      exists: vaultBalance.exists,
    },
    message,
  }
}
