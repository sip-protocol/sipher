import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('vault-refund', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.resetModules()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    warnSpy.mockRestore()
  })

  describe('performVaultRefund', () => {
    it('throws when SENTINEL_AUTHORITY_KEYPAIR not set', async () => {
      delete process.env.SENTINEL_AUTHORITY_KEYPAIR
      const { performVaultRefund } = await import('../../src/sentinel/vault-refund.js')
      await expect(performVaultRefund('pda1', 0.5))
        .rejects.toThrow(/SENTINEL_AUTHORITY_KEYPAIR/)
    })

    it('calls buildAuthorityRefundTx + signs + sends when keypair is set', async () => {
      process.env.SENTINEL_AUTHORITY_KEYPAIR = '/tmp/fake-keypair.json'

      const mockTx = {
        sign: vi.fn(),
        serialize: vi.fn().mockReturnValue(Buffer.from('fake-tx')),
      }
      const mockDepositRecord = {
        depositor: { toBase58: () => 'depositor1' },
        tokenMint: { toBase58: () => 'mint1' },
      }

      vi.doMock('@sipher/sdk', () => ({
        createConnection: vi.fn().mockReturnValue({
          sendRawTransaction: vi.fn().mockResolvedValue('txSig123'),
          confirmTransaction: vi.fn().mockResolvedValue({ value: {} }),
        }),
        fetchDepositRecord: vi.fn().mockResolvedValue(mockDepositRecord),
        buildAuthorityRefundTx: vi.fn().mockResolvedValue({
          transaction: mockTx,
          refundAmount: 500_000_000n,
          depositorTokenAddress: 'ata1',
        }),
      }))
      vi.doMock('node:fs', () => ({
        readFileSync: vi.fn().mockReturnValue(JSON.stringify(Array(64).fill(1))),
      }))
      vi.doMock('@solana/spl-token', () => ({
        getAssociatedTokenAddress: vi.fn().mockResolvedValue('ata1'),
      }))
      vi.doMock('@solana/web3.js', async () => {
        const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js')
        const mockKeypair = {
          publicKey: new actual.PublicKey('11111111111111111111111111111111'),
          secretKey: new Uint8Array(64).fill(1),
          sign: vi.fn(),
        }
        return {
          ...actual,
          Keypair: {
            ...actual.Keypair,
            fromSecretKey: vi.fn().mockReturnValue(mockKeypair),
            generate: vi.fn().mockReturnValue(mockKeypair),
          },
        }
      })

      const { performVaultRefund } = await import('../../src/sentinel/vault-refund.js')
      // Use a valid base58 pubkey so `new PublicKey(pda)` doesn't throw
      const result = await performVaultRefund('11111111111111111111111111111111', 0.5)

      expect(result.success).toBe(true)
      expect(result.txId).toBe('txSig123')
      expect(mockTx.sign).toHaveBeenCalled()

      vi.doUnmock('@sipher/sdk')
      vi.doUnmock('node:fs')
      vi.doUnmock('@solana/spl-token')
      vi.doUnmock('@solana/web3.js')
    })

    it('throws when on-chain balance differs from requested amount beyond tolerance', async () => {
      process.env.SENTINEL_AUTHORITY_KEYPAIR = '/tmp/fake-keypair.json'

      const mockTx = {
        sign: vi.fn(),
        serialize: vi.fn().mockReturnValue(Buffer.from('fake-tx')),
      }
      const mockDepositRecord = {
        depositor: { toBase58: () => 'depositor1' },
        tokenMint: { toBase58: () => 'mint1' },
      }

      vi.doMock('@sipher/sdk', () => ({
        createConnection: vi.fn().mockReturnValue({
          sendRawTransaction: vi.fn(),
          confirmTransaction: vi.fn(),
        }),
        fetchDepositRecord: vi.fn().mockResolvedValue(mockDepositRecord),
        buildAuthorityRefundTx: vi.fn().mockResolvedValue({
          transaction: mockTx,
          // SENTINEL expects 1.0 SOL but on-chain has 5.0 SOL → 400% mismatch (way beyond 1%)
          refundAmount: 5_000_000_000n,
          depositorTokenAddress: 'ata1',
        }),
      }))
      vi.doMock('node:fs', () => ({
        readFileSync: vi.fn().mockReturnValue(JSON.stringify(Array(64).fill(1))),
      }))
      vi.doMock('@solana/spl-token', () => ({
        getAssociatedTokenAddress: vi.fn().mockResolvedValue('ata1'),
      }))
      vi.doMock('@solana/web3.js', async () => {
        const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js')
        const mockKeypair = {
          publicKey: new actual.PublicKey('11111111111111111111111111111111'),
          secretKey: new Uint8Array(64).fill(1),
          sign: vi.fn(),
        }
        return {
          ...actual,
          Keypair: {
            ...actual.Keypair,
            fromSecretKey: vi.fn().mockReturnValue(mockKeypair),
            generate: vi.fn().mockReturnValue(mockKeypair),
          },
        }
      })

      const { performVaultRefund } = await import('../../src/sentinel/vault-refund.js')
      await expect(performVaultRefund('11111111111111111111111111111111', 1.0)).rejects.toThrow(/mismatch/i)
      expect(mockTx.sign).not.toHaveBeenCalled()

      vi.doUnmock('@sipher/sdk')
      vi.doUnmock('node:fs')
      vi.doUnmock('@solana/spl-token')
      vi.doUnmock('@solana/web3.js')
    })
  })

  describe('assertVaultRefundWired', () => {
    it('warns when prod + mode!=off + no keypair', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SENTINEL_MODE = 'yolo'
      delete process.env.SENTINEL_AUTHORITY_KEYPAIR
      const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
      assertVaultRefundWired()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SENTINEL_AUTHORITY_KEYPAIR'))
    })

    it('silent when SENTINEL_AUTHORITY_KEYPAIR is set', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SENTINEL_MODE = 'yolo'
      process.env.SENTINEL_AUTHORITY_KEYPAIR = '/some/path.json'
      const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
      assertVaultRefundWired()
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('silent when mode=off', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SENTINEL_MODE = 'off'
      delete process.env.SENTINEL_AUTHORITY_KEYPAIR
      const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
      assertVaultRefundWired()
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('silent in non-prod', async () => {
      process.env.NODE_ENV = 'development'
      process.env.SENTINEL_MODE = 'yolo'
      delete process.env.SENTINEL_AUTHORITY_KEYPAIR
      const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
      assertVaultRefundWired()
      expect(warnSpy).not.toHaveBeenCalled()
    })
  })
})
