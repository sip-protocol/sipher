import type Anthropic from '@anthropic-ai/sdk'
import {
  createConnection,
  getVaultConfig,
  SIPHER_VAULT_PROGRAM_ID,
  DEFAULT_FEE_BPS,
  DEFAULT_REFUND_TIMEOUT,
} from '@sipher/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Status tool — Read-only vault status from on-chain VaultConfig PDA
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusToolResult {
  action: 'status'
  status: 'success'
  message: string
  vault: {
    programId: string
    paused: boolean
    feeBps: number
    feePercent: string
    refundTimeout: number
    refundTimeoutHuman: string
    totalDeposits: number
    totalDepositors: number
    authority: string | null
    configFound: boolean
  }
}

export const statusTool: Anthropic.Tool = {
  name: 'status',
  description:
    'Check the Sipher vault status — paused state, fee, refund timeout, deposit stats. ' +
    'Reads on-chain VaultConfig PDA. No wallet signature required.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

export async function executeStatus(): Promise<StatusToolResult> {
  const network = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)
  const config = await getVaultConfig(connection)

  if (!config) {
    // VaultConfig PDA not found — vault not initialized or wrong cluster
    return {
      action: 'status',
      status: 'success',
      message:
        'Vault config not found on-chain. The vault may not be initialized on this cluster, ' +
        'or the RPC endpoint is unreachable. Using default parameters.',
      vault: {
        programId: SIPHER_VAULT_PROGRAM_ID.toBase58(),
        paused: false,
        feeBps: DEFAULT_FEE_BPS,
        feePercent: `${DEFAULT_FEE_BPS / 100}%`,
        refundTimeout: DEFAULT_REFUND_TIMEOUT,
        refundTimeoutHuman: `${DEFAULT_REFUND_TIMEOUT / 3600} hours`,
        totalDeposits: 0,
        totalDepositors: 0,
        authority: null,
        configFound: false,
      },
    }
  }

  const feePercent = `${config.feeBps / 100}%`
  const timeoutHours = config.refundTimeout / 3600
  const refundTimeoutHuman = timeoutHours >= 1
    ? `${timeoutHours} hours`
    : `${config.refundTimeout / 60} minutes`

  return {
    action: 'status',
    status: 'success',
    message: config.paused
      ? 'Vault is PAUSED. Deposits and withdrawals are temporarily disabled. Funds are safe.'
      : `Vault is active. Fee: ${feePercent}. Refund timeout: ${refundTimeoutHuman}. ` +
        `${config.totalDepositors} depositor(s), ${config.totalDeposits} total deposit(s).`,
    vault: {
      programId: SIPHER_VAULT_PROGRAM_ID.toBase58(),
      paused: config.paused,
      feeBps: config.feeBps,
      feePercent,
      refundTimeout: config.refundTimeout,
      refundTimeoutHuman,
      totalDeposits: config.totalDeposits,
      totalDepositors: config.totalDepositors,
      authority: config.authority.toBase58(),
      configFound: true,
    },
  }
}
