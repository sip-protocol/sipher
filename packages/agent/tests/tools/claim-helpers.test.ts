import { Buffer } from 'node:buffer'
import { describe, it, expect, vi } from 'vitest'
import { Keypair, PublicKey, type Connection } from '@solana/web3.js'
import { WSOL_MINT, USDC_MINT, USDT_MINT } from '@sipher/sdk'
import {
  deriveDestinationFromSpending,
  formatClaimAmount,
  resolveStealthContext,
  StealthContextError,
} from '../../src/tools/claim-helpers.js'

const DEPOSIT_SIG =
  '4Hc3vQBhYzS5xQZK1RtwvkLqxg1JhWf5pSr6vKQYVbTtFNxRr5jJp2k4QvJqwn3aB6XzMpYsLqHv2QwRcVbN8mY5s5c'
const STEALTH_PUBKEY = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const EPHEMERAL_PUBKEY = 'GqvBwYTWWZRyDQ4ZeNvFLgfbA8wYjBvE6cKxFQXjHvSr'
const STEALTH_ATA = 'AfPXfQs5MNJyEnUYvxRJ6BHwQNyKqJVE9Y3CDbHwfXVc'
const MINT_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

/**
 * Build a synthetic VaultWithdrawEvent buffer matching the on-chain layout
 * documented at packages/sdk/src/privacy.ts:401-411. Total 194 bytes (minimum).
 */
function buildWithdrawEventBytes(opts: {
  stealthBs58?: string
  ephemeralBs58?: string
  zeroEphemeral?: boolean
}): Buffer {
  const buf = Buffer.alloc(194)
  // [0, 8)  — Anchor event discriminator (arbitrary bytes; sipher doesn't validate)
  buf.write('0011223344556677', 0, 'hex')
  // [8, 40) — depositor (zeros, not used by resolver)
  // [40, 72) — stealth_recipient
  const stealth = new PublicKey(opts.stealthBs58 ?? STEALTH_PUBKEY).toBytes()
  Buffer.from(stealth).copy(buf, 40)
  // [72, 105) — amount_commitment (zeros)
  // [105, 138) — ephemeral_pubkey: 0x00 prefix + 32-byte ed25519 (per privacy.ts:339-341)
  buf[105] = 0x00
  if (opts.zeroEphemeral) {
    // intentionally leave [106..138] as zeros — should be skipped by resolver
  } else {
    const eph = new PublicKey(opts.ephemeralBs58 ?? EPHEMERAL_PUBKEY).toBytes()
    Buffer.from(eph).copy(buf, 106)
  }
  // [138, 170) — viewing_key_hash (zeros)
  // [170, 178) — transfer_amount (zeros)
  // [178, 186) — fee_amount (zeros)
  // [186, 194) — timestamp (zeros)
  return buf
}

function programDataLog(eventBytes: Buffer): string {
  return `Program data: ${eventBytes.toString('base64')}`
}

/**
 * Synthesize a parsed-tx response shape matching @solana/web3.js's
 * `ParsedTransactionWithMeta` for unit testing. Real responses contain
 * many more fields; the resolver only reads the keys touched below.
 */
function mockTxWithEventAndSplTransfer(opts: { tokenProgram?: 'spl-token' | 'spl-token-2022'; inner?: boolean } = {}) {
  const tokenProgram = opts.tokenProgram ?? 'spl-token'
  const splTokenIx = {
    program: tokenProgram,
    programId: new PublicKey(
      tokenProgram === 'spl-token-2022'
        ? 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    ),
    parsed: {
      type: 'transferChecked',
      info: {
        destination: STEALTH_ATA,
        mint: MINT_USDC,
        tokenAmount: { amount: '1000000', decimals: 6 },
      },
    },
  }
  return {
    transaction: {
      message: {
        instructions: opts.inner ? [] : [splTokenIx],
      },
    },
    meta: {
      err: null,
      logMessages: [
        'Program S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB invoke [1]',
        programDataLog(buildWithdrawEventBytes({})),
        'Program S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB success',
      ],
      innerInstructions: opts.inner ? [{ index: 0, instructions: [splTokenIx] }] : [],
    },
  }
}

describe('resolveStealthContext — happy path', () => {
  it('returns stealth address, ephemeral pubkey, and mint from a VaultWithdrawEvent log + top-level SPL transfer', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue(mockTxWithEventAndSplTransfer()),
      getParsedAccountInfo: vi.fn().mockResolvedValue({
        value: { data: { parsed: { info: { owner: STEALTH_PUBKEY, mint: MINT_USDC } } } },
      }),
    } as unknown as Connection

    const ctx = await resolveStealthContext(mockConnection, DEPOSIT_SIG)

    expect(ctx.stealthAddress).toBe(STEALTH_PUBKEY)
    expect(ctx.ephemeralPublicKey).toBe(EPHEMERAL_PUBKEY)
    expect(ctx.mint).toBe(MINT_USDC)
  })
})

