import { describe, it, expect } from 'vitest'
import { hexToBytes, bigintToLeBytes } from '../src/hex.js'

describe('hexToBytes', () => {
  it('parses a 0x-prefixed hex string', () => {
    expect(Array.from(hexToBytes('0xff00ab'))).toEqual([255, 0, 171])
  })
  it('parses a bare (no 0x) hex string', () => {
    expect(Array.from(hexToBytes('ff00ab'))).toEqual([255, 0, 171])
  })
  it('throws on odd-length hex', () => {
    expect(() => hexToBytes('0xabc')).toThrow('Invalid hex length')
  })
})

describe('bigintToLeBytes', () => {
  it('encodes a bigint little-endian in 8 bytes by default', () => {
    expect(Array.from(bigintToLeBytes(2_000_000n))).toEqual([128, 132, 30, 0, 0, 0, 0, 0])
  })
  it('honours an explicit size', () => {
    expect(Array.from(bigintToLeBytes(1n, 4))).toEqual([1, 0, 0, 0])
  })
})
