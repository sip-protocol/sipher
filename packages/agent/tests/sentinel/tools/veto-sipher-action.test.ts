import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGuardianEmit } = vi.hoisted(() => ({
  mockGuardianEmit: vi.fn(),
}))

vi.mock('../../../src/coordination/event-bus.js', () => ({
  guardianBus: { emit: mockGuardianEmit },
}))

import {
  vetoSipherTool,
  executeVetoSipher,
} from '../../../src/sentinel/tools/veto-sipher-action.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('vetoSipherTool definition', () => {
  it('has correct name', () => {
    expect(vetoSipherTool.name).toBe('vetoSipherAction')
  })

  it('declares required contextId and reason', () => {
    expect(vetoSipherTool.input_schema.required).toEqual(['contextId', 'reason'])
  })

  it('has a non-empty description', () => {
    expect(vetoSipherTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeVetoSipher — happy path', () => {
  it('returns vetoed=true with the supplied reason', async () => {
    const r = await executeVetoSipher({ contextId: 'ctx1', reason: 'known scam address' })
    expect(r.vetoed).toBe(true)
    expect(r.reason).toBe('known scam address')
  })

  it('output shape has exactly { vetoed, reason }', async () => {
    const r = await executeVetoSipher({ contextId: 'ctx1', reason: 'known scam' })
    expect(Object.keys(r).sort()).toEqual(['reason', 'vetoed'])
  })
})

describe('executeVetoSipher — service interaction', () => {
  it('emits sentinel:veto event on guardianBus with critical level', async () => {
    await executeVetoSipher({ contextId: 'ctx1', reason: 'critical violation' })

    expect(mockGuardianEmit).toHaveBeenCalledTimes(1)
    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event).toMatchObject({
      source: 'sentinel',
      type: 'sentinel:veto',
      level: 'critical',
      data: { contextId: 'ctx1', reason: 'critical violation' },
      wallet: null,
    })
    expect(typeof event.timestamp).toBe('string')
  })

  it('forwards arbitrary contextId and reason verbatim', async () => {
    await executeVetoSipher({ contextId: 'long-ctx-id-12345', reason: 'multi word reason text' })

    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event.data).toEqual({
      contextId: 'long-ctx-id-12345',
      reason: 'multi word reason text',
    })
  })
})
