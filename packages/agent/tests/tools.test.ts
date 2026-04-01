import { describe, it, expect } from 'vitest'
import {
  depositTool,
  executeDeposit,
  sendTool,
  executeSend,
  refundTool,
  executeRefund,
  balanceTool,
  executeBalance,
  scanTool,
  executeScan,
  claimTool,
  executeClaim,
} from '../src/tools/index.js'
import { TOOLS, SYSTEM_PROMPT, executeTool } from '../src/agent.js'

// ─────────────────────────────────────────────────────────────────────────────
// Tool definition validation
// ─────────────────────────────────────────────────────────────────────────────

describe('tool definitions', () => {
  const allTools = [depositTool, sendTool, refundTool, balanceTool, scanTool, claimTool]
  const toolNames = ['deposit', 'send', 'refund', 'balance', 'scan', 'claim']

  it('exports exactly 6 tools', () => {
    expect(allTools).toHaveLength(6)
    expect(TOOLS).toHaveLength(6)
  })

  it('all tools have unique names', () => {
    const names = allTools.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each(allTools)('$name has valid Anthropic tool shape', (tool) => {
    expect(tool.name).toBeTruthy()
    expect(typeof tool.name).toBe('string')
    expect(tool.description).toBeTruthy()
    expect(typeof tool.description).toBe('string')
    expect(tool.input_schema).toBeDefined()
    expect(tool.input_schema.type).toBe('object')
    expect(tool.input_schema.properties).toBeDefined()
    expect(typeof tool.input_schema.properties).toBe('object')
  })

  it.each(allTools)('$name has required fields defined', (tool) => {
    const schema = tool.input_schema as {
      required?: string[]
      properties: Record<string, unknown>
    }
    if (schema.required) {
      for (const field of schema.required) {
        expect(schema.properties).toHaveProperty(field)
      }
    }
  })

  it('TOOLS array names match expected set', () => {
    const names = TOOLS.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(toolNames))
    expect(toolNames).toEqual(expect.arrayContaining(names))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

describe('system prompt', () => {
  it('contains the Sipher identity', () => {
    expect(SYSTEM_PROMPT).toContain('Sipher')
    expect(SYSTEM_PROMPT).toContain('privacy agent')
  })

  it('contains the tagline', () => {
    expect(SYSTEM_PROMPT).toContain('Plug in. Go private.')
  })

  it('references all 6 tools', () => {
    expect(SYSTEM_PROMPT).toContain('deposit')
    expect(SYSTEM_PROMPT).toContain('send')
    expect(SYSTEM_PROMPT).toContain('refund')
    expect(SYSTEM_PROMPT).toContain('balance')
    expect(SYSTEM_PROMPT).toContain('scan')
    expect(SYSTEM_PROMPT).toContain('claim')
  })

  it('includes the confirmation rule for fund-moving operations', () => {
    expect(SYSTEM_PROMPT).toContain('confirmation before executing')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// executeTool dispatcher
// ─────────────────────────────────────────────────────────────────────────────

describe('executeTool', () => {
  it('dispatches to deposit', async () => {
    const result = await executeTool('deposit', { amount: 1, token: 'SOL' })
    expect(result).toHaveProperty('action', 'deposit')
  })

  it('dispatches to send', async () => {
    const result = await executeTool('send', {
      amount: 1,
      token: 'SOL',
      recipient: 'SomeRecipient',
    })
    expect(result).toHaveProperty('action', 'send')
  })

  it('dispatches to refund', async () => {
    const result = await executeTool('refund', { token: 'SOL' })
    expect(result).toHaveProperty('action', 'refund')
  })

  it('dispatches to balance', async () => {
    const result = await executeTool('balance', {
      token: 'SOL',
      wallet: 'SomeWallet',
    })
    expect(result).toHaveProperty('action', 'balance')
  })

  it('dispatches to scan', async () => {
    const result = await executeTool('scan', {
      viewingKey: 'abc',
      spendingPubkey: 'def',
    })
    expect(result).toHaveProperty('action', 'scan')
  })

  it('dispatches to claim', async () => {
    const result = await executeTool('claim', {
      txSignature: 'sig123',
      viewingKey: 'abc',
      spendingKey: 'def',
    })
    expect(result).toHaveProperty('action', 'claim')
  })

  it('throws for unknown tool', async () => {
    await expect(executeTool('nonexistent', {})).rejects.toThrow('Unknown tool: nonexistent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Deposit tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeDeposit', () => {
  it('returns correct result shape', async () => {
    const result = await executeDeposit({ amount: 5, token: 'SOL' })
    expect(result.action).toBe('deposit')
    expect(result.amount).toBe(5)
    expect(result.token).toBe('SOL')
    expect(result.status).toBe('awaiting_signature')
    expect(result.wallet).toBeNull()
    expect(result.message).toContain('5')
    expect(result.message).toContain('SOL')
    expect(result.details.vaultProgram).toBe('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
  })

  it('normalizes token to uppercase', async () => {
    const result = await executeDeposit({ amount: 1, token: 'usdc' })
    expect(result.token).toBe('USDC')
  })

  it('includes wallet when provided', async () => {
    const result = await executeDeposit({
      amount: 1,
      token: 'SOL',
      wallet: 'WalletAbc123',
    })
    expect(result.wallet).toBe('WalletAbc123')
  })

  it('rejects zero amount', async () => {
    await expect(executeDeposit({ amount: 0, token: 'SOL' })).rejects.toThrow(
      'Deposit amount must be greater than zero'
    )
  })

  it('rejects negative amount', async () => {
    await expect(executeDeposit({ amount: -1, token: 'SOL' })).rejects.toThrow(
      'Deposit amount must be greater than zero'
    )
  })

  it('rejects empty token', async () => {
    await expect(executeDeposit({ amount: 1, token: '' })).rejects.toThrow(
      'Token symbol is required'
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Send tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeSend', () => {
  const validParams = { amount: 10, token: 'USDC', recipient: 'RecipientKey123' }

  it('returns correct result shape', async () => {
    const result = await executeSend(validParams)
    expect(result.action).toBe('send')
    expect(result.amount).toBe(10)
    expect(result.token).toBe('USDC')
    expect(result.recipient).toBe('RecipientKey123')
    expect(result.status).toBe('awaiting_signature')
    expect(result.privacy.commitmentGenerated).toBe(true)
    expect(result.privacy.viewingKeyHashIncluded).toBe(true)
    expect(result.privacy.feeBps).toBe(10)
  })

  it('normalizes token to uppercase', async () => {
    const result = await executeSend({ ...validParams, token: 'sol' })
    expect(result.token).toBe('SOL')
  })

  it('rejects zero amount', async () => {
    await expect(executeSend({ ...validParams, amount: 0 })).rejects.toThrow(
      'Send amount must be greater than zero'
    )
  })

  it('rejects empty recipient', async () => {
    await expect(executeSend({ ...validParams, recipient: '' })).rejects.toThrow(
      'Recipient address is required'
    )
  })

  it('rejects empty token', async () => {
    await expect(executeSend({ ...validParams, token: '  ' })).rejects.toThrow(
      'Token symbol is required'
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Refund tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeRefund', () => {
  it('returns correct result shape', async () => {
    const result = await executeRefund({ token: 'SOL' })
    expect(result.action).toBe('refund')
    expect(result.token).toBe('SOL')
    expect(result.status).toBe('awaiting_signature')
    expect(result.wallet).toBeNull()
    expect(result.details.refundTimeout).toContain('24 hours')
  })

  it('normalizes token to uppercase', async () => {
    const result = await executeRefund({ token: 'usdt' })
    expect(result.token).toBe('USDT')
  })

  it('includes wallet when provided', async () => {
    const result = await executeRefund({ token: 'SOL', wallet: 'MyWallet' })
    expect(result.wallet).toBe('MyWallet')
  })

  it('rejects empty token', async () => {
    await expect(executeRefund({ token: '' })).rejects.toThrow('Token symbol is required')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Balance tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeBalance', () => {
  const validParams = { token: 'SOL', wallet: 'WalletPubkey123' }

  it('returns correct result shape', async () => {
    const result = await executeBalance(validParams)
    expect(result.action).toBe('balance')
    expect(result.token).toBe('SOL')
    expect(result.wallet).toBe('WalletPubkey123')
    expect(result.status).toBe('success')
    expect(result.balance.total).toBe('0')
    expect(result.balance.available).toBe('0')
    expect(result.balance.locked).toBe('0')
    expect(result.balance.exists).toBe(false)
  })

  it('normalizes token to uppercase', async () => {
    const result = await executeBalance({ ...validParams, token: 'sol' })
    expect(result.token).toBe('SOL')
  })

  it('rejects empty token', async () => {
    await expect(executeBalance({ ...validParams, token: '' })).rejects.toThrow(
      'Token symbol is required'
    )
  })

  it('rejects empty wallet', async () => {
    await expect(executeBalance({ ...validParams, wallet: '' })).rejects.toThrow(
      'Wallet address is required'
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scan tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeScan', () => {
  const validParams = { viewingKey: 'vk123', spendingPubkey: 'sp456' }

  it('returns correct result shape', async () => {
    const result = await executeScan(validParams)
    expect(result.action).toBe('scan')
    expect(result.status).toBe('success')
    expect(result.payments).toEqual([])
    expect(result.eventsScanned).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('clamps limit to valid range', async () => {
    const result = await executeScan({ ...validParams, limit: 5000 })
    // The message mentions the clamped limit (1000)
    expect(result.message).toContain('1000')
  })

  it('defaults limit to 100', async () => {
    const result = await executeScan(validParams)
    expect(result.message).toContain('100')
  })

  it('rejects empty viewing key', async () => {
    await expect(executeScan({ ...validParams, viewingKey: '' })).rejects.toThrow(
      'Viewing key is required'
    )
  })

  it('rejects empty spending pubkey', async () => {
    await expect(executeScan({ ...validParams, spendingPubkey: '' })).rejects.toThrow(
      'Spending public key is required'
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Claim tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeClaim', () => {
  const validParams = {
    txSignature: 'sig123abc456def',
    viewingKey: 'vk999',
    spendingKey: 'sk888',
  }

  it('returns correct result shape', async () => {
    const result = await executeClaim(validParams)
    expect(result.action).toBe('claim')
    expect(result.txSignature).toBe('sig123abc456def')
    expect(result.status).toBe('awaiting_signature')
    expect(result.details.stealthKeyDerived).toBe(true)
    expect(result.details.destinationWallet).toBeNull()
  })

  it('includes destination wallet when provided', async () => {
    const result = await executeClaim({
      ...validParams,
      destinationWallet: 'DestWallet',
    })
    expect(result.details.destinationWallet).toBe('DestWallet')
  })

  it('message contains truncated signature', async () => {
    const result = await executeClaim(validParams)
    expect(result.message).toContain('sig123abc456')
  })

  it('rejects empty tx signature', async () => {
    await expect(
      executeClaim({ ...validParams, txSignature: '' })
    ).rejects.toThrow('Transaction signature is required')
  })

  it('rejects empty viewing key', async () => {
    await expect(
      executeClaim({ ...validParams, viewingKey: '' })
    ).rejects.toThrow('Viewing key is required')
  })

  it('rejects empty spending key', async () => {
    await expect(
      executeClaim({ ...validParams, spendingKey: '' })
    ).rejects.toThrow('Spending key is required')
  })
})
