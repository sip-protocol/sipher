import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { checkEd25519StealthAddress } from '@sip-protocol/sdk'
import type { StealthAddress, HexString } from '@sip-protocol/types'
import { validateRequest } from '../middleware/validation.js'
import { getConnection } from '../services/solana.js'
import { PublicKey } from '@solana/web3.js'
import { bytesToHex } from '@noble/hashes/utils'
import { getAssetsByOwner, isHeliusConfigured } from '../services/helius-provider.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ErrorCode } from '../errors/codes.js'

const router = Router()

const SIP_MEMO_PREFIX = 'SIP:'
const BATCH_MAX = 100

// ─── Schemas ────────────────────────────────────────────────────────────────

const hexString = z.string().regex(/^0x[0-9a-fA-F]{64}$/)

const scanSchema = z.object({
  viewingPrivateKey: hexString,
  spendingPublicKey: hexString,
  fromSlot: z.number().int().min(0).optional(),
  toSlot: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
})

// ─── Routes ─────────────────────────────────────────────────────────────────

router.post(
  '/scan/payments',
  validateRequest({ body: scanSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { viewingPrivateKey, spendingPublicKey, fromSlot, toSlot, limit } = req.body
      const connection = getConnection()

      // Scan memo program for SIP announcements
      const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

      const signatures = await connection.getSignaturesForAddress(memoProgram, {
        limit,
        minContextSlot: fromSlot,
      })

      const filtered = toSlot
        ? signatures.filter(s => s.slot <= toSlot)
        : signatures

      const results: Array<{
        stealthAddress: string
        ephemeralPublicKey: string
        txSignature: string
        slot: number
        timestamp: number
      }> = []

      for (const sigInfo of filtered) {
        try {
          const tx = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          })

          if (!tx?.meta?.logMessages) continue

          for (const log of tx.meta.logMessages) {
            if (!log.includes(SIP_MEMO_PREFIX)) continue

            const memoMatch = log.match(/Program log: (.+)/)
            if (!memoMatch) continue

            // Parse announcement: SIP:<ephemeralPubKey>:<viewTag>:<stealthAddress>
            const parts = memoMatch[1].replace(SIP_MEMO_PREFIX, '').split(':')
            if (parts.length < 3) continue

            const [ephemeralB58, viewTagHex, stealthB58] = parts

            let ephemeralHex: HexString
            let stealthHex: HexString
            try {
              const ephPubkey = new PublicKey(ephemeralB58)
              const stPubkey = new PublicKey(stealthB58)
              ephemeralHex = `0x${bytesToHex(ephPubkey.toBytes())}` as HexString
              stealthHex = `0x${bytesToHex(stPubkey.toBytes())}` as HexString
            } catch {
              continue
            }

            const viewTagNumber = parseInt(viewTagHex, 16)
            if (isNaN(viewTagNumber) || viewTagNumber < 0 || viewTagNumber > 255) continue

            const stealthAddressObj: StealthAddress = {
              address: stealthHex,
              ephemeralPublicKey: ephemeralHex,
              viewTag: viewTagNumber,
            }

            let isOurs = false
            try {
              isOurs = checkEd25519StealthAddress(
                stealthAddressObj,
                viewingPrivateKey as HexString,
                spendingPublicKey as HexString
              )
            } catch {
              continue
            }

            if (isOurs) {
              results.push({
                stealthAddress: stealthB58,
                ephemeralPublicKey: ephemeralB58,
                txSignature: sigInfo.signature,
                slot: sigInfo.slot,
                timestamp: sigInfo.blockTime || 0,
              })
            }
          }
        } catch {
          // Skip failed tx parsing
        }
      }

      res.json({
        success: true,
        data: {
          payments: results,
          scanned: filtered.length,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Batch Scan ─────────────────────────────────────────────────────────────

const batchScanSchema = z.object({
  keyPairs: z.array(
    z.object({
      viewingPrivateKey: hexString,
      spendingPublicKey: hexString,
      label: z.string().optional(),
    })
  ).min(1).max(BATCH_MAX),
  fromSlot: z.number().int().min(0).optional(),
  toSlot: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
})

router.post(
  '/scan/payments/batch',
  validateRequest({ body: batchScanSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { keyPairs, fromSlot, toSlot, limit } = req.body
      const connection = getConnection()

      const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

      const signatures = await connection.getSignaturesForAddress(memoProgram, {
        limit,
        minContextSlot: fromSlot,
      })

      const filtered = toSlot
        ? signatures.filter(s => s.slot <= toSlot)
        : signatures

      const keyPairResults: Array<{
        index: number
        label?: string
        success: boolean
        data?: { payments: Array<{ stealthAddress: string; ephemeralPublicKey: string; txSignature: string; slot: number; timestamp: number }>; scanned: number }
        error?: string
      }> = []

      for (let kpIdx = 0; kpIdx < keyPairs.length; kpIdx++) {
        const kp = keyPairs[kpIdx]
        try {
          const payments: Array<{
            stealthAddress: string
            ephemeralPublicKey: string
            txSignature: string
            slot: number
            timestamp: number
          }> = []

          for (const sigInfo of filtered) {
            try {
              const tx = await connection.getTransaction(sigInfo.signature, {
                maxSupportedTransactionVersion: 0,
              })

              if (!tx?.meta?.logMessages) continue

              for (const log of tx.meta.logMessages) {
                if (!log.includes(SIP_MEMO_PREFIX)) continue

                const memoMatch = log.match(/Program log: (.+)/)
                if (!memoMatch) continue

                const parts = memoMatch[1].replace(SIP_MEMO_PREFIX, '').split(':')
                if (parts.length < 3) continue

                const [ephemeralB58, viewTagHex, stealthB58] = parts

                let ephemeralHex: HexString
                let stealthHex: HexString
                try {
                  const ephPubkey = new PublicKey(ephemeralB58)
                  const stPubkey = new PublicKey(stealthB58)
                  ephemeralHex = `0x${bytesToHex(ephPubkey.toBytes())}` as HexString
                  stealthHex = `0x${bytesToHex(stPubkey.toBytes())}` as HexString
                } catch {
                  continue
                }

                const viewTagNumber = parseInt(viewTagHex, 16)
                if (isNaN(viewTagNumber) || viewTagNumber < 0 || viewTagNumber > 255) continue

                const stealthAddressObj: StealthAddress = {
                  address: stealthHex,
                  ephemeralPublicKey: ephemeralHex,
                  viewTag: viewTagNumber,
                }

                let isOurs = false
                try {
                  isOurs = checkEd25519StealthAddress(
                    stealthAddressObj,
                    kp.viewingPrivateKey as HexString,
                    kp.spendingPublicKey as HexString
                  )
                } catch {
                  continue
                }

                if (isOurs) {
                  payments.push({
                    stealthAddress: stealthB58,
                    ephemeralPublicKey: ephemeralB58,
                    txSignature: sigInfo.signature,
                    slot: sigInfo.slot,
                    timestamp: sigInfo.blockTime || 0,
                  })
                }
              }
            } catch {
              // Skip failed tx parsing
            }
          }

          keyPairResults.push({
            index: kpIdx,
            label: kp.label,
            success: true,
            data: { payments, scanned: filtered.length },
          })
        } catch (err: unknown) {
          keyPairResults.push({
            index: kpIdx,
            label: kp.label,
            success: false,
            error: err instanceof Error ? err.message : 'Scan failed',
          })
        }
      }

      const totalPayments = keyPairResults.reduce((sum, r) => sum + (r.data?.payments.length || 0), 0)

      res.json({
        success: true,
        data: {
          results: keyPairResults,
          summary: {
            totalKeyPairs: keyPairs.length,
            totalPaymentsFound: totalPayments,
            transactionsScanned: filtered.length,
          },
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Scan Assets (Helius DAS) ──────────────────────────────────────────────

const scanAssetsSchema = z.object({
  address: z.string().min(32).max(44),
  displayOptions: z.object({
    showFungible: z.boolean().default(true),
    showNativeBalance: z.boolean().default(false),
  }).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(1000).default(100),
})

router.post(
  '/scan/assets',
  validateRequest({ body: scanAssetsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address, displayOptions, page, limit } = req.body

      // Validate address is a valid Solana pubkey
      try {
        new PublicKey(address)
      } catch {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.INVALID_ADDRESS,
            message: 'Invalid Solana address',
          },
        })
        return
      }

      // If Helius is configured, use DAS API
      if (isHeliusConfigured()) {
        const result = await getAssetsByOwner(
          address,
          displayOptions || {},
          page,
          limit,
        )

        res.json({
          success: true,
          data: {
            assets: result.items,
            total: result.total,
            page: result.page,
            limit: result.limit,
            provider: 'helius-das',
          },
        })
        return
      }

      // Fallback: use standard getTokenAccountsByOwner
      const connection = getConnection()
      const owner = new PublicKey(address)

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        owner,
        { programId: TOKEN_PROGRAM_ID }
      )

      const assets = tokenAccounts.value.map(account => {
        const info = account.account.data.parsed.info
        return {
          id: account.pubkey.toBase58(),
          interface: 'FungibleToken',
          token_info: {
            balance: Number(info.tokenAmount.amount),
            decimals: info.tokenAmount.decimals,
          },
          ownership: {
            owner: info.owner,
            frozen: info.state === 'frozen',
            delegated: !!info.delegate,
          },
        }
      })

      res.json({
        success: true,
        data: {
          assets,
          total: assets.length,
          page: 1,
          limit: assets.length,
          provider: 'solana-rpc',
        },
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'HeliusDASUnavailableError') {
        res.status(503).json({
          success: false,
          error: {
            code: ErrorCode.SOLANA_RPC_UNAVAILABLE,
            message: err.message,
          },
        })
        return
      }
      if (err instanceof Error && err.name === 'HeliusDASError') {
        res.status(500).json({
          success: false,
          error: {
            code: ErrorCode.SCAN_FAILED,
            message: err.message,
          },
        })
        return
      }
      next(err)
    }
  }
)

export default router