describe('resolveStealthContext — happy-path variants', () => {
  it('handles spl-token-2022 transferChecked', async () => {
    const mockConnection = {
      getParsedTransaction: vi
        .fn()
        .mockResolvedValue(mockTxWithEventAndSplTransfer({ tokenProgram: 'spl-token-2022' })),
      getParsedAccountInfo: vi.fn().mockResolvedValue({
        value: { data: { parsed: { info: { owner: STEALTH_PUBKEY, mint: MINT_USDC } } } },
      }),
    } as unknown as Connection

    const ctx = await resolveStealthContext(mockConnection, DEPOSIT_SIG)
    expect(ctx.stealthAddress).toBe(STEALTH_PUBKEY)
    expect(ctx.mint).toBe(MINT_USDC)
  })

  it('finds SPL transferChecked in inner instructions (Jupiter-routed deposit)', async () => {
    const mockConnection = {
      getParsedTransaction: vi
        .fn()
        .mockResolvedValue(mockTxWithEventAndSplTransfer({ inner: true })),
      getParsedAccountInfo: vi.fn().mockResolvedValue({
        value: { data: { parsed: { info: { owner: STEALTH_PUBKEY, mint: MINT_USDC } } } },
      }),
    } as unknown as Connection

    const ctx = await resolveStealthContext(mockConnection, DEPOSIT_SIG)
    expect(ctx.stealthAddress).toBe(STEALTH_PUBKEY)
    expect(ctx.mint).toBe(MINT_USDC)
  })

  it('skips PartiallyDecodedInstruction entries when searching for SPL transferChecked', async () => {
    const splTokenIx = {
      program: 'spl-token',
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      parsed: {
        type: 'transferChecked',
        info: {
          destination: STEALTH_ATA,
          mint: MINT_USDC,
          tokenAmount: { amount: '1000000', decimals: 6 },
        },
      },
    }
    const partiallyDecoded = {
      programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
      accounts: [],
      data: 'AwBAQg8AAAAA',
      // No `program` or `parsed` field — PartiallyDecodedInstruction shape
    }
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: { message: { instructions: [partiallyDecoded, splTokenIx] } },
        meta: {
          err: null,
          logMessages: [programDataLog(buildWithdrawEventBytes({}))],
          innerInstructions: [],
        },
      }),
      getParsedAccountInfo: vi.fn().mockResolvedValue({
        value: { data: { parsed: { info: { owner: STEALTH_PUBKEY, mint: MINT_USDC } } } },
      }),
    } as unknown as Connection

    const ctx = await resolveStealthContext(mockConnection, DEPOSIT_SIG)
    expect(ctx.stealthAddress).toBe(STEALTH_PUBKEY)
    expect(ctx.mint).toBe(MINT_USDC)
    expect(ctx.ephemeralPublicKey).toBe(EPHEMERAL_PUBKEY)
  })
})

