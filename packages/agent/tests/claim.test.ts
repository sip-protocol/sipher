// packages/agent/tests/claim.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the SDK BEFORE importing claim.ts
vi.mock('@sip-protocol/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sip-protocol/sdk')>('@sip-protocol/sdk')
  return {
    ...actual,
    claimStealthPayment: vi.fn(),
  }
})

// Mock helpers + sipher connection helper
vi.mock('../src/tools/claim-helpers.js', () => ({
  resolveStealthContext: vi.fn(),
  StealthContextError: class StealthContextError extends Error {
    constructor(message: string, public code: string) {
      super(message)
      this.name = 'StealthContextError'
    }
  },
}))

vi.mock('@sipher/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sipher/sdk')>('@sipher/sdk')
  return {
    ...actual,
    createConnection: vi.fn(() => ({
      // Minimal Connection mock surface — methods called by claim flow indirectly
    })),
  }
})

import { claimTool, executeClaim } from '../src/tools/claim.js'
import { claimStealthPayment } from '@sip-protocol/sdk'
import { resolveStealthContext } from '../src/tools/claim-helpers.js'

const VALID_TX_SIG = '5' + 'a'.repeat(87)
const VALID_VIEWING_KEY = 'ab'.repeat(32)
const VALID_SPENDING_KEY = 'cd'.repeat(32)
const VALID_DESTINATION = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const STEALTH_ADDR = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const EPHEMERAL_PUBKEY = 'GqvBwYTWWZRyDQ4ZeNvFLgfbA8wYjBvE6cKxFQXjHvSr'
const MINT_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const CLAIM_TX_SIG = '4Hc' + 'b'.repeat(85)

describe('claimTool definition', () => {
  it('has correct name', () => {
    expect(claimTool.name).toBe('claim')
  })

  it('declares required input fields', () => {
    expect(claimTool.input_schema.required).toEqual([
      'txSignature',
      'viewingKey',
      'spendingKey',
    ])
  })

  it('declares optional destinationWallet and mint fields', () => {
    expect(claimTool.input_schema.properties).toHaveProperty('destinationWallet')
    expect(claimTool.input_schema.properties).toHaveProperty('mint')
  })
})

describe('executeClaim — happy path', () => {
  beforeEach(() => {
    vi.mocked(resolveStealthContext).mockResolvedValue({
      stealthAddress: STEALTH_ADDR,
      ephemeralPublicKey: EPHEMERAL_PUBKEY,
      mint: MINT_USDC,
    })
    vi.mocked(claimStealthPayment).mockResolvedValue({
      txSignature: CLAIM_TX_SIG,
      destinationAddress: VALID_DESTINATION,
      amount: 1000000n,
      explorerUrl: `https://solscan.io/tx/${CLAIM_TX_SIG}`,
    })
  })

  it('returns confirmed status with claim signature', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
      destinationWallet: VALID_DESTINATION,
    })

    expect(result.action).toBe('claim')
    expect(result.status).toBe('confirmed')
    expect(result.signature).toBe(CLAIM_TX_SIG)
    expect(result.depositTxSignature).toBe(VALID_TX_SIG)
    expect(result.destinationWallet).toBe(VALID_DESTINATION)
    expect(result.amount).toBe('1000000')
    expect(result.mint).toBe(MINT_USDC)
    expect(result.explorerUrl).toContain(CLAIM_TX_SIG)
  })

  it('passes resolved stealth context to claimStealthPayment', async () => {
    await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
      destinationWallet: VALID_DESTINATION,
    })

    expect(claimStealthPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        stealthAddress: STEALTH_ADDR,
        ephemeralPublicKey: EPHEMERAL_PUBKEY,
        destinationAddress: VALID_DESTINATION,
      }),
    )
  })

  it('truncates deposit signature in message', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
      destinationWallet: VALID_DESTINATION,
    })

    expect(result.message).toContain(VALID_TX_SIG.slice(0, 12))
    expect(result.message).toContain(CLAIM_TX_SIG.slice(0, 12))
  })
})

describe('executeClaim — input validation (regression)', () => {
  it('rejects empty txSignature', async () => {
    await expect(
      executeClaim({
        txSignature: '',
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/transaction signature is required/i)
  })

  it('rejects whitespace-only txSignature', async () => {
    await expect(
      executeClaim({
        txSignature: '   ',
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/transaction signature is required/i)
  })

  it('rejects empty viewingKey', async () => {
    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: '',
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/viewing key is required/i)
  })

  it('rejects empty spendingKey', async () => {
    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: '',
      })
    ).rejects.toThrow(/spending key is required/i)
  })
})
