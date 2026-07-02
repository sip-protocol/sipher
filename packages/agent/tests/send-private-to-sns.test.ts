// packages/agent/tests/send-private-to-sns.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecuteResolveSNS, mockExecuteSend } = vi.hoisted(() => ({
  mockExecuteResolveSNS: vi.fn(),
  mockExecuteSend: vi.fn(),
}))

vi.mock('../src/tools/resolve-sns.js', () => ({
  executeResolveSNS: mockExecuteResolveSNS,
}))

vi.mock('../src/tools/send.js', () => ({
  executeSend: mockExecuteSend,
}))

import {
  sendPrivateToSNSTool,
  executeSendPrivateToSNS,
} from '../src/tools/send-private-to-sns.js'

const SPENDING_HEX = 'aa'.repeat(32)
const VIEWING_HEX = 'bb'.repeat(32)
const RESOLVED_URI = `sip:solana:0x${SPENDING_HEX}:0x${VIEWING_HEX}`

const makeResolvedOk = (domain = 'rector.sol') => ({
  status: 'resolved' as const,
  domain,
  chain: 'solana' as const,
  spending: SPENDING_HEX,
  viewing: VIEWING_HEX,
})

const makeSendOk = () => ({
  action: 'send' as const,
  amount: 10,
  token: 'USDC',
  recipient: RESOLVED_URI,
  status: 'awaiting_signature' as const,
  message: 'Private send prepared: 10 USDC',
  serializedTx: 'BASE64_TX_BYTES',
  privacy: {
    stealthAddress: 'Stealth111',
    commitmentGenerated: true,
    viewingKeyHashIncluded: true,
    feeTenthsBps: 500,
    estimatedFee: '0.05 USDC',
    netAmount: '9.95',
  },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendPrivateToSNSTool descriptor', () => {
  it('has correct name', () => {
    expect(sendPrivateToSNSTool.name).toBe('sendPrivateToSNS')
  })

  it('declares recipient, amount, token as required — wallet/memo optional', () => {
    expect(sendPrivateToSNSTool.input_schema.required).toEqual([
      'recipient',
      'amount',
      'token',
    ])
    const props = sendPrivateToSNSTool.input_schema.properties
    expect(props).toHaveProperty('wallet')
    expect(props).toHaveProperty('memo')
  })

  it('description mentions .sol resolution + delegation to send', () => {
    expect(sendPrivateToSNSTool.description).toMatch(/\.sol/i)
    expect(sendPrivateToSNSTool.description).toMatch(/SIP-STEALTH/i)
  })
})

describe('executeSendPrivateToSNS — input validation', () => {
  it.each(['', ' ', '   ', '\t'])(
    'rejects empty/whitespace recipient (%j)',
    async (input) => {
      await expect(
        executeSendPrivateToSNS({ recipient: input, amount: 10, token: 'USDC' }),
      ).rejects.toThrow(/recipient \.sol domain is required/i)
      expect(mockExecuteResolveSNS).not.toHaveBeenCalled()
      expect(mockExecuteSend).not.toHaveBeenCalled()
    },
  )

  it('rejects non-.sol recipient', async () => {
    await expect(
      executeSendPrivateToSNS({
        recipient: 'rector.eth',
        amount: 10,
        token: 'USDC',
      }),
    ).rejects.toThrow(/recipient must be a \.sol domain/i)
    expect(mockExecuteResolveSNS).not.toHaveBeenCalled()
  })

  it('rejects bare recipient without TLD', async () => {
    await expect(
      executeSendPrivateToSNS({
        recipient: 'rector',
        amount: 10,
        token: 'USDC',
      }),
    ).rejects.toThrow(/recipient must be a \.sol domain/i)
  })

  it('normalizes recipient (trim + lowercase) before resolving', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce(makeResolvedOk())
    mockExecuteSend.mockResolvedValueOnce(makeSendOk())

    await executeSendPrivateToSNS({
      recipient: '  RECTOR.SOL  ',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    expect(mockExecuteResolveSNS).toHaveBeenCalledWith({ domain: 'rector.sol' })
  })
})

describe('executeSendPrivateToSNS — happy path', () => {
  it('returns composite ok result with resolved + send blocks', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce(makeResolvedOk())
    const sendResult = makeSendOk()
    mockExecuteSend.mockResolvedValueOnce(sendResult)

    const result = await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    expect(result).toStrictEqual({
      action: 'sendPrivateToSNS',
      status: 'ok',
      domain: 'rector.sol',
      resolved: {
        chain: 'solana',
        spending: SPENDING_HEX,
        viewing: VIEWING_HEX,
      },
      send: sendResult,
    })
  })

  it('builds sip: URI with 0x-prefixed hex (matching send.ts contract)', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce(makeResolvedOk())
    mockExecuteSend.mockResolvedValueOnce(makeSendOk())

    await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    expect(mockExecuteSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: RESOLVED_URI,
      }),
    )
  })

  it('forwards wallet + memo + amount + token to executeSend', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce(makeResolvedOk())
    mockExecuteSend.mockResolvedValueOnce(makeSendOk())

    await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 1.5,
      token: 'sol',
      wallet: 'walletXyz',
      memo: 'lunch money',
    })

    expect(mockExecuteSend).toHaveBeenCalledWith({
      amount: 1.5,
      token: 'sol',
      recipient: RESOLVED_URI,
      wallet: 'walletXyz',
      memo: 'lunch money',
    })
  })

  it('forwards undefined wallet for preview path', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce(makeResolvedOk())
    mockExecuteSend.mockResolvedValueOnce({ ...makeSendOk(), serializedTx: null })

    await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 10,
      token: 'USDC',
    })

    expect(mockExecuteSend).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: undefined }),
    )
  })

  it('echoes resolver-canonical domain in result', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce(makeResolvedOk('canonical.sol'))
    mockExecuteSend.mockResolvedValueOnce(makeSendOk())

    const result = await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    if (result.status !== 'ok') throw new Error('expected ok')
    expect(result.domain).toBe('canonical.sol')
  })
})

