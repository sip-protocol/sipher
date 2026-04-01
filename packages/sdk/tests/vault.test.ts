import { describe, it, expect } from 'vitest'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
  deriveVaultTokenPDA,
  deriveFeeTokenPDA,
  anchorDiscriminator,
  deserializeVaultConfig,
  deserializeDepositRecord,
  SIPHER_VAULT_PROGRAM_ID,
  SIP_PRIVACY_PROGRAM_ID,
  VAULT_CONFIG_SEED,
  DEPOSIT_RECORD_SEED,
  VAULT_TOKEN_SEED,
  FEE_TOKEN_SEED,
  DEFAULT_REFUND_TIMEOUT,
  DEFAULT_FEE_BPS,
  MAX_FEE_BPS,
  ANCHOR_DISCRIMINATOR_SIZE,
  VAULT_CONFIG_SIZE,
  DEPOSIT_RECORD_SIZE,
  DEVNET_CONFIG,
  MAINNET_CONFIG,
  getConfig,
  createConnection,
  WSOL_MINT,
  USDC_MINT,
  USDT_MINT,
  resolveTokenMint,
  getTokenDecimals,
  toBaseUnits,
  fromBaseUnits,
} from '../src/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const DEPOSITOR_A = new PublicKey('11111111111111111111111111111112')
const DEPOSITOR_B = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const MINT_USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const MINT_SOL = new PublicKey('So11111111111111111111111111111111111111112')

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

