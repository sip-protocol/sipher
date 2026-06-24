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
  /** Withdrawable balance — equals `balance` (the on-chain vault has no lock field) */
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

export interface SolDepositResult {
  /** Unsigned transaction — caller signs with their wallet */
  transaction: Transaction
  /** The deposit record PDA (seeded by NATIVE_SOL_MINT) */
  depositRecordAddress: PublicKey
  /** The SolVault PDA that receives the lamports */
  solVaultAddress: PublicKey
  /** Amount in lamports */
  amount: bigint
}

export interface SolRefundResult {
  transaction: Transaction
  /** Amount being refunded (the depositor's available balance, in lamports) */
  refundAmount: bigint
  /** The depositor's main (system) account receiving the lamports */
  depositorAddress: PublicKey
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
