import { describe, it, expect } from 'vitest'
import { sanitizeArgs } from '../sanitize-args'

describe('sanitizeArgs', () => {
  it('truncates long base58 strings to first-4-last-4', () => {
    const out = sanitizeArgs({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' })
    expect(out).toBe('wallet=FGSk...BWWr')
  })

  it('redacts sensitive keys', () => {
    const out = sanitizeArgs({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      privateKey: 'should-not-leak',
      mnemonic: 'word1 word2 ...',
    })
    expect(out).not.toContain('should-not-leak')
    expect(out).not.toContain('word1')
    expect(out).toContain('wallet=FGSk...BWWr')
  })

  it('truncates short non-base58 strings to 40 chars', () => {
    const out = sanitizeArgs({
      message: 'a'.repeat(50),
    })
    expect(out).toBe(`message=${'a'.repeat(40)}…`)
  })

  it('passes through small numbers and booleans', () => {
    const out = sanitizeArgs({ amount: 1.5, dryRun: true })
    expect(out).toBe('amount=1.5, dryRun=true')
  })

  it('returns empty string for null/undefined input', () => {
    expect(sanitizeArgs(null)).toBe('')
    expect(sanitizeArgs(undefined)).toBe('')
    expect(sanitizeArgs({})).toBe('')
  })
})
