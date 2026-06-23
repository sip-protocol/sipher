import { describe, it, expect } from 'vitest'
import { sha256, sha512 } from '@noble/hashes/sha2.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'

// Known-answer vectors (NIST FIPS 180-4 for SHA-2, Ethereum/Keccak team for keccak-256).
// These lock the exact byte output of every @noble/hashes primitive sipher's privacy
// stack depends on, so a major-version bump (v1 -> v2) cannot silently change a hash.
const ASCII_ABC = Uint8Array.from([0x61, 0x62, 0x63]) // "abc"
const EMPTY = new Uint8Array(0)

describe('@noble/hashes primitives — known-answer vectors', () => {
  it('sha256 matches NIST vectors (empty + "abc")', () => {
    expect(bytesToHex(sha256(EMPTY))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(bytesToHex(sha256(ASCII_ABC))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('sha512 matches NIST vector ("abc")', () => {
    expect(bytesToHex(sha512(ASCII_ABC))).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    )
  })

  it('keccak_256 matches Ethereum vectors (empty + "abc")', () => {
    expect(bytesToHex(keccak_256(EMPTY))).toBe(
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    )
    expect(bytesToHex(keccak_256(ASCII_ABC))).toBe(
      '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
    )
  })
})

describe('@noble/hashes utils — hex round-trip', () => {
  it('bytesToHex produces lowercase hex', () => {
    expect(bytesToHex(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]))).toBe('deadbeef')
  })

  it('hexToBytes inverts bytesToHex', () => {
    const bytes = Uint8Array.from([0x00, 0x7f, 0x80, 0xff])
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes)
  })
})