describe('Config', () => {
  it('has correct program IDs', () => {
    expect(SIPHER_VAULT_PROGRAM_ID.toBase58()).toBe(
      'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB'
    )
    expect(SIP_PRIVACY_PROGRAM_ID.toBase58()).toBe(
      'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'
    )
  })

  it('has correct PDA seeds matching on-chain constants', () => {
    expect(VAULT_CONFIG_SEED.toString()).toBe('vault_config')
    expect(DEPOSIT_RECORD_SEED.toString()).toBe('deposit_record')
    expect(VAULT_TOKEN_SEED.toString()).toBe('vault_token')
    expect(FEE_TOKEN_SEED.toString()).toBe('fee_token')
  })

  it('has correct default constants', () => {
    expect(DEFAULT_REFUND_TIMEOUT).toBe(86400)
    expect(DEFAULT_FEE_BPS).toBe(10)
    expect(MAX_FEE_BPS).toBe(100)
  })

  it('has correct account sizes', () => {
    // VaultConfig: 8 (disc) + 32 + 2 + 8 + 1 + 8 + 8 + 1 = 68
    expect(VAULT_CONFIG_SIZE).toBe(68)
    // DepositRecord: 8 (disc) + 32 + 32 + 8 + 8 + 8 + 8 + 1 = 105
    expect(DEPOSIT_RECORD_SIZE).toBe(105)
    expect(ANCHOR_DISCRIMINATOR_SIZE).toBe(8)
  })

  it('DEVNET_CONFIG has correct values', () => {
    expect(DEVNET_CONFIG.cluster).toBe('devnet')
    expect(DEVNET_CONFIG.rpcUrl).toBe('https://api.devnet.solana.com')
    expect(DEVNET_CONFIG.sipherVaultProgramId.equals(SIPHER_VAULT_PROGRAM_ID)).toBe(true)
    expect(DEVNET_CONFIG.sipPrivacyProgramId.equals(SIP_PRIVACY_PROGRAM_ID)).toBe(true)
  })

  it('MAINNET_CONFIG has correct values', () => {
    expect(MAINNET_CONFIG.cluster).toBe('mainnet-beta')
    expect(MAINNET_CONFIG.rpcUrl).toBe('https://api.mainnet-beta.solana.com')
    expect(MAINNET_CONFIG.sipherVaultProgramId.equals(SIPHER_VAULT_PROGRAM_ID)).toBe(true)
    expect(MAINNET_CONFIG.sipPrivacyProgramId.equals(SIP_PRIVACY_PROGRAM_ID)).toBe(true)
  })

  it('getConfig returns correct config for devnet', () => {
    const config = getConfig('devnet')
    expect(config.cluster).toBe('devnet')
    expect(config.rpcUrl).toBe('https://api.devnet.solana.com')
  })

  it('getConfig returns correct config for mainnet', () => {
    const config = getConfig('mainnet-beta')
    expect(config.cluster).toBe('mainnet-beta')
    expect(config.rpcUrl).toBe('https://api.mainnet-beta.solana.com')
  })

  it('getConfig accepts custom RPC URL override', () => {
    const config = getConfig('devnet', 'https://custom-rpc.example.com')
    expect(config.cluster).toBe('devnet')
    expect(config.rpcUrl).toBe('https://custom-rpc.example.com')
    expect(config.sipherVaultProgramId.equals(SIPHER_VAULT_PROGRAM_ID)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PDA derivation
// ─────────────────────────────────────────────────────────────────────────────

describe('PDA derivation', () => {
  describe('deriveVaultConfigPDA', () => {
    it('produces deterministic results', () => {
      const [pda1, bump1] = deriveVaultConfigPDA()
      const [pda2, bump2] = deriveVaultConfigPDA()
      expect(pda1.equals(pda2)).toBe(true)
      expect(bump1).toBe(bump2)
    })

    it('returns a valid PublicKey and bump', () => {
      const [pda, bump] = deriveVaultConfigPDA()
      expect(pda).toBeInstanceOf(PublicKey)
      expect(bump).toBeGreaterThanOrEqual(0)
      expect(bump).toBeLessThanOrEqual(255)
    })

    it('uses the default program ID', () => {
      const [pda1] = deriveVaultConfigPDA()
      const [pda2] = deriveVaultConfigPDA(SIPHER_VAULT_PROGRAM_ID)
      expect(pda1.equals(pda2)).toBe(true)
    })

    it('produces different PDAs for different program IDs', () => {
      const [pda1] = deriveVaultConfigPDA(SIPHER_VAULT_PROGRAM_ID)
      const [pda2] = deriveVaultConfigPDA(SIP_PRIVACY_PROGRAM_ID)
      expect(pda1.equals(pda2)).toBe(false)
    })
  })

  describe('deriveDepositRecordPDA', () => {
    it('produces deterministic results', () => {
      const [pda1, bump1] = deriveDepositRecordPDA(DEPOSITOR_A, MINT_USDC)
      const [pda2, bump2] = deriveDepositRecordPDA(DEPOSITOR_A, MINT_USDC)
      expect(pda1.equals(pda2)).toBe(true)
      expect(bump1).toBe(bump2)
    })

    it('different depositors produce different PDAs', () => {
      const [pdaA] = deriveDepositRecordPDA(DEPOSITOR_A, MINT_USDC)
      const [pdaB] = deriveDepositRecordPDA(DEPOSITOR_B, MINT_USDC)
      expect(pdaA.equals(pdaB)).toBe(false)
    })

    it('different mints produce different PDAs', () => {
      const [pdaUsdc] = deriveDepositRecordPDA(DEPOSITOR_A, MINT_USDC)
      const [pdaSol] = deriveDepositRecordPDA(DEPOSITOR_A, MINT_SOL)
      expect(pdaUsdc.equals(pdaSol)).toBe(false)
    })

    it('different depositor+mint combos produce different PDAs', () => {
      const [pda1] = deriveDepositRecordPDA(DEPOSITOR_A, MINT_USDC)
      const [pda2] = deriveDepositRecordPDA(DEPOSITOR_B, MINT_SOL)
      expect(pda1.equals(pda2)).toBe(false)
    })

    it('returns valid bump values', () => {
      const [, bump] = deriveDepositRecordPDA(DEPOSITOR_A, MINT_USDC)
      expect(bump).toBeGreaterThanOrEqual(0)
      expect(bump).toBeLessThanOrEqual(255)
    })
  })

  describe('deriveVaultTokenPDA', () => {
    it('produces deterministic results', () => {
      const [pda1] = deriveVaultTokenPDA(MINT_USDC)
      const [pda2] = deriveVaultTokenPDA(MINT_USDC)
      expect(pda1.equals(pda2)).toBe(true)
    })

    it('different mints produce different PDAs', () => {
      const [pdaUsdc] = deriveVaultTokenPDA(MINT_USDC)
      const [pdaSol] = deriveVaultTokenPDA(MINT_SOL)
      expect(pdaUsdc.equals(pdaSol)).toBe(false)
    })
  })

  describe('deriveFeeTokenPDA', () => {
    it('produces deterministic results', () => {
      const [pda1] = deriveFeeTokenPDA(MINT_USDC)
      const [pda2] = deriveFeeTokenPDA(MINT_USDC)
      expect(pda1.equals(pda2)).toBe(true)
    })

    it('different mints produce different PDAs', () => {
      const [pdaUsdc] = deriveFeeTokenPDA(MINT_USDC)
      const [pdaSol] = deriveFeeTokenPDA(MINT_SOL)
      expect(pdaUsdc.equals(pdaSol)).toBe(false)
    })

    it('vault token and fee token PDAs differ for the same mint', () => {
      const [vaultPda] = deriveVaultTokenPDA(MINT_USDC)
      const [feePda] = deriveFeeTokenPDA(MINT_USDC)
      expect(vaultPda.equals(feePda)).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Anchor discriminator
// ─────────────────────────────────────────────────────────────────────────────

describe('anchorDiscriminator', () => {
  it('returns 8 bytes', () => {
    const disc = anchorDiscriminator('deposit')
    expect(disc.length).toBe(8)
  })

  it('is deterministic', () => {
    const disc1 = anchorDiscriminator('deposit')
    const disc2 = anchorDiscriminator('deposit')
    expect(disc1.equals(disc2)).toBe(true)
  })

  it('different instructions produce different discriminators', () => {
    const deposit = anchorDiscriminator('deposit')
    const refund = anchorDiscriminator('refund')
    const withdraw = anchorDiscriminator('withdraw_private')
    const init = anchorDiscriminator('initialize')

    expect(deposit.equals(refund)).toBe(false)
    expect(deposit.equals(withdraw)).toBe(false)
    expect(refund.equals(init)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Account deserialization
// ─────────────────────────────────────────────────────────────────────────────

describe('deserializeVaultConfig', () => {
  function buildVaultConfigBuffer(overrides: {
    authority?: PublicKey
    feeBps?: number
    refundTimeout?: number
    paused?: boolean
    totalDeposits?: number
    totalDepositors?: number
    bump?: number
  } = {}): Buffer {
    const {
      authority = DEPOSITOR_A,
      feeBps = 10,
      refundTimeout = 86400,
      paused = false,
      totalDeposits = 5,
      totalDepositors = 3,
      bump = 254,
    } = overrides

    // 8 (discriminator) + 32 + 2 + 8 + 1 + 8 + 8 + 1 = 68
    const buf = Buffer.alloc(68)
    let offset = 0

    // Discriminator (8 bytes, arbitrary for test)
    buf.fill(0xaa, 0, 8)
    offset = 8

    // authority: Pubkey (32)
    authority.toBuffer().copy(buf, offset)
    offset += 32

    // fee_bps: u16 LE
    buf.writeUInt16LE(feeBps, offset)
    offset += 2

    // refund_timeout: i64 LE
    buf.writeBigInt64LE(BigInt(refundTimeout), offset)
    offset += 8

    // paused: bool (1 byte)
    buf[offset] = paused ? 1 : 0
    offset += 1

    // total_deposits: u64 LE
    buf.writeBigUInt64LE(BigInt(totalDeposits), offset)
    offset += 8

    // total_depositors: u64 LE
    buf.writeBigUInt64LE(BigInt(totalDepositors), offset)
    offset += 8

    // bump: u8
    buf[offset] = bump

    return buf
  }

  it('deserializes valid VaultConfig data', () => {
    const buf = buildVaultConfigBuffer()
    const config = deserializeVaultConfig(buf)

    expect(config.authority.equals(DEPOSITOR_A)).toBe(true)
    expect(config.feeBps).toBe(10)
    expect(config.refundTimeout).toBe(86400)
    expect(config.paused).toBe(false)
    expect(config.totalDeposits).toBe(5)
    expect(config.totalDepositors).toBe(3)
    expect(config.bump).toBe(254)
  })

  it('deserializes paused=true correctly', () => {
    const buf = buildVaultConfigBuffer({ paused: true })
    const config = deserializeVaultConfig(buf)
    expect(config.paused).toBe(true)
  })

  it('handles max fee BPS', () => {
    const buf = buildVaultConfigBuffer({ feeBps: 100 })
    const config = deserializeVaultConfig(buf)
    expect(config.feeBps).toBe(100)
  })

  it('handles zero counters', () => {
    const buf = buildVaultConfigBuffer({ totalDeposits: 0, totalDepositors: 0 })
    const config = deserializeVaultConfig(buf)
    expect(config.totalDeposits).toBe(0)
    expect(config.totalDepositors).toBe(0)
  })

  it('handles large counter values', () => {
    const buf = buildVaultConfigBuffer({ totalDeposits: 1_000_000, totalDepositors: 500_000 })
    const config = deserializeVaultConfig(buf)
    expect(config.totalDeposits).toBe(1_000_000)
    expect(config.totalDepositors).toBe(500_000)
  })

  it('throws on data too short', () => {
    const buf = Buffer.alloc(50)
    expect(() => deserializeVaultConfig(buf)).toThrow('VaultConfig data too short')
  })

  it('handles data longer than expected (padding)', () => {
    const buf = Buffer.alloc(100)
    buildVaultConfigBuffer().copy(buf)
    const config = deserializeVaultConfig(buf)
    expect(config.feeBps).toBe(10)
  })
})

describe('deserializeDepositRecord', () => {
  function buildDepositRecordBuffer(overrides: {
    depositor?: PublicKey
    tokenMint?: PublicKey
    balance?: bigint
    lockedAmount?: bigint
    cumulativeVolume?: bigint
    lastDepositAt?: number
    bump?: number
  } = {}): Buffer {
    const {
      depositor = DEPOSITOR_A,
      tokenMint = MINT_USDC,
      balance = 1_000_000n,
      lockedAmount = 100_000n,
      cumulativeVolume = 5_000_000n,
      lastDepositAt = 1711900800,
      bump = 253,
    } = overrides

    // 8 (discriminator) + 32 + 32 + 8 + 8 + 8 + 8 + 1 = 105
    const buf = Buffer.alloc(105)
    let offset = 0

    // Discriminator
    buf.fill(0xbb, 0, 8)
    offset = 8

    // depositor: Pubkey (32)
    depositor.toBuffer().copy(buf, offset)
    offset += 32

    // token_mint: Pubkey (32)
    tokenMint.toBuffer().copy(buf, offset)
    offset += 32

    // balance: u64 LE
    buf.writeBigUInt64LE(balance, offset)
    offset += 8

    // locked_amount: u64 LE
    buf.writeBigUInt64LE(lockedAmount, offset)
    offset += 8

    // cumulative_volume: u64 LE
    buf.writeBigUInt64LE(cumulativeVolume, offset)
    offset += 8

    // last_deposit_at: i64 LE
    buf.writeBigInt64LE(BigInt(lastDepositAt), offset)
    offset += 8

    // bump: u8
    buf[offset] = bump

    return buf
  }

  it('deserializes valid DepositRecord data', () => {
    const buf = buildDepositRecordBuffer()
    const record = deserializeDepositRecord(buf)

    expect(record.depositor.equals(DEPOSITOR_A)).toBe(true)
    expect(record.tokenMint.equals(MINT_USDC)).toBe(true)
    expect(record.balance).toBe(1_000_000n)
    expect(record.lockedAmount).toBe(100_000n)
    expect(record.cumulativeVolume).toBe(5_000_000n)
    expect(record.lastDepositAt).toBe(1711900800)
    expect(record.bump).toBe(253)
  })

  it('handles zero balance', () => {
    const buf = buildDepositRecordBuffer({ balance: 0n, lockedAmount: 0n, cumulativeVolume: 0n })
    const record = deserializeDepositRecord(buf)
    expect(record.balance).toBe(0n)
    expect(record.lockedAmount).toBe(0n)
    expect(record.cumulativeVolume).toBe(0n)
  })

  it('handles large balances (u64 max range)', () => {
    const largeAmount = 18_446_744_073_709_551_615n // u64::MAX
    const buf = buildDepositRecordBuffer({ balance: largeAmount })
    const record = deserializeDepositRecord(buf)
    expect(record.balance).toBe(largeAmount)
  })

  it('deserializes different depositor+mint correctly', () => {
    const buf = buildDepositRecordBuffer({ depositor: DEPOSITOR_B, tokenMint: MINT_SOL })
    const record = deserializeDepositRecord(buf)
    expect(record.depositor.equals(DEPOSITOR_B)).toBe(true)
    expect(record.tokenMint.equals(MINT_SOL)).toBe(true)
  })

  it('throws on data too short', () => {
    const buf = Buffer.alloc(80)
    expect(() => deserializeDepositRecord(buf)).toThrow('DepositRecord data too short')
  })

  it('handles data longer than expected (padding)', () => {
    const buf = Buffer.alloc(200)
    buildDepositRecordBuffer().copy(buf)
    const record = deserializeDepositRecord(buf)
    expect(record.balance).toBe(1_000_000n)
  })

  it('roundtrips available balance calculation', () => {
    const buf = buildDepositRecordBuffer({ balance: 500_000n, lockedAmount: 200_000n })
    const record = deserializeDepositRecord(buf)
    const available = record.balance - record.lockedAmount
    expect(available).toBe(300_000n)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Connection helper
// ─────────────────────────────────────────────────────────────────────────────

describe('createConnection', () => {
  it('returns a Connection instance for devnet', () => {
    const conn = createConnection('devnet')
    expect(conn).toBeInstanceOf(Connection)
  })

  it('returns a Connection instance for mainnet', () => {
    const conn = createConnection('mainnet-beta')
    expect(conn).toBeInstanceOf(Connection)
  })

  it('defaults to devnet', () => {
    const conn = createConnection()
    expect(conn).toBeInstanceOf(Connection)
  })

  it('accepts custom RPC URL override', () => {
    const conn = createConnection('devnet', 'https://custom.example.com')
    expect(conn).toBeInstanceOf(Connection)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Token resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('token mints', () => {
  it('WSOL_MINT matches expected address', () => {
    expect(WSOL_MINT.toBase58()).toBe('So11111111111111111111111111111111111111112')
  })

  it('USDC_MINT matches expected address', () => {
    expect(USDC_MINT.toBase58()).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  })

  it('USDT_MINT matches expected address', () => {
    expect(USDT_MINT.toBase58()).toBe('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')
  })
})

describe('resolveTokenMint', () => {
  it('resolves SOL to wSOL mint', () => {
    expect(resolveTokenMint('SOL').equals(WSOL_MINT)).toBe(true)
  })

  it('resolves WSOL to wSOL mint', () => {
    expect(resolveTokenMint('WSOL').equals(WSOL_MINT)).toBe(true)
  })

  it('resolves USDC to USDC mint', () => {
    expect(resolveTokenMint('USDC').equals(USDC_MINT)).toBe(true)
  })

  it('resolves USDT to USDT mint', () => {
    expect(resolveTokenMint('USDT').equals(USDT_MINT)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(resolveTokenMint('sol').equals(WSOL_MINT)).toBe(true)
    expect(resolveTokenMint('Usdc').equals(USDC_MINT)).toBe(true)
    expect(resolveTokenMint('usdt').equals(USDT_MINT)).toBe(true)
  })

  it('resolves raw base58 mint address', () => {
    const mint = resolveTokenMint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    expect(mint.equals(USDC_MINT)).toBe(true)
  })

  it('throws for unknown symbol and invalid address', () => {
    expect(() => resolveTokenMint('FAKECOIN')).toThrow('Unknown token "FAKECOIN"')
  })

  it('trims whitespace', () => {
    expect(resolveTokenMint('  SOL  ').equals(WSOL_MINT)).toBe(true)
  })
})

describe('getTokenDecimals', () => {
  it('returns 9 for wSOL', () => {
    expect(getTokenDecimals(WSOL_MINT)).toBe(9)
  })

  it('returns 6 for USDC', () => {
    expect(getTokenDecimals(USDC_MINT)).toBe(6)
  })

  it('returns 6 for USDT', () => {
    expect(getTokenDecimals(USDT_MINT)).toBe(6)
  })

  it('returns 9 as default for unknown mints', () => {
    const unknown = new PublicKey('11111111111111111111111111111112')
    expect(getTokenDecimals(unknown)).toBe(9)
  })
})

describe('toBaseUnits', () => {
  it('converts 1 SOL to 1_000_000_000 lamports', () => {
    expect(toBaseUnits(1, 9)).toBe(1_000_000_000n)
  })

  it('converts 1.5 SOL correctly', () => {
    expect(toBaseUnits(1.5, 9)).toBe(1_500_000_000n)
  })

  it('converts 1 USDC to 1_000_000', () => {
    expect(toBaseUnits(1, 6)).toBe(1_000_000n)
  })

  it('converts 0.01 USDC correctly', () => {
    expect(toBaseUnits(0.01, 6)).toBe(10_000n)
  })

  it('handles 0', () => {
    expect(toBaseUnits(0, 9)).toBe(0n)
  })

  it('handles whole numbers without decimals', () => {
    expect(toBaseUnits(100, 6)).toBe(100_000_000n)
  })
})

describe('fromBaseUnits', () => {
  it('converts 1_000_000_000 lamports to "1"', () => {
    expect(fromBaseUnits(1_000_000_000n, 9)).toBe('1')
  })

  it('converts 1_500_000_000 lamports to "1.5"', () => {
    expect(fromBaseUnits(1_500_000_000n, 9)).toBe('1.5')
  })

  it('converts 1_000_000 to "1" (USDC)', () => {
    expect(fromBaseUnits(1_000_000n, 6)).toBe('1')
  })

  it('converts 10_000 to "0.01" (USDC)', () => {
    expect(fromBaseUnits(10_000n, 6)).toBe('0.01')
  })

  it('converts 0 to "0"', () => {
    expect(fromBaseUnits(0n, 9)).toBe('0')
  })

  it('strips trailing zeros', () => {
    expect(fromBaseUnits(1_100_000_000n, 9)).toBe('1.1')
  })
})
