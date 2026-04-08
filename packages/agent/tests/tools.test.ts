import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  swapTool,
  executeSwap,
  viewingKeyTool,
  executeViewingKey,
  historyTool,
  executeHistory,
  statusTool,
  executeStatus,
  paymentLinkTool,
  executePaymentLink,
  invoiceTool,
  executeInvoice,
  privacyScoreTool,
  executePrivacyScore,
  threatCheckTool,
  executeThreatCheck,
} from '../src/tools/index.js'
import { TOOLS, SYSTEM_PROMPT, executeTool } from '../src/agent.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures — valid Solana addresses
// ─────────────────────────────────────────────────────────────────────────────

/** A valid on-curve wallet address (devnet test wallet) */
const VALID_WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
/** A valid spending private key (32 bytes = 64 hex chars) */
const VALID_SPENDING_KEY = 'cd'.repeat(32)
/** A valid hex viewing key (32 bytes = 64 hex chars) */
const VALID_VIEWING_KEY = 'ab'.repeat(32)

// ─────────────────────────────────────────────────────────────────────────────
// Mock fetch globally — Jupiter API calls in swap tool go through native fetch
// ─────────────────────────────────────────────────────────────────────────────

vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
  // Jupiter quote endpoint (GET)
  if (typeof url === 'string' && url.includes('/quote')) {
    return {
      ok: true,
      json: async () => ({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inAmount: '2000000000',
        outAmount: '300000000',
        otherAmountThreshold: '297000000',
        swapMode: 'ExactIn',
        slippageBps: 50,
        priceImpactPct: '0.01',
        routePlan: [{ swapInfo: { ammKey: 'test', label: 'Raydium', inputMint: '', outputMint: '', inAmount: '0', outAmount: '0', feeAmount: '0', feeMint: '' }, percent: 100 }],
      }),
    }
  }
  // Jupiter swap endpoint (POST)
  if (opts?.method === 'POST') {
    return {
      ok: true,
      json: async () => ({
        swapTransaction: 'AQAAAA==',
        lastValidBlockHeight: 200,
        prioritizationFeeLamports: 5000,
        computeUnitLimit: 200000,
      }),
    }
  }
  return { ok: false, status: 404, text: async () => 'Not found' }
}))

