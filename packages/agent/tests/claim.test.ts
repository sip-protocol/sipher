// packages/agent/tests/claim.test.ts
import { describe, it, expect } from 'vitest'
import { claimTool, executeClaim } from '../src/tools/claim.js'

const VALID_TX_SIG = '5' + 'a'.repeat(87)
const VALID_VIEWING_KEY = 'ab'.repeat(32)
const VALID_SPENDING_KEY = 'cd'.repeat(32)
const VALID_DESTINATION = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

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

  it('declares optional destinationWallet field', () => {
    expect(claimTool.input_schema.properties).toHaveProperty('destinationWallet')
  })
})

describe('executeClaim — happy path', () => {
  it('returns awaiting_signature shape with stealth key derived', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
    })

    expect(result.action).toBe('claim')
    expect(result.txSignature).toBe(VALID_TX_SIG)
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBeNull()
    expect(result.details.stealthKeyDerived).toBe(true)
    expect(result.details.destinationWallet).toBeNull()
    expect(result.details.note).toContain('ephemeral')
  })

  it('reflects destinationWallet when provided', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
      destinationWallet: VALID_DESTINATION,
    })

    expect(result.details.destinationWallet).toBe(VALID_DESTINATION)
  })

  it('truncates signature in message', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
    })

    expect(result.message).toContain(VALID_TX_SIG.slice(0, 12))
    expect(result.message).not.toContain(VALID_TX_SIG.slice(13))
  })
})

describe('executeClaim — input validation', () => {
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
