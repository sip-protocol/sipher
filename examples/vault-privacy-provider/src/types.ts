import type { PublicKey } from '@solana/web3.js'

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