describe('executeSendPrivateToSNS — cannot-send paths', () => {
  it('returns no-record when SIP-STEALTH record missing', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce({
      status: 'not-found',
      domain: 'rector.sol',
      subject: 'record',
    })

    const result = await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    expect(result).toStrictEqual({
      action: 'sendPrivateToSNS',
      status: 'cannot-send',
      domain: 'rector.sol',
      reason: 'no-record',
    })
    expect(mockExecuteSend).not.toHaveBeenCalled()
  })

  it('returns no-domain when .sol domain not registered', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce({
      status: 'not-found',
      domain: 'unclaimed.sol',
      subject: 'domain',
    })

    const result = await executeSendPrivateToSNS({
      recipient: 'unclaimed.sol',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    expect(result).toStrictEqual({
      action: 'sendPrivateToSNS',
      status: 'cannot-send',
      domain: 'unclaimed.sol',
      reason: 'no-domain',
    })
  })

  it('returns malformed-record + reason detail for schema failure', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce({
      status: 'malformed',
      domain: 'rector.sol',
      reason: 'schema',
    })

    const result = await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    expect(result).toStrictEqual({
      action: 'sendPrivateToSNS',
      status: 'cannot-send',
      domain: 'rector.sol',
      reason: 'malformed-record',
      detail: 'schema',
    })
    expect(mockExecuteSend).not.toHaveBeenCalled()
  })

  it('returns malformed-record + reason detail for json-parse failure', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce({
      status: 'malformed',
      domain: 'rector.sol',
      reason: 'json-parse',
    })

    const result = await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    if (result.status !== 'cannot-send') throw new Error('expected cannot-send')
    expect(result.reason).toBe('malformed-record')
    expect(result.detail).toBe('json-parse')
  })

  it('returns network-error + message detail when resolver unreachable', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce({
      status: 'network-error',
      domain: 'rector.sol',
      message: 'RPC timeout',
    })

    const result = await executeSendPrivateToSNS({
      recipient: 'rector.sol',
      amount: 10,
      token: 'USDC',
      wallet: 'walletXyz',
    })

    expect(result).toStrictEqual({
      action: 'sendPrivateToSNS',
      status: 'cannot-send',
      domain: 'rector.sol',
      reason: 'network-error',
      detail: 'RPC timeout',
    })
    expect(mockExecuteSend).not.toHaveBeenCalled()
  })
})

describe('executeSendPrivateToSNS — service error propagation', () => {
  it('propagates errors from executeResolveSNS (unexpected throw)', async () => {
    mockExecuteResolveSNS.mockRejectedValueOnce(new Error('boom from resolver'))

    await expect(
      executeSendPrivateToSNS({
        recipient: 'rector.sol',
        amount: 10,
        token: 'USDC',
        wallet: 'walletXyz',
      }),
    ).rejects.toThrow(/boom from resolver/i)
    expect(mockExecuteSend).not.toHaveBeenCalled()
  })

  it('propagates errors from executeSend (e.g. insufficient balance)', async () => {
    mockExecuteResolveSNS.mockResolvedValueOnce(makeResolvedOk())
    mockExecuteSend.mockRejectedValueOnce(
      new Error('insufficient available balance'),
    )

    await expect(
      executeSendPrivateToSNS({
        recipient: 'rector.sol',
        amount: 10,
        token: 'USDC',
        wallet: 'walletXyz',
      }),
    ).rejects.toThrow(/insufficient available balance/i)
  })
})
