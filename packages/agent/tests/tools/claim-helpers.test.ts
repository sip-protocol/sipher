import { Buffer } from 'node:buffer'
import { describe, it, expect, vi } from 'vitest'
import { PublicKey, type Connection } from '@solana/web3.js'
import { resolveStealthContext, StealthContextError } from '../../src/tools/claim-helpers.js'

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
