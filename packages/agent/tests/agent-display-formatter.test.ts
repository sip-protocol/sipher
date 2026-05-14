import { describe, it, expect } from 'vitest'
import { formatSigningDisplay } from '../src/agent.js'

describe('formatSigningDisplay', () => {
  it('formats a send display from SendToolResult shape', () => {
    const input = { amount: 1.5, token: 'SOL', recipient: 'alice.sol', wallet: 'W1' }
    const result = {
      action: 'send' as const,
      amount: 1.5,
      token: 'SOL',
      recipient: 'alice.sol',
      status: 'awaiting_signature' as const,
      message: 'prepared',
      serializedTx: 'BASE64',
      privacy: {
        stealthAddress: 'StealthABC',
        commitmentGenerated: true,
        viewingKeyHashIncluded: true,
        feeBps: 50,
        estimatedFee: '0.0075 SOL',
        netAmount: '1.4925',
      },
    }
    const display = formatSigningDisplay('send', input, result)
    expect(display.title).toMatch(/send/i)
    expect(display.title).toContain('1.5')
    expect(display.title).toContain('SOL')
    expect(display.title).toContain('alice.sol')
    expect(display.primaryDetail.toLowerCase()).toContain('stealth')
    expect(display.secondaryDetails.join('|')).toContain('0.0075 SOL')
    expect(display.secondaryDetails.join('|')).toContain('1.4925')
  })

  it('formats a swap display from SwapToolResult shape', () => {
    const input = { amount: 1, fromToken: 'SOL', toToken: 'USDC', wallet: 'W1' }
    const result = {
      action: 'swap' as const,
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      recipient: null,
      slippageBps: 50,
      status: 'awaiting_signature' as const,
      message: 'prepared',
      serializedTx: 'BASE64',
      quote: { estimatedOutput: '150.25', priceImpact: '0.1', route: ['Jupiter v6'] },
      privacy: { stealthRouted: true, stealthAddress: 'StealthXYZ' },
    }
    const display = formatSigningDisplay('swap', input, result)
    expect(display.title).toMatch(/swap/i)
    expect(display.title).toContain('1')
    expect(display.title).toContain('SOL')
    expect(display.title).toContain('150.25')
    expect(display.title).toContain('USDC')
    expect(display.primaryDetail.toLowerCase()).toMatch(/jupiter|route/)
    expect(display.secondaryDetails.join('|')).toContain('0.5%')
  })

  it('truncates long recipient addresses in send title', () => {
    const long = 'Hx7m1234567890qwertyuiopasdfghjklzxcvbnm12345678'
    const input = { amount: 1, token: 'SOL', recipient: long, wallet: 'W1' }
    const result = {
      action: 'send' as const,
      amount: 1,
      token: 'SOL',
      recipient: long,
      status: 'awaiting_signature' as const,
      message: '',
      serializedTx: 'BASE64',
      privacy: {
        stealthAddress: 'S',
        commitmentGenerated: false,
        viewingKeyHashIncluded: false,
        feeBps: 50,
        estimatedFee: '0.005 SOL',
        netAmount: '0.995',
      },
    }
    const display = formatSigningDisplay('send', input, result)
    expect(display.title.length).toBeLessThanOrEqual(80)
    expect(display.title).toContain('...')
  })
})
