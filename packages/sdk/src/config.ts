import { PublicKey } from '@solana/web3.js'
import type { SipherConfig } from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Program IDs (deployed on-chain)
// ─────────────────────────────────────────────────────────────────────────────

/** Sipher Vault program — deposit-first agentic privacy mixer */
export const SIPHER_VAULT_PROGRAM_ID = new PublicKey(
  'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB'
)

/** SIP Privacy program — stealth addresses, commitments, announcements */
export const SIP_PRIVACY_PROGRAM_ID = new PublicKey(
  'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'
)

// ─────────────────────────────────────────────────────────────────────────────
// PDA seeds (must match on-chain constants.rs exactly)
// ─────────────────────────────────────────────────────────────────────────────

export const VAULT_CONFIG_SEED = Buffer.from('vault_config')
export const DEPOSIT_RECORD_SEED = Buffer.from('deposit_record')
export const VAULT_TOKEN_SEED = Buffer.from('vault_token')
export const FEE_TOKEN_SEED = Buffer.from('fee_token')

// ─────────────────────────────────────────────────────────────────────────────
// Default program constants (mirrors on-chain defaults)
// ─────────────────────────────────────────────────────────────────────────────

/** 24 hours in seconds */
export const DEFAULT_REFUND_TIMEOUT = 86400
/** 0.10% fee */
export const DEFAULT_FEE_BPS = 10
/** Max 1% fee */
export const MAX_FEE_BPS = 100

// ─────────────────────────────────────────────────────────────────────────────
// Account data offsets (after 8-byte Anchor discriminator)
//
// VaultConfig:  authority(32) + fee_bps(2) + refund_timeout(8) + paused(1)
//             + total_deposits(8) + total_depositors(8) + bump(1) = 60
//
// DepositRecord: depositor(32) + token_mint(32) + balance(8) + locked_amount(8)
//              + cumulative_volume(8) + last_deposit_at(8) + bump(1) = 97
// ─────────────────────────────────────────────────────────────────────────────

export const ANCHOR_DISCRIMINATOR_SIZE = 8
export const VAULT_CONFIG_SIZE = ANCHOR_DISCRIMINATOR_SIZE + 60
export const DEPOSIT_RECORD_SIZE = ANCHOR_DISCRIMINATOR_SIZE + 97

// ─────────────────────────────────────────────────────────────────────────────
// Cluster configs
// ─────────────────────────────────────────────────────────────────────────────

export const DEVNET_CONFIG: SipherConfig = {
  cluster: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  sipherVaultProgramId: SIPHER_VAULT_PROGRAM_ID,
  sipPrivacyProgramId: SIP_PRIVACY_PROGRAM_ID,
}

export const MAINNET_CONFIG: SipherConfig = {
  cluster: 'mainnet-beta',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  sipherVaultProgramId: SIPHER_VAULT_PROGRAM_ID,
  sipPrivacyProgramId: SIP_PRIVACY_PROGRAM_ID,
}

/**
 * Get config for a given cluster. Accepts custom RPC URL override.
 */
export function getConfig(
  cluster: 'devnet' | 'mainnet-beta',
  rpcUrl?: string
): SipherConfig {
  const base = cluster === 'devnet' ? DEVNET_CONFIG : MAINNET_CONFIG
  return rpcUrl ? { ...base, rpcUrl } : base
}
