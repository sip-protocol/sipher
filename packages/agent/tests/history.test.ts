import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { executeHistory } from '../src/tools/history.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const VALID_WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const VALID_WALLET_B = 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB'
const WSOL_MINT_STR = 'So11111111111111111111111111111111111111112'
const USDC_MINT_STR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const FAKE_SIG = '5WJvP7YxD3Bz9nKQ8RUqX2yNsj4oZ3Jk6TfL1cMvN8pHgAx4VeF7Gc2KRWZ'

// ─────────────────────────────────────────────────────────────────────────────
// Build synthetic Anchor event data for testing
// ─────────────────────────────────────────────────────────────────────────────

/** Build a base64-encoded "Program data: " deposit/refund event (88 bytes) */
function buildDepositEventBase64(
  depositor: string,
  tokenMint: string,
  amountLamports: bigint,
  timestamp: number
): string {
  const buf = Buffer.alloc(88)
  let offset = 0

  // Discriminator (8 bytes, arbitrary for test)
  buf.fill(0xAA, offset, offset + 8)
  offset += 8

  // Depositor pubkey (32 bytes)
  new PublicKey(depositor).toBuffer().copy(buf, offset)
  offset += 32

  // Token mint (32 bytes)
  new PublicKey(tokenMint).toBuffer().copy(buf, offset)
  offset += 32

  // Amount (u64 LE)
  buf.writeBigUInt64LE(amountLamports, offset)
  offset += 8

  // Timestamp (i64 LE)
  buf.writeBigInt64LE(BigInt(timestamp), offset)

  return buf.toString('base64')
}

/** Build a base64-encoded withdraw event (194 bytes) */
function buildWithdrawEventBase64(
  depositor: string,
  amountLamports: bigint,
  feeLamports: bigint,
  timestamp: number
): string {
  const buf = Buffer.alloc(194)
  let offset = 0

  // Discriminator (8 bytes)
  buf.fill(0xBB, offset, offset + 8)
  offset += 8

  // Depositor (32 bytes)
  new PublicKey(depositor).toBuffer().copy(buf, offset)
  offset += 32

  // Stealth recipient (32 bytes) — dummy
  buf.fill(0x01, offset, offset + 32)
  offset += 32

  // Amount commitment (33 bytes) — dummy
  buf.fill(0x02, offset, offset + 33)
  offset += 33

  // Ephemeral pubkey (33 bytes) — dummy
  buf.fill(0x03, offset, offset + 33)
  offset += 33

  // Viewing key hash (32 bytes) — dummy
  buf.fill(0x04, offset, offset + 32)
  offset += 32

  // Transfer amount (u64 LE)
  buf.writeBigUInt64LE(amountLamports, offset)
  offset += 8

  // Fee amount (u64 LE)
  buf.writeBigUInt64LE(feeLamports, offset)
  offset += 8

  // Timestamp (i64 LE)
  buf.writeBigInt64LE(BigInt(timestamp), offset)

  return buf.toString('base64')
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock @sipher/sdk — intercept getVaultHistory to avoid real RPC calls,
// but keep parseVaultEvents real for unit testing the parser directly.
// ─────────────────────────────────────────────────────────────────────────────

const mockGetVaultHistory = vi.fn()

vi.mock('@sipher/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sipher/sdk')>()
  return {
    ...actual,
    createConnection: vi.fn().mockReturnValue({}),
    getVaultHistory: (...args: unknown[]) => mockGetVaultHistory(...args),
  }
})

// Import the real parseVaultEvents after mock setup — vitest resolves
// the mock via importOriginal spread, so the real function is still
// accessible on the mocked module since we spread `...actual`.
const { parseVaultEvents: realParseVaultEvents } = await import('@sipher/sdk')

beforeEach(() => {
  mockGetVaultHistory.mockReset()
  mockGetVaultHistory.mockResolvedValue({ events: [], hasMore: false })
})

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

