import { Router } from 'express'
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getPaymentLink, markPaymentLinkPaid } from '../db.js'
import {
  renderPaymentPage,
  renderExpiredPage,
  renderPaidPage,
  renderNotFoundPage,
} from '../views/pay-page.js'

export const payRouter = Router()

// ─────────────────────────────────────────────────────────────────────────────
// On-chain transaction verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a Solana transaction on-chain before accepting payment confirmation.
 * Checks: tx exists, tx succeeded, recipient matches, amount matches.
 * Fail-open on RPC errors — we don't want RPC downtime to block legitimate payments.
 */
export async function verifyTransaction(
  txSignature: string,
  expectedAddress: string,
  expectedAmount: number | null,
): Promise<{ valid: boolean; error?: string }> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
  const connection = new Connection(rpcUrl, 'confirmed')

  try {
    const tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      return { valid: false, error: 'transaction not found on-chain' }
    }

    if (tx.meta?.err) {
      return { valid: false, error: 'transaction failed on-chain' }
    }

    // Check the stealth address received funds
    const accountKeys = tx.transaction.message.getAccountKeys()
    const targetIndex = accountKeys.staticAccountKeys.findIndex(
      key => key.toBase58() === expectedAddress,
    )

    if (targetIndex === -1) {
      return { valid: false, error: 'transaction does not involve the expected address' }
    }

    // Verify amount if specified (1% tolerance for rounding)
    if (expectedAmount !== null && tx.meta) {
      const preBalance = tx.meta.preBalances[targetIndex] ?? 0
      const postBalance = tx.meta.postBalances[targetIndex] ?? 0
      const receivedLamports = postBalance - preBalance
      const receivedSol = receivedLamports / LAMPORTS_PER_SOL

      if (receivedSol < expectedAmount * 0.99) {
        return {
          valid: false,
          error: `insufficient amount: received ${receivedSol.toFixed(4)} SOL, expected ${expectedAmount} SOL`,
        }
      }
    }

    return { valid: true }
  } catch (err) {
    // RPC failures should not block payment — log and allow with warning
    console.warn('[pay] on-chain verification failed, accepting signature:', err instanceof Error ? err.message : err)
    return { valid: true }
  }
}

payRouter.get('/:id', (req, res) => {
  const link = getPaymentLink(req.params.id)

  if (!link) {
    res.status(404).type('html').send(renderNotFoundPage())
    return
  }

  if (link.status === 'paid' && link.paid_tx) {
    res.type('html').send(renderPaidPage(link.paid_tx))
    return
  }

  if (link.status === 'expired' || link.expires_at < Date.now()) {
    res.status(410).type('html').send(renderExpiredPage())
    return
  }

  res.type('html').send(renderPaymentPage(link))
})

payRouter.post('/:id/confirm', async (req, res) => {
  const { txSignature } = req.body

  if (!txSignature || typeof txSignature !== 'string' || txSignature.length > 200) {
    res.status(400).json({ error: 'txSignature is required and must be a valid transaction signature' })
    return
  }

  const link = getPaymentLink(req.params.id)

  if (!link) {
    res.status(404).json({ error: 'Payment link not found' })
    return
  }

  if (link.status === 'paid') {
    res.status(409).json({ error: 'Payment link already paid' })
    return
  }

  if (link.status === 'expired' || link.expires_at < Date.now()) {
    res.status(410).json({ error: 'Payment link has expired' })
    return
  }

  // On-chain verification: tx exists, succeeded, correct recipient & amount
  const verification = await verifyTransaction(
    txSignature,
    link.stealth_address,
    link.amount,
  )

  if (!verification.valid) {
    res.status(400).json({ error: verification.error ?? 'transaction verification failed' })
    return
  }

  markPaymentLinkPaid(req.params.id, txSignature)
  res.json({ success: true, message: 'Payment confirmed' })
})
