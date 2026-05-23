import { Router, type Request, type Response } from 'express'
import {
  Transaction,
  VersionedTransaction,
  SendTransactionError,
  TransactionExpiredBlockheightExceededError,
} from '@solana/web3.js'
import { createConnection } from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'
import { sendAndConfirmWithRetry, TransactionFailedOnChainError } from '../lib/sendWithRetry.js'

export const txBroadcastRouter = Router()

/** Strip `api-key=<value>` query params from error strings before client return. */
function redact(message: string): string {
  return message.replace(/api-key=[^&\s"')]+/gi, 'api-key=REDACTED')
}

/** Best-effort decode; returns null on invalid base64. */
function decodeBase64(input: string): Uint8Array | null {
  try {
    const buf = Buffer.from(input, 'base64')
    // Buffer.from('not!!base64!!', 'base64') silently returns garbage —
    // round-trip check protects against that.
    if (buf.toString('base64').replace(/=+$/, '') !== input.replace(/=+$/, '')) {
      return null
    }
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

/** Try Transaction first, fall back to VersionedTransaction. Returns true if either succeeds. */
function isValidSignedTx(bytes: Uint8Array): boolean {
  try {
    Transaction.from(bytes)
    return true
  } catch {
    try {
      VersionedTransaction.deserialize(bytes)
      return true
    } catch {
      return false
    }
  }
}

txBroadcastRouter.post('/broadcast', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authenticated wallet required' },
    })
    return
  }

  const { serializedTx, blockhash, lastValidBlockHeight } = (req.body ?? {}) as {
    serializedTx?: unknown
    blockhash?: unknown
    lastValidBlockHeight?: unknown
  }

  if (typeof serializedTx !== 'string' || serializedTx.length === 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'serializedTx must be a non-empty base64 string' },
    })
    return
  }
  if (typeof blockhash !== 'string' || blockhash.length === 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'blockhash must be a non-empty string' },
    })
    return
  }
  if (typeof lastValidBlockHeight !== 'number' || !Number.isFinite(lastValidBlockHeight) || lastValidBlockHeight <= 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'lastValidBlockHeight must be a positive number' },
    })
    return
  }

  const signedBytes = decodeBase64(serializedTx)
  if (!signedBytes) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'serializedTx is not valid base64' },
    })
    return
  }
  if (!isValidSignedTx(signedBytes)) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'serializedTx is not a valid signed Solana transaction' },
    })
    return
  }

  const net = loadNetworkConfig()
  const connection = createConnection(net.clusterName, net.rpcUrl)

  // Pre-flight: fail fast if the blockhash is already in the past.
  try {
    const currentHeight = await connection.getBlockHeight('confirmed')
    if (currentHeight > lastValidBlockHeight) {
      res.status(400).json({
        error: {
          code: 'BLOCKHASH_EXPIRED',
          message: 'lastValidBlockHeight already in the past — re-sign with a fresh blockhash',
        },
      })
      return
    }
  } catch (e) {
    // Pre-flight is best-effort; if Helius getBlockHeight fails, fall through
    // and let the actual broadcast surface the real error. Log so prod issues
    // are diagnosable.
    const detail = e instanceof Error ? e.message : String(e)
    console.warn(`[tx/broadcast] pre-flight getBlockHeight failed: ${redact(detail)}`)
  }

  try {
    const signature = await sendAndConfirmWithRetry(
      connection,
      signedBytes,
      blockhash,
      lastValidBlockHeight,
    )
    res.status(200).json({ signature })
    return
  } catch (err) {
    // sipher#299 follow-up: prod returns 500 INTERNAL "unknown error" instead
    // of 502 TX_FAILED_ON_CHAIN for confirmed-with-err txs. Local repro
    // confirms sendAndConfirmWithRetry throws TransactionFailedOnChainError
    // correctly; the instanceof check should match. Log shape for diagnosis.
    console.error('[tx/broadcast] caught error:', {
      isError: err instanceof Error,
      isTFOCE: err instanceof TransactionFailedOnChainError,
      isSendErr: err instanceof SendTransactionError,
      isExpired: err instanceof TransactionExpiredBlockheightExceededError,
      constructorName: (err as { constructor?: { name?: string } })?.constructor?.name,
      name: (err as { name?: string })?.name,
      message: (err as { message?: string })?.message?.slice?.(0, 300),
      stringified: String(err).slice(0, 300),
    })
    const rawMessage = err instanceof Error ? err.message : 'unknown error'
    const message = redact(rawMessage)

    if (err instanceof TransactionExpiredBlockheightExceededError) {
      res.status(504).json({
        error: {
          code: 'CONFIRMATION_TIMEOUT',
          message: 'Transaction expired before confirmation. Retry with a fresh blockhash.',
        },
      })
      return
    }
    if (err instanceof TransactionFailedOnChainError) {
      // Tx landed on-chain but the program returned an error. Surface a
      // structured 502 with the err payload so the FE can render an
      // actionable message instead of "tx cancelled". See sipher#299.
      res.status(502).json({
        error: {
          code: 'TX_FAILED_ON_CHAIN',
          message: redact(err.message),
          signature: err.signature,
          err: err.err,
        },
      })
      return
    }
    if (err instanceof SendTransactionError) {
      res.status(502).json({
        error: { code: 'BROADCAST_FAILED', message: `RPC rejected transaction: ${message}` },
      })
      return
    }
    res.status(500).json({
      error: { code: 'INTERNAL', message },
    })
  }
})
