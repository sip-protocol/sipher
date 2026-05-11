// packages/agent/tests/resolve-sns.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockResolveSIPStealth, mockCreateConnection } = vi.hoisted(() => ({
  mockResolveSIPStealth: vi.fn(),
  mockCreateConnection: vi.fn(),
}))

vi.mock('@sip-protocol/sns-stealth', async () => {
  const actual = await vi.importActual<typeof import('@sip-protocol/sns-stealth')>(
    '@sip-protocol/sns-stealth',
  )
  return {
    ...actual,
    resolveSIPStealth: mockResolveSIPStealth,
  }
})

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
}))

import { MetaAddress, NotFound, Malformed, NetworkError } from '@sip-protocol/sns-stealth'
import { resolveSNSTool, executeResolveSNS } from '../src/tools/resolve-sns.js'

const SPENDING_BYTES = new Uint8Array(32).fill(0xaa)
const VIEWING_BYTES = new Uint8Array(32).fill(0xbb)
const EXPECTED_SPENDING_HEX = 'aa'.repeat(32)
const EXPECTED_VIEWING_HEX = 'bb'.repeat(32)

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
})

describe('resolveSNSTool descriptor', () => {
  it('has correct name', () => {
    expect(resolveSNSTool.name).toBe('resolveSNS')
  })

  it('declares domain as the only required field', () => {
    expect(resolveSNSTool.input_schema.required).toEqual(['domain'])
    expect(resolveSNSTool.input_schema.properties).toHaveProperty('domain')
  })

  it('description identifies the tool as read-only', () => {
    expect(resolveSNSTool.description).toMatch(/does not move funds/i)
  })
})

describe('executeResolveSNS — input validation', () => {
  it.each(['', ' ', '   ', '\t', '\n'])(
    'rejects empty/whitespace domain (%j)',
    async (input) => {
      await expect(executeResolveSNS({ domain: input })).rejects.toThrow(
        /domain is required/i,
      )
      expect(mockResolveSIPStealth).not.toHaveBeenCalled()
    },
  )

  it('rejects non-.sol domains', async () => {
    await expect(executeResolveSNS({ domain: 'rector.eth' })).rejects.toThrow(
      /must end in \.sol/i,
    )
    expect(mockResolveSIPStealth).not.toHaveBeenCalled()
  })

  it('rejects bare domain without TLD', async () => {
    await expect(executeResolveSNS({ domain: 'rector' })).rejects.toThrow(
      /must end in \.sol/i,
    )
  })

  it('lowercases + trims domain before resolving', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce(
      new MetaAddress(SPENDING_BYTES, VIEWING_BYTES, 'solana', 'rector.sol'),
    )

    await executeResolveSNS({ domain: '  RECTOR.SOL  ' })

    expect(mockResolveSIPStealth).toHaveBeenCalledTimes(1)
    expect(mockResolveSIPStealth.mock.calls[0][1]).toBe('rector.sol')
  })
})

describe('executeResolveSNS — resolved path', () => {
  it('returns resolved status with hex pair', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce(
      new MetaAddress(SPENDING_BYTES, VIEWING_BYTES, 'solana', 'rector.sol'),
    )

    const result = await executeResolveSNS({ domain: 'rector.sol' })

    expect(result).toStrictEqual({
      status: 'resolved',
      domain: 'rector.sol',
      chain: 'solana',
      spending: EXPECTED_SPENDING_HEX,
      viewing: EXPECTED_VIEWING_HEX,
    })
  })

  it('returns lowercase hex without 0x prefix', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce(
      new MetaAddress(SPENDING_BYTES, VIEWING_BYTES, 'solana', 'rector.sol'),
    )

    const result = await executeResolveSNS({ domain: 'rector.sol' })

    if (result.status !== 'resolved') throw new Error('expected resolved')
    expect(result.spending).toMatch(/^[0-9a-f]{64}$/)
    expect(result.viewing).toMatch(/^[0-9a-f]{64}$/)
    expect(result.spending.startsWith('0x')).toBe(false)
    expect(result.viewing.startsWith('0x')).toBe(false)
  })

  it('uses the MetaAddress.domain field in the result (echoes resolver normalization)', async () => {
    // Resolver returns its own canonical form; we surface it as-is.
    mockResolveSIPStealth.mockResolvedValueOnce(
      new MetaAddress(SPENDING_BYTES, VIEWING_BYTES, 'solana', 'normalized.sol'),
    )

    const result = await executeResolveSNS({ domain: 'rector.sol' })

    if (result.status !== 'resolved') throw new Error('expected resolved')
    expect(result.domain).toBe('normalized.sol')
  })
})