describe('executeHistory — input validation', () => {
  it('rejects empty wallet', async () => {
    await expect(executeHistory({ wallet: '' })).rejects.toThrow(
      'Wallet address is required'
    )
  })

  it('rejects whitespace-only wallet', async () => {
    await expect(executeHistory({ wallet: '   ' })).rejects.toThrow(
      'Wallet address is required'
    )
  })

  it('rejects invalid base58 wallet', async () => {
    await expect(executeHistory({ wallet: 'not-a-pubkey' })).rejects.toThrow(
      'Invalid wallet address'
    )
  })

  it('rejects garbage string', async () => {
    await expect(executeHistory({ wallet: '!!!' })).rejects.toThrow(
      'Invalid wallet address'
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Empty / new wallet
// ─────────────────────────────────────────────────────────────────────────────

describe('executeHistory — new wallet (no activity)', () => {
  it('returns empty transactions array', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.action).toBe('history')
    expect(result.status).toBe('success')
    expect(result.wallet).toBe(VALID_WALLET)
    expect(result.transactions).toEqual([])
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('message mentions deposit prompt for empty history', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.message).toContain('No vault transactions found')
    expect(result.message).toContain('Deposit first')
  })

  it('includes truncated wallet in message', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.message).toContain(VALID_WALLET.slice(0, 8))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Limit clamping
// ─────────────────────────────────────────────────────────────────────────────

describe('executeHistory — limit clamping', () => {
  it('clamps limit above 100 without error', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET, limit: 500 })
    expect(result.status).toBe('success')
    // Should have called getVaultHistory with clamped limit
    expect(mockGetVaultHistory).toHaveBeenCalledWith(
      expect.anything(),
      VALID_WALLET,
      expect.objectContaining({ limit: 100 })
    )
  })

  it('clamps limit below 1 without error', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET, limit: -5 })
    expect(result.status).toBe('success')
    expect(mockGetVaultHistory).toHaveBeenCalledWith(
      expect.anything(),
      VALID_WALLET,
      expect.objectContaining({ limit: 1 })
    )
  })

  it('defaults to 20 when not specified', async () => {
    await executeHistory({ wallet: VALID_WALLET })
    expect(mockGetVaultHistory).toHaveBeenCalledWith(
      expect.anything(),
      VALID_WALLET,
      expect.objectContaining({ limit: 20 })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Token filter
// ─────────────────────────────────────────────────────────────────────────────

describe('executeHistory — token filter', () => {
  it('uppercases token in result', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET, token: 'usdc' })
    expect(result.token).toBe('USDC')
  })

  it('passes resolved mint to getVaultHistory', async () => {
    await executeHistory({ wallet: VALID_WALLET, token: 'SOL' })
    expect(mockGetVaultHistory).toHaveBeenCalledWith(
      expect.anything(),
      VALID_WALLET,
      expect.objectContaining({ tokenMint: WSOL_MINT_STR })
    )
  })

  it('passes USDC mint when filtering by USDC', async () => {
    await executeHistory({ wallet: VALID_WALLET, token: 'USDC' })
    expect(mockGetVaultHistory).toHaveBeenCalledWith(
      expect.anything(),
      VALID_WALLET,
      expect.objectContaining({ tokenMint: USDC_MINT_STR })
    )
  })

  it('includes token name in empty-history message', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET, token: 'usdt' })
    expect(result.message).toContain('USDT')
  })

  it('null when no token filter provided', async () => {
    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.token).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Result mapping from VaultEvent
// ─────────────────────────────────────────────────────────────────────────────

describe('executeHistory — event data mapping', () => {
  it('maps VaultEvent fields to HistoryTransaction', async () => {
    mockGetVaultHistory.mockResolvedValueOnce({
      events: [
        {
          type: 'deposit',
          wallet: VALID_WALLET,
          amount: '1.5',
          token: 'SOL',
          tokenMint: WSOL_MINT_STR,
          timestamp: 1712000000,
          txSignature: FAKE_SIG,
        },
      ],
      hasMore: false,
    })

    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.transactions).toHaveLength(1)

    const tx = result.transactions[0]
    expect(tx.type).toBe('deposit')
    expect(tx.amount).toBe('1.5')
    expect(tx.token).toBe('SOL')
    expect(tx.tokenMint).toBe(WSOL_MINT_STR)
    expect(tx.timestamp).toBe(1712000000)
    expect(tx.txSignature).toBe(FAKE_SIG)
  })

  it('maps send events correctly', async () => {
    mockGetVaultHistory.mockResolvedValueOnce({
      events: [
        {
          type: 'send',
          wallet: VALID_WALLET,
          amount: '0.5',
          token: 'SOL',
          tokenMint: WSOL_MINT_STR,
          timestamp: 1712001000,
          txSignature: FAKE_SIG,
        },
      ],
      hasMore: false,
    })

    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.transactions[0].type).toBe('send')
  })

  it('reports hasMore from SDK result', async () => {
    mockGetVaultHistory.mockResolvedValueOnce({
      events: [
        {
          type: 'deposit',
          wallet: VALID_WALLET,
          amount: '2',
          token: 'SOL',
          tokenMint: WSOL_MINT_STR,
          timestamp: 1712000000,
          txSignature: FAKE_SIG,
        },
      ],
      hasMore: true,
    })

    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.hasMore).toBe(true)
    expect(result.message).toContain('More transactions available')
  })

  it('total matches transactions length', async () => {
    mockGetVaultHistory.mockResolvedValueOnce({
      events: [
        { type: 'deposit', wallet: VALID_WALLET, amount: '1', token: 'SOL', tokenMint: WSOL_MINT_STR, timestamp: 1712000000, txSignature: 'sig1' },
        { type: 'send', wallet: VALID_WALLET, amount: '0.5', token: 'SOL', tokenMint: WSOL_MINT_STR, timestamp: 1712001000, txSignature: 'sig2' },
      ],
      hasMore: false,
    })

    const result = await executeHistory({ wallet: VALID_WALLET })
    expect(result.total).toBe(2)
    expect(result.transactions).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// parseVaultEvents — Direct unit tests on the SDK parser
// ─────────────────────────────────────────────────────────────────────────────

describe('parseVaultEvents (real SDK parser)', () => {
  it('parses deposit event from "Program data:" log', () => {
    const depositB64 = buildDepositEventBase64(
      VALID_WALLET,
      WSOL_MINT_STR,
      1_500_000_000n, // 1.5 SOL
      1712000000
    )
    const logs = [`Program data: ${depositB64}`]

    const events = realParseVaultEvents(logs, FAKE_SIG, 1712000000)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('deposit')
    expect(events[0].wallet).toBe(VALID_WALLET)
    expect(events[0].amount).toBe('1.5')
    expect(events[0].token).toBe('SOL')
    expect(events[0].tokenMint).toBe(WSOL_MINT_STR)
    expect(events[0].timestamp).toBe(1712000000)
    expect(events[0].txSignature).toBe(FAKE_SIG)
  })

  it('parses withdraw event as type "send"', () => {
    const withdrawB64 = buildWithdrawEventBase64(
      VALID_WALLET,
      2_000_000_000n, // 2 SOL
      2_000_000n,     // 0.002 SOL fee
      1712001000
    )
    const logs = [`Program data: ${withdrawB64}`]

    const events = realParseVaultEvents(logs, FAKE_SIG, 1712001000)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('send')
    expect(events[0].wallet).toBe(VALID_WALLET)
    expect(events[0].amount).toBe('2')
    expect(events[0].timestamp).toBe(1712001000)
  })

  it('parses USDC deposit event with 6 decimals', () => {
    const depositB64 = buildDepositEventBase64(
      VALID_WALLET,
      USDC_MINT_STR,
      50_000_000n, // 50 USDC
      1712002000
    )
    const logs = [`Program data: ${depositB64}`]

    const events = realParseVaultEvents(logs, FAKE_SIG, 1712002000)
    expect(events).toHaveLength(1)
    expect(events[0].amount).toBe('50')
    expect(events[0].token).toBe('USDC')
    expect(events[0].tokenMint).toBe(USDC_MINT_STR)
  })

  it('ignores non-"Program data:" log lines', () => {
    const logs = [
      'Program log: some random log',
      'Program invoke: something',
      `Program data: ${buildDepositEventBase64(VALID_WALLET, WSOL_MINT_STR, 1_000_000_000n, 1712000000)}`,
    ]

    const events = realParseVaultEvents(logs, FAKE_SIG, 1712000000)
    expect(events).toHaveLength(1)
  })

  it('skips events with data smaller than deposit minimum', () => {
    // 40 bytes — too small for any vault event
    const tiny = Buffer.alloc(40).toString('base64')
    const logs = [`Program data: ${tiny}`]

    const events = realParseVaultEvents(logs, FAKE_SIG, 1712000000)
    expect(events).toHaveLength(0)
  })

  it('skips malformed base64', () => {
    const logs = ['Program data: !!!not-base64!!!']
    const events = realParseVaultEvents(logs, FAKE_SIG, 1712000000)
    expect(events).toHaveLength(0)
  })

  it('handles empty log array', () => {
    const events = realParseVaultEvents([], FAKE_SIG, 1712000000)
    expect(events).toHaveLength(0)
  })

  it('uses fallback timestamp when event timestamp is zero', () => {
    const depositB64 = buildDepositEventBase64(
      VALID_WALLET,
      WSOL_MINT_STR,
      1_000_000_000n,
      0 // zero timestamp in event
    )
    const logs = [`Program data: ${depositB64}`]

    const events = realParseVaultEvents(logs, FAKE_SIG, 1712005000)
    expect(events).toHaveLength(1)
    expect(events[0].timestamp).toBe(1712005000)
  })

  it('uses zero when both event timestamp and blockTime are null', () => {
    const depositB64 = buildDepositEventBase64(
      VALID_WALLET,
      WSOL_MINT_STR,
      1_000_000_000n,
      0
    )
    const logs = [`Program data: ${depositB64}`]

    const events = realParseVaultEvents(logs, FAKE_SIG, null)
    expect(events).toHaveLength(1)
    expect(events[0].timestamp).toBe(0)
  })

  it('parses multiple events from single transaction', () => {
    const deposit1 = buildDepositEventBase64(VALID_WALLET, WSOL_MINT_STR, 1_000_000_000n, 1712000000)
    const deposit2 = buildDepositEventBase64(VALID_WALLET_B, USDC_MINT_STR, 100_000_000n, 1712000001)
    const logs = [
      'Program log: Instruction: Deposit',
      `Program data: ${deposit1}`,
      'Program log: Instruction: Deposit',
      `Program data: ${deposit2}`,
    ]

    const events = realParseVaultEvents(logs, FAKE_SIG, 1712000000)
    expect(events).toHaveLength(2)
    expect(events[0].wallet).toBe(VALID_WALLET)
    expect(events[1].wallet).toBe(VALID_WALLET_B)
  })

  it('resolves unknown mint to first 8 chars', () => {
    const unknownMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    const depositB64 = buildDepositEventBase64(
      VALID_WALLET,
      unknownMint,
      1_000_000_000n,
      1712000000
    )
    const logs = [`Program data: ${depositB64}`]

    const events = realParseVaultEvents(logs, FAKE_SIG, 1712000000)
    expect(events).toHaveLength(1)
    expect(events[0].token).toBe('DezXAZ8z')
    expect(events[0].tokenMint).toBe(unknownMint)
  })
})
