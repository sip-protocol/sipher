import type { PublicKey, Transaction } from '@solana/web3.js'

// ─────────────────────────────────────────────────────────────────────────────
// On-chain account state (mirrors sipher_vault program)
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultConfig {
  authority: PublicKey
  feeBps: number
  refundTimeout: number
  paused: boolean
  totalDeposits: number
  totalDepositors: number
  bump: number
}

export interface DepositRecord {
  depositor: PublicKey
  tokenMint: PublicKey
  balance: bigint
  lockedAmount: bigint
  cumulativeVolume: bigint
  lastDepositAt: number
  bump: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Vault balance (derived from DepositRecord)
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultBalance {
  depositor: PublicKey
  tokenMint: PublicKey
  /** Total balance in the vault (lamports / token base units) */
  balance: bigint
  /** Amount locked by pending private sends */
  lockedAmount: bigint
  /** balance - lockedAmount */
  available: bigint
  /** Lifetime deposit volume */
  cumulativeVolume: bigint
  /** Unix timestamp of last deposit */
  lastDepositAt: number
  /** Whether a DepositRecord PDA exists on-chain */
  exists: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation results
// ─────────────────────────────────────────────────────────────────────────────

export interface DepositResult {
  /** Unsigned transaction — caller signs with their wallet */
  transaction: Transaction
  /** The deposit record PDA */
  depositRecordAddress: PublicKey
  /** The vault token PDA that receives the tokens */
  vaultTokenAddress: PublicKey
  /** Amount in base units */
  amount: bigint
}

export interface WithdrawResult {
  transaction: Transaction
  /** Net amount after fees */
  netAmount: bigint
  /** Fee deducted */
  feeAmount: bigint
  /** The stealth address receiving the tokens */
  stealthAddress: PublicKey
}

export interface RefundResult {
  transaction: Transaction
  /** Amount being refunded (available balance) */
  refundAmount: bigint
  /** The depositor's token account receiving the refund */
  depositorTokenAddress: PublicKey
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy / scanning
// ─────────────────────────────────────────────────────────────────────────────

export interface StealthPayment {
  /** The stealth recipient pubkey */
  stealthAddress: PublicKey
  /** Pedersen commitment hiding the amount: C = amount*G + blinding*H */
  amountCommitment: Uint8Array
  /** Ephemeral pubkey for ECDH shared secret derivation */
  ephemeralPubkey: Uint8Array
  /** SHA-256 of the viewing key (for recipient matching) */
  viewingKeyHash: Uint8Array
  /** Transfer amount (available to recipient after claiming) */
  transferAmount: bigint
  /** Fee deducted from gross amount */
  feeAmount: bigint
  /** Unix timestamp */
  timestamp: number
  /** On-chain transaction signature */
  txSignature: string
}

export interface ScanResult {
  /** Payments addressed to the scanning wallet */
  payments: StealthPayment[]
  /** Number of VaultWithdrawEvent logs scanned */
  eventsScanned: number
  /** Whether there are more events to scan (pagination) */
  hasMore: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export type Cluster = 'devnet' | 'mainnet-beta'

export interface SipherConfig {
  cluster: Cluster
  rpcUrl: string
  sipherVaultProgramId: PublicKey
  sipPrivacyProgramId: PublicKey
}
