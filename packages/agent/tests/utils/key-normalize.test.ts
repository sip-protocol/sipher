// packages/agent/tests/utils/key-normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeKey } from '../../src/utils/key-normalize.js'

describe('normalizeKey', () => {
  it('adds a 0x prefix to a bare hex string', () => {
    expect(normalizeKey('abcdef')).toBe('0xabcdef')
  })

  it('keeps a single 0x prefix when one is already present', () => {
    expect(normalizeKey('0xabcdef')).toBe('0xabcdef')
  })

  it('lowercases uppercase hex digits', () => {
    expect(normalizeKey('0xDEADBEEF')).toBe('0xdeadbeef')
  })

  it('normalizes a full 32-byte key (prefix + lowercase)', () => {
    expect(normalizeKey('AB'.repeat(32))).toBe(`0x${'ab'.repeat(32)}`)
  })

  it('throws on non-hex characters', () => {
    expect(() => normalizeKey('not-hex')).toThrow(/key must be hex/i)
  })

  it('throws on an empty string', () => {
    expect(() => normalizeKey('')).toThrow(/key must be hex/i)
  })

  it('throws on a bare 0x prefix with no body', () => {
    expect(() => normalizeKey('0x')).toThrow(/key must be hex/i)
  })

  it('validates hex only after stripping the 0x prefix', () => {
    expect(() => normalizeKey('0xZZ')).toThrow(/key must be hex/i)
  })
})
