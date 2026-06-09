import { describe, it, expect } from 'vitest'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  checkEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
  commit,
} from '@sip-protocol/sdk'
import { sha256 } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'
import { ed25519 } from '@noble/curves/ed25519'
import type { Connection } from '@solana/web3.js'
import { scanForPayments } from '../src/privacy.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, '')
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n

/** Derive ed25519 scalar from raw private key (matches @sip-protocol/sdk internals) */
function deriveEd25519Scalar(privateKey: Uint8Array): bigint {
  const hash = sha512(privateKey)
  const scalar = hash.slice(0, 32)
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64
  let value = 0n
  for (let i = 0; i < 32; i++) {
    value |= BigInt(scalar[i]) << BigInt(i * 8)
  }
  return value % ED25519_ORDER
}

// ─────────────────────────────────────────────────────────────────────────────
// Stealth address generation
// ─────────────────────────────────────────────────────────────────────────────

describe('Stealth address generation', () => {
  it('generates a valid meta-address with correct key lengths', () => {
    const meta = generateEd25519StealthMetaAddress('solana')

    // Public keys: 0x + 64 hex chars = 32 bytes
    expect(meta.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(meta.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]{64}$/)

    // Private keys: 0x + 64 hex chars = 32 bytes
    expect(meta.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(meta.viewingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('generates different meta-addresses each time', () => {
    const meta1 = generateEd25519StealthMetaAddress('solana')
    const meta2 = generateEd25519StealthMetaAddress('solana')

    expect(meta1.metaAddress.spendingKey).not.toBe(meta2.metaAddress.spendingKey)
    expect(meta1.metaAddress.viewingKey).not.toBe(meta2.metaAddress.viewingKey)
  })

  it('generates a stealth address with correct byte lengths', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)

    // Stealth address: 32-byte ed25519 pubkey
    const addrBytes = hexToBytes(stealth.stealthAddress.address)
    expect(addrBytes.length).toBe(32)

    // Ephemeral pubkey: 32-byte ed25519 pubkey
    const ephBytes = hexToBytes(stealth.stealthAddress.ephemeralPublicKey)
    expect(ephBytes.length).toBe(32)

    // View tag: 0-255
    expect(stealth.stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
    expect(stealth.stealthAddress.viewTag).toBeLessThanOrEqual(255)
  })

  it('derives a valid Solana address from stealth pubkey', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)

    const solanaAddr = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address)
    // Base58 Solana address: 32-44 characters
    expect(solanaAddr.length).toBeGreaterThanOrEqual(32)
    expect(solanaAddr.length).toBeLessThanOrEqual(44)
  })

  it('generates different stealth addresses for same meta-address', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth1 = generateEd25519StealthAddress(meta.metaAddress)
    const stealth2 = generateEd25519StealthAddress(meta.metaAddress)

    // Each call produces a unique ephemeral key and stealth address
    expect(stealth1.stealthAddress.address).not.toBe(stealth2.stealthAddress.address)
    expect(stealth1.stealthAddress.ephemeralPublicKey).not.toBe(
      stealth2.stealthAddress.ephemeralPublicKey
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Stealth address matching (round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe('Stealth address matching', () => {
  it('round-trip: generate stealth -> check returns true for correct keypair', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)

    const isOurs = checkEd25519StealthAddress(
      stealth.stealthAddress,
      meta.viewingPrivateKey,
      meta.metaAddress.spendingKey
    )
    expect(isOurs).toBe(true)
  })

  it('returns false for wrong spending key', () => {
    const alice = generateEd25519StealthMetaAddress('solana')
    const bob = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(alice.metaAddress)

    const isMatch = checkEd25519StealthAddress(
      stealth.stealthAddress,
      alice.viewingPrivateKey,
      bob.metaAddress.spendingKey
    )
    expect(isMatch).toBe(false)
  })

  it('returns false for wrong viewing key', () => {
    const alice = generateEd25519StealthMetaAddress('solana')
    const bob = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(alice.metaAddress)

    const isMatch = checkEd25519StealthAddress(
      stealth.stealthAddress,
      bob.viewingPrivateKey,
      alice.metaAddress.spendingKey
    )
    expect(isMatch).toBe(false)
  })

  it('returns false for completely wrong keypair', () => {
    const alice = generateEd25519StealthMetaAddress('solana')
    const bob = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(alice.metaAddress)

    const isMatch = checkEd25519StealthAddress(
      stealth.stealthAddress,
      bob.viewingPrivateKey,
      bob.metaAddress.spendingKey
    )
    expect(isMatch).toBe(false)
  })

  it('correctly matches across multiple stealth addresses', () => {
    const meta = generateEd25519StealthMetaAddress('solana')

    // Generate 5 stealth addresses for the same recipient
    const stealths = Array.from({ length: 5 }, () =>
      generateEd25519StealthAddress(meta.metaAddress)
    )

    // All should match
    for (const s of stealths) {
      expect(
        checkEd25519StealthAddress(
          s.stealthAddress,
          meta.viewingPrivateKey,
          meta.metaAddress.spendingKey
        )
      ).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Pedersen commitments
// ─────────────────────────────────────────────────────────────────────────────

describe('Pedersen commitments', () => {
  it('produces a 33-byte commitment (compressed secp256k1 point)', () => {
    const { commitment } = commit(BigInt(1_000_000_000))
    const bytes = hexToBytes(commitment)
    expect(bytes.length).toBe(33)
  })

  it('produces a 32-byte blinding factor', () => {
    const { blinding } = commit(BigInt(1_000_000_000))
    const bytes = hexToBytes(blinding)
    expect(bytes.length).toBe(32)
  })

  it('different amounts produce different commitments', () => {
    const c1 = commit(BigInt(1_000_000))
    const c2 = commit(BigInt(2_000_000))
    expect(c1.commitment).not.toBe(c2.commitment)
  })

  it('same amount with different blinding produces different commitments', () => {
    const amount = BigInt(500_000)
    const c1 = commit(amount)
    const c2 = commit(amount)
    // Random blinding each time -> different commitments
    expect(c1.commitment).not.toBe(c2.commitment)
    expect(c1.blinding).not.toBe(c2.blinding)
  })

  it('commitment for zero amount is valid', () => {
    const { commitment, blinding } = commit(BigInt(0))
    expect(hexToBytes(commitment).length).toBe(33)
    expect(hexToBytes(blinding).length).toBe(32)
  })

  it('commitment for large amount is valid', () => {
    const { commitment, blinding } = commit(BigInt('18446744073709551615')) // u64 max
    expect(hexToBytes(commitment).length).toBe(33)
    expect(hexToBytes(blinding).length).toBe(32)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ephemeral pubkey padding (32 -> 33 bytes for on-chain format)
// ─────────────────────────────────────────────────────────────────────────────

describe('Ephemeral pubkey padding', () => {
  it('pads 32-byte ed25519 pubkey to 33 bytes with 0x00 prefix', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)

    const ephRaw = hexToBytes(stealth.stealthAddress.ephemeralPublicKey)
    expect(ephRaw.length).toBe(32)

    // Pad to 33 bytes
    const padded = new Uint8Array(33)
    padded[0] = 0x00
    padded.set(ephRaw, 1)

    expect(padded.length).toBe(33)
    expect(padded[0]).toBe(0x00)
    expect(padded.slice(1)).toEqual(ephRaw)
  })

  it('round-trip: pad 32 -> 33 -> strip back to 32', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)

    const ephRaw = hexToBytes(stealth.stealthAddress.ephemeralPublicKey)

    // Pad
    const padded = new Uint8Array(33)
    padded[0] = 0x00
    padded.set(ephRaw, 1)

    // Strip
    const stripped = padded[0] === 0x00 ? padded.slice(1) : padded
    expect(stripped).toEqual(ephRaw)
    expect(bytesToHex(stripped)).toBe(stealth.stealthAddress.ephemeralPublicKey)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Viewing key hash
// ─────────────────────────────────────────────────────────────────────────────

describe('Viewing key hash', () => {
  it('produces a 32-byte SHA-256 hash', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const vkBytes = hexToBytes(meta.metaAddress.viewingKey)
    const hash = sha256(vkBytes)
    expect(hash.length).toBe(32)
  })

  it('same key produces same hash', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const vkBytes = hexToBytes(meta.metaAddress.viewingKey)
    const hash1 = sha256(vkBytes)
    const hash2 = sha256(vkBytes)
    expect(hash1).toEqual(hash2)
  })

  it('different keys produce different hashes', () => {
    const meta1 = generateEd25519StealthMetaAddress('solana')
    const meta2 = generateEd25519StealthMetaAddress('solana')
    const hash1 = sha256(hexToBytes(meta1.metaAddress.viewingKey))
    const hash2 = sha256(hexToBytes(meta2.metaAddress.viewingKey))
    expect(bytesToHex(hash1)).not.toBe(bytesToHex(hash2))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end: send params construction
// ─────────────────────────────────────────────────────────────────────────────

describe('Send crypto params construction', () => {
  it('builds correct byte arrays for on-chain instruction', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)
    const amount = BigInt(1_000_000_000) // 1 SOL in lamports

    // Pedersen commitment (33 bytes)
    const { commitment } = commit(amount)
    const amountCommitment = hexToBytes(commitment)
    expect(amountCommitment.length).toBe(33)

    // Ephemeral pubkey padded to 33 bytes
    const ephRaw = hexToBytes(stealth.stealthAddress.ephemeralPublicKey)
    const ephemeralPubkey = new Uint8Array(33)
    ephemeralPubkey[0] = 0x00
    ephemeralPubkey.set(ephRaw, 1)
    expect(ephemeralPubkey.length).toBe(33)

    // Viewing key hash (32 bytes)
    const vkBytes = hexToBytes(meta.metaAddress.viewingKey)
    const viewingKeyHash = sha256(vkBytes)
    expect(viewingKeyHash.length).toBe(32)

    // Stealth address resolves to a valid Solana address
    const solAddr = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address)
    expect(solAddr.length).toBeGreaterThanOrEqual(32)
  })

  it('stealth meta-address parses correctly from sip: format', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const encoded = `sip:solana:${meta.metaAddress.spendingKey}:${meta.metaAddress.viewingKey}`

    const parts = encoded.split(':')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('sip')
    expect(parts[1]).toBe('solana')
    expect(parts[2]).toBe(meta.metaAddress.spendingKey)
    expect(parts[3]).toBe(meta.metaAddress.viewingKey)

    // Can reconstruct meta-address and generate stealth from parsed values
    const reconstructed = { spendingKey: parts[2], viewingKey: parts[3], chain: 'solana' }
    const stealth = generateEd25519StealthAddress(reconstructed as any)
    const isOurs = checkEd25519StealthAddress(
      stealth.stealthAddress,
      meta.viewingPrivateKey,
      meta.metaAddress.spendingKey
    )
    expect(isOurs).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end: scan matching simulation
// ─────────────────────────────────────────────────────────────────────────────

describe('Scan matching simulation', () => {
  it('filters matching payments from a set of events', () => {
    const alice = generateEd25519StealthMetaAddress('solana')
    const bob = generateEd25519StealthMetaAddress('solana')

    // Simulate 3 events: 2 for Alice, 1 for Bob
    const events = [
      generateEd25519StealthAddress(alice.metaAddress),
      generateEd25519StealthAddress(bob.metaAddress),
      generateEd25519StealthAddress(alice.metaAddress),
    ]

    // Alice scans — should find 2 matches
    const aliceMatches = events.filter((e) =>
      checkEd25519StealthAddress(
        e.stealthAddress,
        alice.viewingPrivateKey,
        alice.metaAddress.spendingKey
      )
    )
    expect(aliceMatches).toHaveLength(2)

    // Bob scans — should find 1 match
    const bobMatches = events.filter((e) =>
      checkEd25519StealthAddress(
        e.stealthAddress,
        bob.viewingPrivateKey,
        bob.metaAddress.spendingKey
      )
    )
    expect(bobMatches).toHaveLength(1)
  })

  it('reconstructs StealthAddress from on-chain bytes for matching', () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)

    // Simulate on-chain storage: pad ephemeral to 33 bytes
    const ephRaw = hexToBytes(stealth.stealthAddress.ephemeralPublicKey)
    const onChainEph = new Uint8Array(33)
    onChainEph[0] = 0x00
    onChainEph.set(ephRaw, 1)

    // Scanner strips the prefix and reconstructs StealthAddress
    const stripped = onChainEph[0] === 0x00 ? onChainEph.slice(1) : onChainEph

    // Compute viewTag: sha256(viewingScalar * ephemeralPub)[0]
    // On-chain events don't store the viewTag, so the scanner derives it
    // (canonical EIP-5564: the ECDH shared secret is computed on the viewing key).
    const viewingScalar = deriveEd25519Scalar(hexToBytes(meta.viewingPrivateKey))
    const ephPoint = ed25519.ExtendedPoint.fromHex(stripped)
    const sharedPoint = ephPoint.multiply(viewingScalar)
    const sharedHash = sha256(sharedPoint.toRawBytes())
    const viewTag = sharedHash[0]

    const reconstructed = {
      address: stealth.stealthAddress.address,
      ephemeralPublicKey: bytesToHex(stripped) as `0x${string}`,
      viewTag,
    }

    const isOurs = checkEd25519StealthAddress(
      reconstructed,
      meta.viewingPrivateKey,
      meta.metaAddress.spendingKey
    )
    expect(isOurs).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// scanForPayments — canonical view-only round-trip (vault event scan)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a 194-byte VaultWithdrawEvent buffer addressed to a stealth recipient.
 * Mirrors the layout parsed by parseWithdrawEvent in src/privacy.ts:
 *   disc(8) + depositor(32) + stealth(32) + commitment(33) + ephemeral(33)
 *   + vk_hash(32) + amount(8) + fee(8) + timestamp(8)
 */
function buildWithdrawEvent(
  stealthAddressHex: string,
  ephemeralHex: string,
  amount = 1_000_000_000n,
  fee = 5_000_000n,
): Buffer {
  const buf = Buffer.alloc(194)
  let off = 8 // discriminator (unused by the parser)
  off += 32 // depositor (unused by matching)
  Buffer.from(hexToBytes(stealthAddressHex)).copy(buf, off); off += 32
  off += 33 // amount_commitment (unused by matching)
  // ephemeral pubkey: on-chain 33-byte format = 0x00 prefix + 32-byte ed25519
  buf[off] = 0x00
  Buffer.from(hexToBytes(ephemeralHex)).copy(buf, off + 1); off += 33
  off += 32 // viewing_key_hash (unused by matching)
  buf.writeBigUInt64LE(amount, off); off += 8
  buf.writeBigUInt64LE(fee, off); off += 8
  buf.writeBigInt64LE(1_700_000_000n, off)
  return buf
}

/** Minimal Connection stub returning a single transaction carrying one event. */
function mockConnectionWithEvent(eventBuf: Buffer): Connection {
  const logMessages = ['Program data: ' + eventBuf.toString('base64')]
  return {
    getSignaturesForAddress: async () => [{ signature: 'sig-1' }],
    getParsedTransactions: async () => [{ meta: { logMessages } }],
  } as unknown as Connection
}

describe('scanForPayments — canonical view-only round-trip', () => {
  it('finds a payment using the viewing private key + spending PUBLIC key', async () => {
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)

    const connection = mockConnectionWithEvent(
      buildWithdrawEvent(
        stealth.stealthAddress.address,
        stealth.stealthAddress.ephemeralPublicKey,
      ),
    )

    const result = await scanForPayments({
      connection,
      viewingPrivateKey: hexToBytes(meta.viewingPrivateKey),
      spendingPublicKey: hexToBytes(meta.metaAddress.spendingKey),
    })

    expect(result.payments).toHaveLength(1)
    expect(result.payments[0].transferAmount).toBe(1_000_000_000n)
    expect(result.payments[0].stealthAddress.toBase58()).toBe(
      ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address),
    )
  })

  it('does NOT match a stranger scanning with the wrong viewing key', async () => {
    const recipient = generateEd25519StealthMetaAddress('solana')
    const stranger = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(recipient.metaAddress)

    const connection = mockConnectionWithEvent(
      buildWithdrawEvent(
        stealth.stealthAddress.address,
        stealth.stealthAddress.ephemeralPublicKey,
      ),
    )

    const result = await scanForPayments({
      connection,
      viewingPrivateKey: hexToBytes(stranger.viewingPrivateKey),
      spendingPublicKey: hexToBytes(stranger.metaAddress.spendingKey),
    })

    expect(result.payments).toHaveLength(0)
  })

  it('rejects a correct viewing key paired with the wrong spending public key', async () => {
    // The viewTag is recomputed from the (correct) viewing key, so it
    // self-consistently passes the fast-reject filter — this isolates the
    // address-comparison (P_spend + H(S)*G) as the load-bearing check.
    const recipient = generateEd25519StealthMetaAddress('solana')
    const wrongSpender = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(recipient.metaAddress)

    const connection = mockConnectionWithEvent(
      buildWithdrawEvent(
        stealth.stealthAddress.address,
        stealth.stealthAddress.ephemeralPublicKey,
      ),
    )

    const result = await scanForPayments({
      connection,
      viewingPrivateKey: hexToBytes(recipient.viewingPrivateKey),
      spendingPublicKey: hexToBytes(wrongSpender.metaAddress.spendingKey),
    })

    expect(result.payments).toHaveLength(0)
  })
})