describe('resolveStealthContext — error paths', () => {
  it('throws deposit_not_found when getParsedTransaction returns null', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue(null),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG)).rejects.toMatchObject({
      name: 'StealthContextError',
      code: 'deposit_not_found',
    })
  })

  it('throws no_withdraw_event when logMessages has no decodable VaultWithdrawEvent', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: { message: { instructions: [] } },
        meta: {
          err: null,
          logMessages: [
            'Program 11111111111111111111111111111111 invoke [1]',
            'Program 11111111111111111111111111111111 success',
          ],
          innerInstructions: [],
        },
      }),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG)).rejects.toMatchObject({
      code: 'no_withdraw_event',
    })
  })

  it('also throws no_withdraw_event when Program data log is present but too short', async () => {
    const shortBuf = Buffer.alloc(64) // < 194-byte floor
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: { message: { instructions: [] } },
        meta: {
          err: null,
          logMessages: [programDataLog(shortBuf)],
          innerInstructions: [],
        },
      }),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG)).rejects.toMatchObject({
      code: 'no_withdraw_event',
    })
  })

  it('skips zero-filled placeholder events and throws no_withdraw_event if none decodable', async () => {
    const zeroEphBuf = buildWithdrawEventBytes({ zeroEphemeral: true })
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: { message: { instructions: [] } },
        meta: {
          err: null,
          logMessages: [programDataLog(zeroEphBuf)],
          innerInstructions: [],
        },
      }),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG)).rejects.toMatchObject({
      code: 'no_withdraw_event',
    })
  })

  it('throws no_token_transfer when event exists but no SPL transferChecked', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue({
        transaction: { message: { instructions: [] } },
        meta: {
          err: null,
          logMessages: [programDataLog(buildWithdrawEventBytes({}))],
          innerInstructions: [],
        },
      }),
      getParsedAccountInfo: vi.fn(),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG)).rejects.toMatchObject({
      code: 'no_token_transfer',
    })
  })

  it('throws stealth_ata_mismatch when ATA account info has no owner', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue(mockTxWithEventAndSplTransfer()),
      getParsedAccountInfo: vi.fn().mockResolvedValue({ value: null }),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG)).rejects.toMatchObject({
      code: 'stealth_ata_mismatch',
    })
  })

  it('throws stealth_ata_mismatch when ATA owner differs from event stealth_recipient', async () => {
    const DIFFERENT_OWNER = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue(mockTxWithEventAndSplTransfer()),
      getParsedAccountInfo: vi.fn().mockResolvedValue({
        value: { data: { parsed: { info: { owner: DIFFERENT_OWNER, mint: MINT_USDC } } } },
      }),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG)).rejects.toMatchObject({
      code: 'stealth_ata_mismatch',
    })
  })

  it('throws stealth_ata_mismatch when ATA data is raw bytes (not a parsed token account)', async () => {
    const mockConnection = {
      getParsedTransaction: vi.fn().mockResolvedValue(mockTxWithEventAndSplTransfer()),
      getParsedAccountInfo: vi.fn().mockResolvedValue({
        value: { data: Buffer.from([1, 2, 3, 4]) },
      }),
    } as unknown as Connection

    await expect(resolveStealthContext(mockConnection, DEPOSIT_SIG)).rejects.toMatchObject({
      code: 'stealth_ata_mismatch',
    })
  })
})

describe('deriveDestinationFromSpending', () => {
  it('derives the matching base58 ed25519 pubkey from a hex spending privkey', () => {
    const kp = Keypair.generate()
    // Solana keypairs are 64 bytes (32-byte seed + 32-byte pubkey); ed25519 takes the 32-byte seed.
    const seedHex = Buffer.from(kp.secretKey.slice(0, 32)).toString('hex')

    expect(deriveDestinationFromSpending(seedHex)).toBe(kp.publicKey.toBase58())
  })

  it('accepts hex with 0x prefix', () => {
    const kp = Keypair.generate()
    const seedHex = '0x' + Buffer.from(kp.secretKey.slice(0, 32)).toString('hex')

    expect(deriveDestinationFromSpending(seedHex)).toBe(kp.publicKey.toBase58())
  })

  it('throws on non-hex input', () => {
    expect(() => deriveDestinationFromSpending('this-is-not-hex')).toThrow(
      /spending key must be 32-byte hex/i,
    )
  })

  it('throws on wrong-length hex (not 32 bytes)', () => {
    expect(() => deriveDestinationFromSpending('ab'.repeat(16))).toThrow(
      /spending key must be 32-byte hex/i,
    )
  })
})

describe('formatClaimAmount', () => {
  // Freshly generated via `Keypair.generate().publicKey.toBase58()` — guaranteed valid base58.
  const SYNTHETIC = 'ApBEQDhQV5nqctbUw5Qr34FvJaiovrirkWZxWqwWE2Pw'

  it('formats SOL (9 decimals) with "SOL" symbol (not WSOL)', () => {
    expect(formatClaimAmount(1_500_000_000n, WSOL_MINT.toBase58())).toBe('1.5 SOL')
  })

  it('formats USDC (6 decimals) without trailing .0 for whole-number amounts', () => {
    expect(formatClaimAmount(1_000_000n, USDC_MINT.toBase58())).toBe('1 USDC')
  })

  it('formats USDT (6 decimals)', () => {
    expect(formatClaimAmount(2_500_000n, USDT_MINT.toBase58())).toBe('2.5 USDT')
  })

  it('formats unknown SPL mints with short prefix-suffix and default 9 decimals', () => {
    const prefix = SYNTHETIC.slice(0, 4)
    const suffix = SYNTHETIC.slice(-4)
    expect(formatClaimAmount(1_000_000_000n, SYNTHETIC)).toBe(`1 ${prefix}...${suffix}`)
  })

  it('handles fractional amounts for unknown mints', () => {
    const prefix = SYNTHETIC.slice(0, 4)
    const suffix = SYNTHETIC.slice(-4)
    expect(formatClaimAmount(1_000_000n, SYNTHETIC)).toBe(`0.001 ${prefix}...${suffix}`)
  })
})
