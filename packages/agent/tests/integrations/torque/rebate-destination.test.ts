import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Connection } from '@solana/web3.js'

vi.mock('@sip-protocol/sns-stealth', () => ({
  resolveSIPStealth: vi.fn(),
  MetaAddress: class MetaAddress {
    constructor(
      public readonly spending: Uint8Array,
      public readonly viewing: Uint8Array,
      public readonly chain: 'solana',
      public readonly domain: string,
    ) {}
  },
  // Real NotFound uses `subject` (not `kind`), matching the actual package shape.
  NotFound: class NotFound {
    readonly name = 'NotFound'
    constructor(public readonly subject: 'domain' | 'record') {}
  },
}))

import { resolveSIPStealth, MetaAddress, NotFound } from '@sip-protocol/sns-stealth'
import {
  deriveRebateDestination,
  _resetRebateDestinationCacheForTests,
} from '../../../src/integrations/torque/rebate-destination.js'

const WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const conn = {} as Connection

describe('deriveRebateDestination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetRebateDestinationCacheForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('derives a stealth address from the SNS SIP-STEALTH record when present', async () => {
    const meta = new MetaAddress(
      new Uint8Array(32).fill(0xaa),
      new Uint8Array(32).fill(0xbb),
      'solana',
      'rector.sol',
    )
    vi.mocked(resolveSIPStealth).mockResolvedValue(meta as never)

    const result = await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })

    expect(result.kind).toBe('stealth')
    if (result.kind === 'stealth') {
      expect(result.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/) // base58
    }
    expect(resolveSIPStealth).toHaveBeenCalledWith(conn, 'rector.sol')
  })

  it('returns null + warns when SNS record not found AND no legacy meta', async () => {
    vi.mocked(resolveSIPStealth).mockResolvedValue(new NotFound('record') as never)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })

    expect(result).toStrictEqual({ kind: 'unavailable', address: null, reason: 'no_sns_record' })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('rebate skipped'),
    )
  })

  it('returns null when no domain provided (no SNS to query)', async () => {
    const result = await deriveRebateDestination({ wallet: WALLET, connection: conn })
    expect(result).toStrictEqual({ kind: 'unavailable', address: null, reason: 'no_domain' })
    expect(resolveSIPStealth).not.toHaveBeenCalled()
  })

  it('caches resolution per wallet+domain for 60s', async () => {
    const meta = new MetaAddress(
      new Uint8Array(32).fill(0xaa),
      new Uint8Array(32).fill(0xbb),
      'solana',
      'rector.sol',
    )
    vi.mocked(resolveSIPStealth).mockResolvedValue(meta as never)

    await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })
    await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })

    expect(resolveSIPStealth).toHaveBeenCalledOnce()
  })

  it('returns sns_error + warns when SNS resolution throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(resolveSIPStealth).mockRejectedValue(new Error('RPC timeout'))

    const result = await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })

    expect(result).toStrictEqual({ kind: 'unavailable', address: null, reason: 'sns_error' })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('RPC timeout'))
  })
})