// ─────────────────────────────────────────────────────────────────────────────
// Mock @solana/web3.js Connection to prevent real RPC calls in unit tests
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@sipher/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sipher/sdk')>()

  // Return a mock createConnection that produces a mock Connection
  const mockConnection = {
    getAccountInfo: vi.fn().mockResolvedValue(null),
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 100,
    }),
    getSignaturesForAddress: vi.fn().mockResolvedValue([]),
    getParsedTransactions: vi.fn().mockResolvedValue([]),
    getParsedTransaction: vi.fn().mockResolvedValue(null),
  }

  return {
    ...actual,
    createConnection: vi.fn().mockReturnValue(mockConnection),
    getVaultHistory: vi.fn().mockResolvedValue({ events: [], hasMore: false }),
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Tool definition validation
// ─────────────────────────────────────────────────────────────────────────────

describe('tool definitions', () => {
  const allTools = [
    depositTool, sendTool, refundTool, balanceTool, scanTool, claimTool,
    swapTool, viewingKeyTool, historyTool, statusTool,
    paymentLinkTool, invoiceTool, privacyScoreTool, threatCheckTool,
  ]
  const toolNames = [
    'deposit', 'send', 'refund', 'balance', 'scan', 'claim',
    'swap', 'viewingKey', 'history', 'status',
    'paymentLink', 'invoice', 'privacyScore', 'threatCheck',
  ]

  it('exports exactly 14 tools', () => {
    expect(allTools).toHaveLength(14)
    expect(TOOLS).toHaveLength(14)
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

  it('references all 14 tools', () => {
    expect(SYSTEM_PROMPT).toContain('deposit')
    expect(SYSTEM_PROMPT).toContain('send')
    expect(SYSTEM_PROMPT).toContain('refund')
    expect(SYSTEM_PROMPT).toContain('balance')
    expect(SYSTEM_PROMPT).toContain('scan')
    expect(SYSTEM_PROMPT).toContain('claim')
    expect(SYSTEM_PROMPT).toContain('swap')
    expect(SYSTEM_PROMPT).toContain('viewingKey')
    expect(SYSTEM_PROMPT).toContain('history')
    expect(SYSTEM_PROMPT).toContain('status')
    expect(SYSTEM_PROMPT).toContain('paymentLink')
    expect(SYSTEM_PROMPT).toContain('invoice')
    expect(SYSTEM_PROMPT).toContain('privacyScore')
    expect(SYSTEM_PROMPT).toContain('threatCheck')
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
      recipient: VALID_SPENDING_KEY,
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
      wallet: VALID_WALLET,
    })
    expect(result).toHaveProperty('action', 'balance')
  })

  it('dispatches to scan', async () => {
    const result = await executeTool('scan', {
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
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

  it('dispatches to swap', async () => {
    const result = await executeTool('swap', {
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
    })
    expect(result).toHaveProperty('action', 'swap')
  })

  it('dispatches to viewingKey', async () => {
    const result = await executeTool('viewingKey', { action: 'generate' })
    expect(result).toHaveProperty('action', 'viewingKey')
  })

  it('dispatches to history', async () => {
    const result = await executeTool('history', { wallet: VALID_WALLET })
    expect(result).toHaveProperty('action', 'history')
  })

  it('dispatches to status', async () => {
    const result = await executeTool('status', {})
    expect(result).toHaveProperty('action', 'status')
  })

  it('throws for unknown tool', async () => {
    await expect(executeTool('nonexistent', {})).rejects.toThrow('Unknown tool: nonexistent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Deposit tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeDeposit', () => {
  it('returns correct result shape (no wallet)', async () => {
    const result = await executeDeposit({ amount: 5, token: 'SOL' })
    expect(result.action).toBe('deposit')
    expect(result.amount).toBe(5)
    expect(result.token).toBe('SOL')
    expect(result.status).toBe('awaiting_signature')
    expect(result.wallet).toBeNull()
    expect(result.serializedTx).toBeNull()
    expect(result.message).toContain('5')
    expect(result.message).toContain('SOL')
    expect(result.details.vaultProgram).toBe('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
  })

  it('normalizes token to uppercase', async () => {
    const result = await executeDeposit({ amount: 1, token: 'usdc' })
    expect(result.token).toBe('USDC')
  })

  it('builds serialized tx when wallet is a valid pubkey', async () => {
    const result = await executeDeposit({
      amount: 1,
      token: 'SOL',
      wallet: VALID_WALLET,
    })
    expect(result.wallet).toBe(VALID_WALLET)
    expect(result.serializedTx).toBeTruthy()
    expect(typeof result.serializedTx).toBe('string')
    expect(result.details.depositRecordAddress).toBeTruthy()
    expect(result.details.vaultTokenAddress).toBeTruthy()
    expect(result.details.amountBaseUnits).toBe('1000000000')
  })

  it('rejects invalid wallet address', async () => {
    await expect(
      executeDeposit({ amount: 1, token: 'SOL', wallet: 'not-a-pubkey' })
    ).rejects.toThrow('Invalid wallet address')
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
  const validParams = { amount: 10, token: 'USDC', recipient: VALID_SPENDING_KEY }

  it('returns correct result shape (no wallet)', async () => {
    const result = await executeSend(validParams)
    expect(result.action).toBe('send')
    expect(result.amount).toBe(10)
    expect(result.token).toBe('USDC')
    expect(result.recipient).toBe(VALID_SPENDING_KEY)
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBeNull()
    expect(result.privacy.commitmentGenerated).toBe(true)
    expect(result.privacy.viewingKeyHashIncluded).toBe(true)
    expect(result.privacy.feeBps).toBeGreaterThanOrEqual(0)
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
  it('returns correct result shape (no wallet)', async () => {
    const result = await executeRefund({ token: 'SOL' })
    expect(result.action).toBe('refund')
    expect(result.token).toBe('SOL')
    expect(result.status).toBe('awaiting_signature')
    expect(result.wallet).toBeNull()
    expect(result.serializedTx).toBeNull()
    expect(result.details.refundTimeout).toContain('24 hours')
  })

  it('normalizes token to uppercase', async () => {
    const result = await executeRefund({ token: 'usdt' })
    expect(result.token).toBe('USDT')
  })

  it('returns null serializedTx when wallet has no deposit record', async () => {
    // Mock returns null for getAccountInfo, so buildRefundTx will throw
    // "No deposit record found" — the refund tool catches this via the
    // no-wallet path. When wallet IS provided, it hits the RPC which
    // returns null => throws from SDK.
    const result = await executeRefund({ token: 'SOL' })
    expect(result.serializedTx).toBeNull()
  })

  it('rejects empty token', async () => {
    await expect(executeRefund({ token: '' })).rejects.toThrow('Token symbol is required')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Balance tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeBalance', () => {
  it('returns correct result shape (no deposit)', async () => {
    const result = await executeBalance({ token: 'SOL', wallet: VALID_WALLET })
    expect(result.action).toBe('balance')
    expect(result.token).toBe('SOL')
    expect(result.wallet).toBe(VALID_WALLET)
    expect(result.status).toBe('success')
    expect(result.balance.total).toBe('0')
    expect(result.balance.available).toBe('0')
    expect(result.balance.locked).toBe('0')
    expect(result.balance.exists).toBe(false)
  })

  it('normalizes token to uppercase', async () => {
    const result = await executeBalance({ token: 'sol', wallet: VALID_WALLET })
    expect(result.token).toBe('SOL')
  })

  it('rejects empty token', async () => {
    await expect(
      executeBalance({ token: '', wallet: VALID_WALLET })
    ).rejects.toThrow('Token symbol is required')
  })

  it('rejects empty wallet', async () => {
    await expect(
      executeBalance({ token: 'SOL', wallet: '' })
    ).rejects.toThrow('Wallet address is required')
  })

  it('rejects invalid wallet address', async () => {
    await expect(
      executeBalance({ token: 'SOL', wallet: 'not-valid' })
    ).rejects.toThrow('Invalid wallet address')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Scan tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeScan', () => {
  const validParams = {
    viewingKey: VALID_VIEWING_KEY,
    spendingKey: VALID_SPENDING_KEY,
  }

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
    // Scan returns 0 events (mocked), message mentions scanned count
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

  it('rejects empty spending key', async () => {
    await expect(executeScan({ ...validParams, spendingKey: '' })).rejects.toThrow(
      'Spending private key is required'
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
    expect(result.serializedTx).toBeNull()
  })

  it('includes destination wallet when provided', async () => {
    const result = await executeClaim({
      ...validParams,
      destinationWallet: VALID_WALLET,
    })
    expect(result.details.destinationWallet).toBe(VALID_WALLET)
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

// ─────────────────────────────────────────────────────────────────────────────
// Swap tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeSwap', () => {
  const validParams = { amount: 2, fromToken: 'SOL', toToken: 'USDC' }

  it('returns correct result shape (preview)', async () => {
    const result = await executeSwap(validParams)
    expect(result.action).toBe('swap')
    expect(result.amount).toBe(2)
    expect(result.fromToken).toBe('SOL')
    expect(result.toToken).toBe('USDC')
    expect(result.status).toBe('preview')
    expect(result.serializedTx).toBeNull()
    expect(result.recipient).toBeNull()
    expect(result.quote.estimatedOutput).toBeTruthy()
    expect(result.privacy.stealthRouted).toBe(false)
  })

  it('normalizes tokens to uppercase', async () => {
    const result = await executeSwap({ amount: 1, fromToken: 'sol', toToken: 'usdc' })
    expect(result.fromToken).toBe('SOL')
    expect(result.toToken).toBe('USDC')
  })

  it('defaults slippage to 50 bps', async () => {
    const result = await executeSwap(validParams)
    expect(result.slippageBps).toBe(50)
  })

  it('accepts custom slippage', async () => {
    const result = await executeSwap({ ...validParams, slippageBps: 100 })
    expect(result.slippageBps).toBe(100)
  })

  it('clamps slippage to valid range', async () => {
    const low = await executeSwap({ ...validParams, slippageBps: 0 })
    expect(low.slippageBps).toBe(1)

    const high = await executeSwap({ ...validParams, slippageBps: 5000 })
    expect(high.slippageBps).toBe(1000)
  })

  it('includes recipient when provided', async () => {
    const result = await executeSwap({ ...validParams, recipient: VALID_WALLET })
    expect(result.recipient).toBe(VALID_WALLET)
  })

  it('rejects zero amount', async () => {
    await expect(executeSwap({ ...validParams, amount: 0 })).rejects.toThrow(
      'Swap amount must be greater than zero'
    )
  })

  it('rejects negative amount', async () => {
    await expect(executeSwap({ ...validParams, amount: -1 })).rejects.toThrow(
      'Swap amount must be greater than zero'
    )
  })

  it('rejects empty fromToken', async () => {
    await expect(executeSwap({ ...validParams, fromToken: '' })).rejects.toThrow(
      'Source token (fromToken) is required'
    )
  })

  it('rejects empty toToken', async () => {
    await expect(executeSwap({ ...validParams, toToken: '' })).rejects.toThrow(
      'Destination token (toToken) is required'
    )
  })

  it('rejects same fromToken and toToken', async () => {
    await expect(executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'sol' })).rejects.toThrow(
      'Source and destination tokens must be different'
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Viewing Key tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeViewingKey', () => {
  it('generate: returns downloadable blob with real key data', async () => {
    const result = await executeViewingKey({ action: 'generate' })
    expect(result.action).toBe('viewingKey')
    expect(result.keyAction).toBe('generate')
    expect(result.status).toBe('success')
    expect(result.hasDownload).toBe(true)
    expect(result.downloadData).not.toBeNull()
    expect(result.downloadData!.filename).toBe('sip-viewing-key.json')
    expect(result.details.txSignature).toBeNull()
    expect(result.details.viewingKeyHash).toBeTruthy()
    expect(result.details.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(result.message).toContain('Download')
    expect(result.message).toContain('NOT be shown in chat')
  })

  it('generate: blob is valid JSON with key, path, hash fields', async () => {
    const result = await executeViewingKey({ action: 'generate' })
    const json = JSON.parse(Buffer.from(result.downloadData!.blob, 'base64').toString('utf-8'))
    expect(json).toHaveProperty('key')
    expect(json).toHaveProperty('path')
    expect(json).toHaveProperty('hash')
    expect(json.key).toMatch(/^0x[0-9a-f]{64}$/)
    expect(json.hash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(json.path).toBe('m/0')
  })

  it('export: returns transaction-scoped key', async () => {
    const result = await executeViewingKey({ action: 'export', txSignature: 'sig_export_123abc' })
    expect(result.keyAction).toBe('export')
    expect(result.hasDownload).toBe(true)
    expect(result.downloadData).not.toBeNull()
    expect(result.downloadData!.filename).toContain('sig_expo')
    expect(result.details.txSignature).toBe('sig_export_123abc')
    expect(result.details.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(result.message).toContain('sig_export_1')

    // Verify the blob contains a derived key with tx path
    const json = JSON.parse(Buffer.from(result.downloadData!.blob, 'base64').toString('utf-8'))
    expect(json.path).toContain('tx/sig_export_123abc')
  })

  it('verify: rejects when TX not found', async () => {
    await expect(
      executeViewingKey({
        action: 'verify',
        txSignature: 'sig_verify_456def',
        viewingKeyHex: VALID_VIEWING_KEY,
      })
    ).rejects.toThrow('Transaction not found: sig_verify_456def')
  })

  it('rejects export without txSignature', async () => {
    await expect(executeViewingKey({ action: 'export' })).rejects.toThrow(
      "Transaction signature is required for 'export' action"
    )
  })

  it('rejects verify without txSignature', async () => {
    await expect(
      executeViewingKey({ action: 'verify', viewingKeyHex: VALID_VIEWING_KEY })
    ).rejects.toThrow(
      "Transaction signature is required for 'verify' action"
    )
  })

  it('rejects verify without viewingKeyHex', async () => {
    await expect(
      executeViewingKey({ action: 'verify', txSignature: 'sig_123' })
    ).rejects.toThrow(
      "Viewing key hex is required for 'verify' action"
    )
  })

  it('rejects invalid action', async () => {
    await expect(
      executeViewingKey({ action: 'invalid' as 'generate' })
    ).rejects.toThrow('Action must be one of: generate, export, verify')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// History tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeHistory', () => {
  it('returns correct result shape (empty history)', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.action).toBe('history')
    expect(result.wallet).toBe(VALID_WALLET)
    expect(result.token).toBeNull()
    expect(result.status).toBe('success')
    expect(result.transactions).toEqual([])
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('includes token filter when provided', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET, token: 'usdc' })
    expect(result.token).toBe('USDC')
    expect(result.message).toContain('USDC')
  })

  it('message contains truncated wallet address', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.message).toContain(VALID_WALLET.slice(0, 8))
  })

  it('rejects empty wallet', async () => {
    await expect(executeHistory({ wallet: '' })).rejects.toThrow(
      'Wallet address is required'
    )
  })

  it('rejects invalid wallet address', async () => {
    await expect(executeHistory({ wallet: 'not-a-pubkey' })).rejects.toThrow(
      'Invalid wallet address'
    )
  })

  it('clamps limit to valid range', async () => {
    // We can't directly assert the internal limit, but we verify no error
    const result = await executeHistory({ wallet: VALID_WALLET, limit: 500 })
    expect(result.status).toBe('success')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Status tool
// ─────────────────────────────────────────────────────────────────────────────

describe('executeStatus', () => {
  it('returns correct result shape (config not found)', async () => {
    // Mock returns null for getAccountInfo => getVaultConfig returns null
    const result = await executeStatus()
    expect(result.action).toBe('status')
    expect(result.status).toBe('success')
    expect(result.vault.programId).toBe('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
    expect(result.vault.configFound).toBe(false)
    expect(result.vault.feeBps).toBe(10)
    expect(result.vault.refundTimeout).toBe(86400)
    expect(result.vault.paused).toBe(false)
    expect(result.vault.totalDeposits).toBe(0)
    expect(result.vault.totalDepositors).toBe(0)
    expect(result.vault.authority).toBeNull()
  })

  it('message indicates config not found', async () => {
    const result = await executeStatus()
    expect(result.message).toContain('not found')
    expect(result.message).toContain('default')
  })

  it('returns default fee as percentage string', async () => {
    const result = await executeStatus()
    expect(result.vault.feePercent).toBe('0.1%')
  })

  it('returns human-readable refund timeout', async () => {
    const result = await executeStatus()
    expect(result.vault.refundTimeoutHuman).toBe('24 hours')
  })
})