describe('executeResolveSNS — not-found path', () => {
  it('returns subject="record" when SIP-STEALTH record missing', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce(new NotFound('record'))

    const result = await executeResolveSNS({ domain: 'rector.sol' })

    expect(result).toStrictEqual({
      status: 'not-found',
      domain: 'rector.sol',
      subject: 'record',
    })
  })

  it('returns subject="domain" when .sol domain not registered', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce(new NotFound('domain'))

    const result = await executeResolveSNS({ domain: 'unclaimed.sol' })

    expect(result).toStrictEqual({
      status: 'not-found',
      domain: 'unclaimed.sol',
      subject: 'domain',
    })
  })
})

describe('executeResolveSNS — malformed path', () => {
  it('returns reason="schema" for schema validation failure', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce(new Malformed('schema'))

    const result = await executeResolveSNS({ domain: 'rector.sol' })

    expect(result).toStrictEqual({
      status: 'malformed',
      domain: 'rector.sol',
      reason: 'schema',
    })
  })

  it('returns reason="json-parse" for invalid JSON record', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce(new Malformed('json-parse'))

    const result = await executeResolveSNS({ domain: 'rector.sol' })

    expect(result).toStrictEqual({
      status: 'malformed',
      domain: 'rector.sol',
      reason: 'json-parse',
    })
  })
})

describe('executeResolveSNS — network-error path', () => {
  it('returns network-error when resolveSIPStealth throws NetworkError', async () => {
    mockResolveSIPStealth.mockRejectedValueOnce(
      new NetworkError('RPC timeout', new Error('socket hang up')),
    )

    const result = await executeResolveSNS({ domain: 'rector.sol' })

    expect(result).toStrictEqual({
      status: 'network-error',
      domain: 'rector.sol',
      message: 'RPC timeout',
    })
  })

  it('re-throws non-NetworkError exceptions', async () => {
    mockResolveSIPStealth.mockRejectedValueOnce(new Error('unexpected boom'))

    await expect(executeResolveSNS({ domain: 'rector.sol' })).rejects.toThrow(
      /unexpected boom/i,
    )
  })
})

describe('executeResolveSNS — service interaction', () => {
  it('passes the connection from createConnection to resolveSIPStealth', async () => {
    const sentinelConnection = { __sentinel: true }
    mockCreateConnection.mockReturnValueOnce(sentinelConnection)
    mockResolveSIPStealth.mockResolvedValueOnce(
      new MetaAddress(SPENDING_BYTES, VIEWING_BYTES, 'solana', 'rector.sol'),
    )

    await executeResolveSNS({ domain: 'rector.sol' })

    expect(mockResolveSIPStealth).toHaveBeenCalledWith(sentinelConnection, 'rector.sol')
  })

  it('uses devnet cluster (vitest env)', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce(
      new MetaAddress(SPENDING_BYTES, VIEWING_BYTES, 'solana', 'rector.sol'),
    )

    await executeResolveSNS({ domain: 'rector.sol' })

    expect(mockCreateConnection).toHaveBeenCalledWith('devnet')
  })
})

describe('executeResolveSNS — unexpected resolver shape', () => {
  it('throws on resolver returning a non-recognized result', async () => {
    mockResolveSIPStealth.mockResolvedValueOnce({ unexpected: true } as never)

    await expect(executeResolveSNS({ domain: 'rector.sol' })).rejects.toThrow(
      /unexpected resolveSIPStealth result/i,
    )
  })
})
