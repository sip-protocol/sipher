import { describe, it, expect } from 'vitest'
import { assertNever } from '../../src/core/assert-never.js'

describe('assertNever', () => {
  it('throws with a message containing the unexpected value', () => {
    expect(() => assertNever('unexpected_variant' as never)).toThrow(/unexpected_variant/)
  })

  it('throws even for non-string runtime values (defensive)', () => {
    expect(() => assertNever({ shape: 'object' } as never)).toThrow(/Unhandled discriminant/)
  })

  it('throws for numeric runtime values', () => {
    expect(() => assertNever(42 as never)).toThrow(/42/)
  })
})
