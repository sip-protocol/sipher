import { describe, it, expect } from 'vitest'
import { ArrowDown, Circle, ShieldWarning, PaperPlaneTilt } from '@phosphor-icons/react'
import { resolveEventIcon } from '../event-icons'

describe('resolveEventIcon', () => {
  it('matches exact event type', () => {
    expect(resolveEventIcon('deposit')).toBe(ArrowDown)
    expect(resolveEventIcon('send')).toBe(PaperPlaneTilt)
  })

  it('matches prefix.subtype patterns', () => {
    expect(resolveEventIcon('deposit.success')).toBe(ArrowDown)
    expect(resolveEventIcon('sentinel.flag')).toBe(ShieldWarning)
    expect(resolveEventIcon('sentinel.flag.high')).toBe(ShieldWarning)
  })

  it('falls back to Circle for unknown types', () => {
    expect(resolveEventIcon('unknown')).toBe(Circle)
    expect(resolveEventIcon('')).toBe(Circle)
  })
})
