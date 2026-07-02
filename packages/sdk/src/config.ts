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

// Native-SOL sentinel mint. The vault seeds the native-SOL DepositRecord with the
// all-zeros pubkey (on-chain: Pubkey::new_from_array([0u8; 32])). This is NOT wrapped
// SOL — WSOL_MINT (So111…112) is a real SPL mint used by the token path; the native
// path never wraps. Keep the two distinct.
export const NATIVE_SOL_MINT = new PublicKey(new Uint8Array(32))

// Native-SOL vault PDA seeds (must match on-chain constants.rs exactly)
export const VAULT_SOL_SEED = Buffer.from('vault_sol')
export const FEE_SOL_SEED = Buffer.from('fee_sol')

// SIP Privacy program PDA seeds (must match sip_privacy constants)
export const SIP_CONFIG_SEED = Buffer.from('config')
export const SIP_TRANSFER_RECORD_SEED = Buffer.from('transfer_record')

// ─────────────────────────────────────────────────────────────────────────────
// Default program constants (mirrors on-chain defaults)
// ─────────────────────────────────────────────────────────────────────────────

/** 24 hours in seconds */
export const DEFAULT_REFUND_TIMEOUT = 86400
/** 0.10% fee (100 tenths-of-a-bps) */
export const DEFAULT_FEE_TENTHS_BPS = 100
/** Max 1% fee (1000 tenths-of-a-bps) */
export const MAX_FEE_TENTHS_BPS = 1000

// ─────────────────────────────────────────────────────────────────────────────
// Account data offsets (after 8-byte Anchor discriminator)
//
// VaultConfig:  authority(32) + fee_tenths_bps(2) + refund_timeout(8) + paused(1)
//             + total_deposits(8) + total_depositors(8) + bump(1)
//             + pending_authority(1+32) = 93
//
// DepositRecord: depositor(32) + token_mint(32) + balance(8)
//              + cumulative_volume(8) + last_deposit_at(8) + bump(1) = 89
// ─────────────────────────────────────────────────────────────────────────────

export const ANCHOR_DISCRIMINATOR_SIZE = 8
export const VAULT_CONFIG_SIZE = ANCHOR_DISCRIMINATOR_SIZE + 93
export const DEPOSIT_RECORD_SIZE = ANCHOR_DISCRIMINATOR_SIZE + 89

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
