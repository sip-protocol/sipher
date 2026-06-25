import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { parseStealthMetaAddress, assembleWithdrawArtifacts } from '../src/stealth.js'
import { hexToBytes } from '../src/hex.js'

// Keys for parse-only tests — not required to be valid curve points.
const VIEWING = 'ab'.repeat(32)
const SPENDING = 'cd'.repeat(32)
const URI = `sip:solana:0x${SPENDING}:0x${VIEWING}`

// Valid ed25519 compressed public keys for crypto tests (generated via generateEd25519StealthMetaAddress).
const VALID_SPENDING = 'bed3f000fd20cb20a8186ae9a9da609c8f01198e1c6e8c18f0bfff9c94f7d17e'
const VALID_VIEWING = '33e39eaad6d8924030fa1540ee80de1c212d68d12d53570eb3d6bb39aa4b15e4'
const VALID_URI = `sip:solana:0x${VALID_SPENDING}:0x${VALID_VIEWING}`

describe('parseStealthMetaAddress', () => {
  it('parses a valid sip:solana URI', () => {
    const m = parseStealthMetaAddress(URI)
    expect(m).toEqual({ spendingKey: `0x${SPENDING}`, viewingKey: `0x${VIEWING}`, chain: 'solana' })
  })
  it('rejects a malformed URI (wrong parts count)', () => {
    expect(() => parseStealthMetaAddress('sip:solana:0xabc')).toThrow('Invalid stealth meta-address')
  })
  it('rejects non-0x keys', () => {
    expect(() => parseStealthMetaAddress(`sip:solana:${SPENDING}:${VIEWING}`)).toThrow('0x-prefixed')
  })
})

describe('assembleWithdrawArtifacts', () => {
  const recipient = parseStealthMetaAddress(VALID_URI)

  it('produces correctly-sized artifacts', () => {
    const a = assembleWithdrawArtifacts(recipient, 2_000_000n)
    expect(a.stealthPubkey).toBeInstanceOf(PublicKey)
    expect(a.amountCommitment.length).toBe(33)
    expect(a.ephemeralPubkey.length).toBe(33)
    expect(a.ephemeralPubkey[0]).toBe(0x00) // ed25519 32B padded with 0x00 prefix
    expect(a.viewingKeyHash.length).toBe(32)
    expect(a.proof.length).toBe(0)
    // encryptedAmount = 24 (nonce) + 40 (plaintext) + 16 (poly1305 tag) = 80
    expect(a.encryptedAmount.length).toBe(80)
  })

  it('encrypts [amount LE || blinding] recoverable with the viewing-key hash', () => {
    const amount = 2_000_000n
    const a = assembleWithdrawArtifacts(recipient, amount)
    const nonce = a.encryptedAmount.slice(0, 24)
    const ct = a.encryptedAmount.slice(24)
    const plaintext = xchacha20poly1305(a.viewingKeyHash, nonce).decrypt(ct)
    expect(plaintext.length).toBe(40)
    // first 8 bytes = amount LE
    let recovered = 0n
    for (let i = 7; i >= 0; i--) recovered = (recovered << 8n) | BigInt(plaintext[i])
    expect(recovered).toBe(amount)
  })

  it('uses the viewing key from the recipient (hash matches sha256(viewingKey bytes))', async () => {
    const { sha256 } = await import('@noble/hashes/sha2.js')
    const a = assembleWithdrawArtifacts(recipient, 1_000_000n)
    expect(Array.from(a.viewingKeyHash)).toEqual(Array.from(sha256(hexToBytes(`0x${VALID_VIEWING}`))))
  })
})
