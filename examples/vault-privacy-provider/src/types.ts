import type { PublicKey, Transaction, Keypair } from '@solana/web3.js'

/** A recipient's stealth meta-address: spending + viewing public keys (0x-hex). */
export interface StealthMetaAddress {
  spendingKey: `0x${string}`
  viewingKey: `0x${string}`
  chain: 'solana'
}

/** On-chain crypto artifacts a native-SOL private withdrawal requires. */
export interface WithdrawArtifacts {
  /** One-time stealth recipient (a plain SystemAccount). */
  stealthPubkey: PublicKey
  /** Pedersen commitment C = amount*G + blinding*H (33 bytes). */
  amountCommitment: Uint8Array
  /** Ephemeral pubkey for ECDH, 33 bytes (ed25519 padded with a 0x00 prefix). */
  ephemeralPubkey: Uint8Array
  /** SHA-256 of the viewing key (32 bytes). */
  viewingKeyHash: Uint8Array
  /** AEAD blob: [24-byte nonce] || [ciphertext+tag] over [amount LE(8) || blinding(32)]. */
  encryptedAmount: Uint8Array
  /** ZK proof (empty — verified off-chain). */
  proof: Uint8Array
}

export interface DepositResult { txSignature: string; depositedLamports: bigint }
export interface PrivateWithdrawResult {
  txSignature: string
  withdrawnLamports: bigint
  feeLamports: bigint
  stealthAddress: string
}
export interface RefundResult { txSignature: string; refundedLamports: bigint }

/**
 * A pluggable privacy backend. The same shared depositor keypair MUST be passed to
 * every fund-moving call — a per-user depositor would link each user's deposit and
 * withdrawal on-chain and destroy the commingling anonymity property.
 */
export interface VaultPrivacyProvider {
  /** Advertised withdraw fee (tenths of a bps). The actual deducted fee comes from on-chain config. */
  readonly feeTenthsBps: number
  buildFundingTx(args: {
    fromPk: string; depositorPk: string; amountLamports: bigint; recentBlockhash: string
  }): Promise<Transaction>
  verifyFunding(args: { depositorPk: string; expectedLamports: bigint; txSignature: string }): Promise<void>
  deposit(args: { depositorKp: Keypair; lamports: bigint }): Promise<DepositResult>
  privateWithdraw(args: {
    depositorKp: Keypair; recipient: StealthMetaAddress; lamports: bigint
  }): Promise<PrivateWithdrawResult>
  refund(args: { depositorKp: Keypair }): Promise<RefundResult>
  previewWithdraw(grossLamports: bigint): { feeLamports: bigint; netLamports: bigint }
}
