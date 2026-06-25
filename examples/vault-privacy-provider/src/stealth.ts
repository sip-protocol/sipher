import { PublicKey } from '@solana/web3.js'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
  commit,
} from '@sip-protocol/sdk'
import { sha256 } from '@noble/hashes/sha2.js'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { randomBytes as cryptoRandomBytes } from 'node:crypto'
import { hexToBytes, bigintToLeBytes } from './hex.js'
import type { StealthMetaAddress, WithdrawArtifacts } from './types.js'

/** Parse a `sip:solana:0x<spending>:0x<viewing>` URI into a StealthMetaAddress. */
export function parseStealthMetaAddress(uri: string): StealthMetaAddress {
  const parts = uri.split(':')
  if (parts.length !== 4 || parts[0] !== 'sip' || parts[1] !== 'solana' || !parts[2] || !parts[3]) {
    throw new Error(`Invalid stealth meta-address: expected sip:solana:<spendingKey>:<viewingKey>, got ${uri}`)
  }
  if (!parts[2].startsWith('0x') || !parts[3].startsWith('0x')) {
    throw new Error('Stealth meta-address keys must be 0x-prefixed hex strings')
  }
  return { spendingKey: parts[2] as `0x${string}`, viewingKey: parts[3] as `0x${string}`, chain: 'solana' }
}

/**
 * Assemble the native-SOL private-withdraw crypto artifacts for a recipient.
 *
 * Mirrors the agent private-send assembly (packages/agent/src/tools/send.ts),
 * minus the token-account derivation: native SOL pays a plain SystemAccount.
 *
 * Honesty: the Pedersen commitment is recorded for disclosure/audit. It does NOT
 * hide the on-chain lamport delta — amounts are visible (TIER_1).
 */
export function assembleWithdrawArtifacts(
  recipient: StealthMetaAddress,
  amountLamports: bigint,
): WithdrawArtifacts {
  // 1. One-time stealth address + ephemeral key from the recipient meta-address.
  const stealth = generateEd25519StealthAddress(recipient)
  const stealthPubkey = new PublicKey(ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address))

  // 2. Real Pedersen commitment: C = amount*G + blinding*H.
  //    commit() returns { commitment: HexString (compressed, 33 bytes), blinding: HexString (32 bytes) }.
  const commitResult = commit(amountLamports)
  const amountCommitment = hexToBytes(commitResult.commitment)
  const blinding = commitResult.blinding

  // 3. Ephemeral pubkey: 32-byte ed25519 padded to 33 bytes with a 0x00 prefix.
  //    The on-chain program stores it opaquely for the scanner; it does not validate the curve.
  const ephRaw = hexToBytes(stealth.stealthAddress.ephemeralPublicKey)
  const ephemeralPubkey = new Uint8Array(33)
  ephemeralPubkey[0] = 0x00
  ephemeralPubkey.set(ephRaw, 1)

  // 4. Viewing-key hash: SHA-256 of the raw viewing key bytes.
  const viewingKeyHash = sha256(hexToBytes(recipient.viewingKey))

  // 5. Encrypt [amount LE(8) || blinding(32)] with XChaCha20-Poly1305 under the
  //    viewing-key hash; prepend the 24-byte nonce so the recipient can decrypt.
  //    Layout: [24 bytes nonce] || [ciphertext + 16 bytes poly1305 tag] = 80 bytes total.
  const amountLeBytes = bigintToLeBytes(amountLamports)
  const blindingBytes = hexToBytes(blinding)
  const plaintext = new Uint8Array(amountLeBytes.length + blindingBytes.length)
  plaintext.set(amountLeBytes, 0)
  plaintext.set(blindingBytes, amountLeBytes.length)
  const nonce = new Uint8Array(cryptoRandomBytes(24))
  const ciphertext = xchacha20poly1305(viewingKeyHash, nonce).encrypt(plaintext)
  const encryptedAmount = new Uint8Array(nonce.length + ciphertext.length)
  encryptedAmount.set(nonce, 0)
  encryptedAmount.set(ciphertext, nonce.length)

  return {
    stealthPubkey,
    amountCommitment,
    ephemeralPubkey,
    viewingKeyHash,
    encryptedAmount,
    proof: new Uint8Array(0),
  }
}
